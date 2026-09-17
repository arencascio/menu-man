-- Provider-backed, capability-gated restaurant refunds. The authenticated
-- command reserves funds under the payment row lock; only service-role payment
-- orchestration may record provider results or apply verified provider events.

begin;

update public.restaurant_capabilities
set description = 'Issue provider-backed refunds from restaurant order management'
where capability = 'issue_refunds';

alter table public.refunds drop constraint refunds_status_check;
alter table public.refunds add constraint refunds_status_check check (
  status in ('requested', 'processing', 'unknown', 'succeeded', 'failed', 'cancelled')
);

create or replace function private.enforce_refund_status_progression_v1()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status in ('succeeded', 'failed', 'cancelled') and new.status <> old.status then
    new.status := old.status;
  elsif old.status = 'processing' and new.status = 'requested' then
    new.status := old.status;
  elsif old.status = 'unknown' and new.status in ('requested', 'processing') then
    new.status := old.status;
  end if;
  return new;
end;
$$;

create trigger refunds_enforce_status_progression
before update of status on public.refunds
for each row execute function private.enforce_refund_status_progression_v1();

create or replace function public.record_refund_command_result_v1(
  p_refund_id uuid,
  p_status text,
  p_provider_refund_reference text default null,
  p_provider_status text default null,
  p_failure_category text default null,
  p_failure_code text default null,
  p_failure_message text default null,
  p_provider_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  refund_record public.refunds%rowtype;
  payment_record public.payments%rowtype;
  old_state jsonb;
  next_status text;
begin
  if p_status not in ('processing', 'unknown', 'failed')
    or jsonb_typeof(p_provider_metadata) <> 'object'
  then
    raise exception using message = 'MM_INVALID_PAYMENT_EVENT|Refund command result is invalid.';
  end if;

  select * into refund_record from public.refunds where id = p_refund_id for update;
  if not found then
    raise exception using message = 'MM_PAYMENT_NOT_FOUND|Refund was not found.';
  end if;
  select * into payment_record from public.payments where id = refund_record.payment_id for update;
  if refund_record.provider_refund_reference is not null
    and p_provider_refund_reference is not null
    and refund_record.provider_refund_reference <> p_provider_refund_reference
  then
    raise exception using message = 'MM_INVALID_PAYMENT_EVENT|Provider refund reference changed unexpectedly.';
  end if;

  old_state := jsonb_build_object('refund', refund_record.status, 'payment', payment_record.status);
  next_status := case
    when refund_record.status in ('succeeded', 'failed', 'cancelled') then refund_record.status
    when refund_record.status = 'unknown' and p_status = 'processing' then 'unknown'
    else p_status
  end;
  update public.refunds
  set status = next_status,
      provider_refund_reference = coalesce(provider_refund_reference, p_provider_refund_reference),
      provider_status = p_provider_status,
      failure_category = case when next_status in ('failed', 'unknown')
        then coalesce(p_failure_category, failure_category) else null end,
      failure_code = case when next_status = 'failed'
        then coalesce(p_failure_code, failure_code) else null end,
      failure_message = case when next_status = 'failed'
        then coalesce(left(p_failure_message, 500), failure_message) else null end,
      provider_metadata = provider_metadata || p_provider_metadata
  where id = refund_record.id;

  select * into refund_record from public.refunds where id = refund_record.id;
  insert into public.payment_state_transitions (
    restaurant_id, payment_id, refund_id, source, event_type, previous_state, next_state
  ) values (
    refund_record.restaurant_id, refund_record.payment_id, refund_record.id,
    'command', 'refund.command_result', old_state,
    jsonb_build_object('refund', refund_record.status, 'payment', payment_record.status)
  );
  return jsonb_build_object(
    'refundId', refund_record.id, 'paymentId', refund_record.payment_id,
    'connectionId', refund_record.connection_id, 'status', refund_record.status,
    'providerRefundReference', refund_record.provider_refund_reference
  );
end;
$$;

create or replace function public.reserve_managed_refund_v1(
  p_restaurant_slug text,
  p_order_id uuid,
  p_amount_cents integer,
  p_reason text,
  p_client_action_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  access_record record;
  order_record public.orders%rowtype;
  payment_record public.payments%rowtype;
  connection_record public.restaurant_payment_connections%rowtype;
  refund_record public.refunds%rowtype;
  attempt_record public.payment_attempts%rowtype;
  policy_record public.restaurant_refund_policies%rowtype;
  reserved_total bigint;
  normalized_reason text := btrim(coalesce(p_reason, ''));
  refund_uuid uuid := gen_random_uuid();
begin
  select * into strict access_record
  from private.require_restaurant_capability_v1(p_restaurant_slug, 'issue_refunds');

  if p_client_action_id is null or p_amount_cents is null or p_amount_cents <= 0
    or normalized_reason = '' or char_length(normalized_reason) > 500
  then
    raise exception using message = 'MM_MANAGEMENT_INVALID_REQUEST|Enter a valid refund amount and reason.';
  end if;

  select * into order_record from public.orders order_value
  where order_value.id = p_order_id
    and order_value.restaurant_id = access_record.restaurant_id;
  if not found then
    raise exception using message = 'MM_MANAGEMENT_NOT_FOUND|Order was not found.';
  end if;

  select * into payment_record from public.payments payment
  where payment.order_id = order_record.id
    and payment.restaurant_id = access_record.restaurant_id
  for update;
  if not found then
    raise exception using message = 'MM_MANAGEMENT_INVALID_REQUEST|This order has no refundable payment.';
  end if;

  select * into refund_record from public.refunds refund
  where refund.payment_id = payment_record.id
    and refund.idempotency_key = p_client_action_id;
  if found then
    if refund_record.amount_cents <> p_amount_cents
      or coalesce(refund_record.reason, '') <> normalized_reason
    then
      raise exception using message = 'MM_MANAGEMENT_CONFLICT|This refund action was already used with different details.';
    end if;
  else
    select * into policy_record from public.restaurant_refund_policies policy
    where policy.restaurant_id = access_record.restaurant_id;
    if policy_record.restaurant_id is null
      or coalesce(order_record.placed_at, order_record.created_at)
        + make_interval(days => policy_record.refund_window_days) < now()
    then
      raise exception using message = 'MM_MANAGEMENT_INVALID_REQUEST|This order is outside the restaurant refund window.';
    end if;
    if payment_record.captured_cents <= 0
      or payment_record.status not in ('succeeded', 'partially_refunded', 'refunded')
    then
      raise exception using message = 'MM_MANAGEMENT_INVALID_REQUEST|This payment is not refundable.';
    end if;

    select * into connection_record from public.restaurant_payment_connections connection
    where connection.id = payment_record.connection_id
      and connection.restaurant_id = access_record.restaurant_id;
    if connection_record.connection_status <> 'active'
      or not ('refunds' = any(connection_record.capabilities))
    then
      raise exception using message = 'MM_MANAGEMENT_UNAVAILABLE|The payment provider cannot accept refunds.';
    end if;
    select * into attempt_record from public.payment_attempts attempt
    where attempt.payment_id = payment_record.id
      and attempt.connection_id = payment_record.connection_id
      and attempt.status = 'succeeded'
      and attempt.provider_payment_reference is not null
    order by attempt.created_at desc, attempt.id desc limit 1;
    if not found then
      raise exception using message = 'MM_MANAGEMENT_UNAVAILABLE|The original provider payment is unavailable.';
    end if;

    select coalesce(sum(refund.amount_cents), 0) into reserved_total
    from public.refunds refund
    where refund.payment_id = payment_record.id
      and refund.status in ('requested', 'processing', 'unknown', 'succeeded');
    if reserved_total + p_amount_cents > payment_record.captured_cents then
      raise exception using message = 'MM_MANAGEMENT_CONFLICT|Refund exceeds the remaining refundable amount.';
    end if;

    insert into public.refunds (
      id, restaurant_id, payment_id, connection_id, amount_cents, currency,
      reason, requested_by, idempotency_key, provider_idempotency_key
    ) values (
      refund_uuid, access_record.restaurant_id, payment_record.id, payment_record.connection_id,
      p_amount_cents, payment_record.currency, normalized_reason,
      access_record.membership_id::text, p_client_action_id, refund_uuid::text
    ) returning * into refund_record;
    insert into public.payment_state_transitions (
      restaurant_id, payment_id, refund_id, source, event_type, previous_state, next_state
    ) values (
      access_record.restaurant_id, payment_record.id, refund_record.id, 'command',
      'refund.requested', jsonb_build_object('refund', null),
      jsonb_build_object('refund', 'requested')
    );
  end if;

  select * into connection_record from public.restaurant_payment_connections connection
  where connection.id = payment_record.connection_id;
  select * into attempt_record from public.payment_attempts attempt
  where attempt.payment_id = payment_record.id
    and attempt.connection_id = payment_record.connection_id
    and attempt.status = 'succeeded'
    and attempt.provider_payment_reference is not null
  order by attempt.created_at desc, attempt.id desc limit 1;
  if not found then
    raise exception using message = 'MM_MANAGEMENT_UNAVAILABLE|The original provider payment is unavailable.';
  end if;

  return jsonb_build_object(
    'refundId', refund_record.id, 'paymentId', refund_record.payment_id,
    'connectionId', refund_record.connection_id, 'provider', connection_record.provider_key,
    'providerEnvironment', connection_record.environment,
    'providerIdempotencyKey', refund_record.provider_idempotency_key,
    'providerPaymentReference', attempt_record.provider_payment_reference,
    'amountCents', refund_record.amount_cents, 'currency', refund_record.currency,
    'status', refund_record.status, 'replayed', refund_record.id <> refund_uuid
  );
end;
$$;

create or replace function public.get_managed_order_refunds_v1(
  p_restaurant_slug text,
  p_order_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  access_record record;
  order_record public.orders%rowtype;
  payment_record public.payments%rowtype;
  policy_record public.restaurant_refund_policies%rowtype;
  connection_record public.restaurant_payment_connections%rowtype;
  active_refund_total bigint := 0;
  pending_refund_total bigint := 0;
  policy_ends_at timestamptz;
begin
  select * into strict access_record
  from private.require_restaurant_capability_v1(p_restaurant_slug, 'view_orders');
  select * into order_record from public.orders order_value
  where order_value.id = p_order_id and order_value.restaurant_id = access_record.restaurant_id;
  if not found then raise exception using message = 'MM_MANAGEMENT_NOT_FOUND|Order was not found.'; end if;
  select * into payment_record from public.payments payment where payment.order_id = order_record.id;
  select * into policy_record from public.restaurant_refund_policies policy
  where policy.restaurant_id = access_record.restaurant_id;
  select * into connection_record from public.restaurant_payment_connections connection
  where connection.id = payment_record.connection_id;
  select coalesce(sum(refund.amount_cents), 0) into active_refund_total
  from public.refunds refund where refund.payment_id = payment_record.id
    and refund.status in ('requested', 'processing', 'unknown', 'succeeded');
  select coalesce(sum(refund.amount_cents), 0) into pending_refund_total
  from public.refunds refund where refund.payment_id = payment_record.id
    and refund.status in ('requested', 'processing', 'unknown');
  policy_ends_at := coalesce(order_record.placed_at, order_record.created_at)
    + make_interval(days => policy_record.refund_window_days);

  return jsonb_build_object(
    'payment', jsonb_build_object(
      'status', order_record.payment_status, 'paidAt', payment_record.succeeded_at,
      'refundedCents', payment_record.refunded_cents,
      'capturedCents', payment_record.captured_cents,
      'refundableCents', greatest(payment_record.captured_cents - active_refund_total, 0),
      'pendingRefundCents', pending_refund_total,
      'refundPolicyEligible', policy_ends_at >= now(),
      'refundPolicyEndsAt', policy_ends_at,
      'refundProviderAvailable', connection_record.connection_status = 'active'
        and 'refunds' = any(connection_record.capabilities),
      'refunds', coalesce((
        select jsonb_agg(jsonb_build_object(
          'refundId', refund.id, 'amountCents', refund.amount_cents,
          'status', refund.status, 'reason', refund.reason,
          'requestedAt', refund.created_at, 'completedAt', refund.completed_at,
          'requestedBy', membership.display_name
        ) order by refund.created_at desc, refund.id desc)
        from public.refunds refund
        left join public.restaurant_memberships membership
          on membership.id::text = refund.requested_by
          and membership.restaurant_id = refund.restaurant_id
        where refund.payment_id = payment_record.id
      ), '[]'::jsonb)
    ),
    'timeline', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', 'refund:' || transition.id::text, 'kind', 'refund',
        'label', case
          when transition.event_type = 'refund.requested' then 'Refund requested — '
          when transition.event_type = 'refund.succeeded' then 'Refund completed — '
          when transition.event_type = 'refund.failed' then 'Refund failed — '
          when transition.next_state ->> 'refund' = 'unknown' then 'Refund requires review — '
          when transition.next_state ->> 'refund' = 'failed' then 'Refund failed — '
          else 'Refund processing — ' end
          || case when refund.currency = 'USD' then '$' else refund.currency || ' ' end
          || (refund.amount_cents / 100.0)::numeric(12,2)::text,
        'actorName', case when transition.event_type = 'refund.requested'
          then membership.display_name else null end,
        'occurredAt', transition.created_at
      ) order by transition.created_at, transition.id)
      from public.payment_state_transitions transition
      join public.refunds refund on refund.id = transition.refund_id
      left join public.restaurant_memberships membership
        on membership.id::text = refund.requested_by
        and membership.restaurant_id = refund.restaurant_id
      where transition.payment_id = payment_record.id
        and (transition.event_type in ('refund.requested', 'refund.processing', 'refund.succeeded', 'refund.failed')
          or transition.event_type = 'refund.command_result')
    ), '[]'::jsonb)
  );
end;
$$;

alter table public.notification_outbox add column payload jsonb not null default '{}'::jsonb;
alter table public.notification_outbox add constraint notification_outbox_payload_object_check
  check (jsonb_typeof(payload) = 'object');

create or replace function private.protect_notification_outbox_v1()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then raise exception 'Notification outbox records cannot be deleted.'; end if;
  if old.restaurant_id is distinct from new.restaurant_id
    or old.order_id is distinct from new.order_id
    or old.notification_type is distinct from new.notification_type
    or old.channel is distinct from new.channel
    or old.recipient is distinct from new.recipient
    or old.idempotency_key is distinct from new.idempotency_key
    or old.payload is distinct from new.payload
    or old.created_at is distinct from new.created_at
  then
    raise exception 'Notification outbox event identity is immutable.';
  end if;
  return new;
end;
$$;

create or replace function private.enqueue_refund_notification_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  order_record public.orders%rowtype;
  payment_record public.payments%rowtype;
  enabled boolean;
  confirmed_total bigint;
begin
  if new.status = 'succeeded' and old.status is distinct from new.status then
    select payment.* into payment_record from public.payments payment where payment.id = new.payment_id;
    select order_value.* into order_record from public.orders order_value
    where order_value.id = payment_record.order_id and order_value.restaurant_id = new.restaurant_id;
    select settings.customer_refund_confirmation_email into enabled
    from public.restaurant_notification_settings settings where settings.restaurant_id = new.restaurant_id;
    select coalesce(sum(refund.amount_cents), 0) into confirmed_total
    from public.refunds refund where refund.payment_id = new.payment_id and refund.status = 'succeeded';
    if coalesce(enabled, false) and nullif(btrim(order_record.customer_email), '') is not null then
      insert into public.notification_outbox (
        restaurant_id, order_id, notification_type, recipient, idempotency_key, payload
      ) values (
        new.restaurant_id, order_record.id, 'customer.refund_confirmed',
        lower(btrim(order_record.customer_email)), 'customer.refund_confirmed/' || new.id::text,
        jsonb_build_object(
          'refundAmountCents', new.amount_cents, 'currency', new.currency,
          'refundType', case when confirmed_total = payment_record.captured_cents then 'full' else 'partial' end
        )
      ) on conflict (idempotency_key) do nothing;
    end if;
  end if;
  return new;
end;
$$;

drop function public.claim_notification_outbox_v1(integer);
create function public.claim_notification_outbox_v1(p_limit integer default 5)
returns table (
  outbox_id uuid, claim_token uuid, attempt_number integer,
  notification_type text, recipient text, idempotency_key text,
  restaurant_name text, order_number text, pickup_mode text,
  pickup_at timestamptz, pickup_timezone text,
  restaurant_address_line1 text, restaurant_city text, restaurant_state text,
  restaurant_postal_code text, google_maps_url text, customer_email text,
  refund_amount_cents integer, currency text, refund_type text
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_limit not between 1 and 20 then raise exception 'Notification claim limit is invalid.'; end if;
  update public.notification_outbox outbox
  set status = 'permanent_failure', lease_token = null, next_attempt_at = null,
      last_error = coalesce(outbox.last_error, 'Delivery lease expired after the final attempt.')
  where outbox.status = 'delivering' and outbox.attempt_count >= 8 and outbox.next_attempt_at <= now();
  return query
  with candidates as (
    select outbox.id from public.notification_outbox outbox
    where outbox.attempt_count < 8 and outbox.available_at <= now()
      and (outbox.status in ('pending', 'retry')
        or (outbox.status = 'delivering' and outbox.next_attempt_at <= now()))
      and coalesce(outbox.next_attempt_at, outbox.available_at) <= now()
    order by coalesce(outbox.next_attempt_at, outbox.available_at), outbox.created_at, outbox.id
    for update skip locked limit p_limit
  ), claimed as (
    update public.notification_outbox outbox
    set status = 'delivering', attempt_count = outbox.attempt_count + 1,
        lease_token = gen_random_uuid(), last_attempt_at = now(),
        next_attempt_at = now() + interval '5 minutes'
    from candidates where outbox.id = candidates.id returning outbox.*
  )
  select claimed.id, claimed.lease_token, claimed.attempt_count,
         claimed.notification_type, claimed.recipient, claimed.idempotency_key,
         restaurant.name, order_record.order_number::text, order_record.pickup_mode,
         order_record.pickup_at, order_record.pickup_timezone,
         restaurant.address_line1, restaurant.city, restaurant.state,
         restaurant.postal_code, restaurant.google_maps_url, order_record.customer_email,
         (claimed.payload ->> 'refundAmountCents')::integer,
         claimed.payload ->> 'currency', claimed.payload ->> 'refundType'
  from claimed join public.restaurants restaurant on restaurant.id = claimed.restaurant_id
  join public.orders order_record on order_record.id = claimed.order_id
    and order_record.restaurant_id = claimed.restaurant_id;
end;
$$;

revoke all on function private.enforce_refund_status_progression_v1() from public, anon, authenticated;
revoke all on function public.reserve_managed_refund_v1(text, uuid, integer, text, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.reserve_managed_refund_v1(text, uuid, integer, text, uuid) to authenticated;
revoke all on function public.get_managed_order_refunds_v1(text, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.get_managed_order_refunds_v1(text, uuid) to authenticated;
revoke all on function public.record_refund_command_result_v1(uuid, text, text, text, text, text, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.record_refund_command_result_v1(uuid, text, text, text, text, text, text, jsonb)
  to service_role;
revoke all on function public.claim_notification_outbox_v1(integer)
  from public, anon, authenticated;
grant execute on function public.claim_notification_outbox_v1(integer) to service_role;

commit;
