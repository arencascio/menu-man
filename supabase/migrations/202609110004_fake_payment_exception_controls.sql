-- Staging-only controls for deterministic fake-provider exceptional states.
-- All functions authenticate the guest capability, require a fake/test
-- connection, and reserve one action against the existing payment attempt.

create or replace function public.menu_man_terminal_payment_failure_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  payment_record public.payments%rowtype;
  order_record public.orders%rowtype;
  failure_reason text;
begin
  if new.status <> 'failed' or old.status = 'failed' then
    return new;
  end if;

  select * into payment_record
  from public.payments
  where id = new.payment_id
  for update;

  select * into order_record
  from public.orders
  where id = payment_record.order_id
  for update;

  if payment_record.status in ('succeeded', 'partially_refunded', 'refunded')
    or order_record.order_status <> 'pending_payment'
  then
    return new;
  end if;

  failure_reason := case
    when new.failure_category = 'provider_decline' then 'payment_declined'
    when new.failure_category = 'authorization_voided' then 'authorization_voided'
    else 'payment_failed'
  end;

  update public.orders
  set order_status = 'cancelled',
      payment_status = 'failed',
      cancelled_at = coalesce(cancelled_at, now()),
      cancellation_reason = failure_reason
  where id = order_record.id
    and order_status = 'pending_payment';

  if found then
    insert into public.payment_state_transitions (
      restaurant_id, payment_id, payment_attempt_id, source, event_type,
      previous_state, next_state
    ) values (
      payment_record.restaurant_id, payment_record.id, new.id, 'reconciliation',
      'payment.terminal_failure',
      jsonb_build_object(
        'payment', payment_record.status,
        'attempt', old.status,
        'order', order_record.order_status,
        'orderPayment', order_record.payment_status
      ),
      jsonb_build_object(
        'payment', 'failed',
        'attempt', 'failed',
        'order', 'cancelled',
        'orderPayment', 'failed',
        'cancellationReason', failure_reason
      )
    );
  end if;

  return new;
end;
$$;

create or replace function public.reserve_fake_authorization_action_v1(
  p_order_id uuid,
  p_access_token_hash text,
  p_action text,
  p_client_action_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  payment_record public.payments%rowtype;
  attempt_record public.payment_attempts%rowtype;
  order_record public.orders%rowtype;
  connection_record public.restaurant_payment_connections%rowtype;
  existing_action text;
  replayed boolean := false;
begin
  if p_access_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception using message = 'MM_INVALID_PAYMENT_SESSION|Payment session token is invalid.';
  end if;
  if p_action not in ('capture', 'void') then
    raise exception using message = 'MM_INVALID_PAYMENT_EVENT|Authorization action is invalid.';
  end if;

  select payment.* into payment_record
  from public.payment_checkout_sessions session
  join public.payments payment on payment.id = session.payment_id
  where payment.order_id = p_order_id
    and session.access_token_hash = p_access_token_hash
    and session.revoked_at is null
    and session.expires_at > now()
  for update of payment;

  if not found then
    raise exception using message = 'MM_INVALID_PAYMENT_SESSION|Payment session is invalid or expired.';
  end if;

  select * into order_record from public.orders order_row
  where order_row.id = payment_record.order_id for update;
  select * into connection_record from public.restaurant_payment_connections connection
  where connection.id = payment_record.connection_id;
  select * into attempt_record from public.payment_attempts attempt
  where attempt.payment_id = payment_record.id
  order by attempt.created_at desc
  limit 1
  for update;

  if connection_record.provider_key <> 'fake'
    or connection_record.environment <> 'test'
    or connection_record.connection_status <> 'active'
    or not ('manual_capture' = any(connection_record.capabilities))
  then
    raise exception using message = 'MM_PAYMENT_PROVIDER_UNAVAILABLE|Fake authorization controls are unavailable.';
  end if;
  if attempt_record.id is null or attempt_record.provider_payment_reference is null then
    raise exception using message = 'MM_PAYMENT_NOT_ALLOWED|The authorization cannot be changed.';
  end if;

  existing_action := attempt_record.provider_metadata ->> 'authorizationAction';
  if existing_action is not null then
    if existing_action <> p_action then
      raise exception using message = 'MM_PAYMENT_IN_PROGRESS|A different authorization action is already in progress.';
    end if;
    replayed := true;
  else
    if payment_record.status <> 'authorized'
      or attempt_record.status <> 'authorized'
      or order_record.order_status <> 'pending_payment'
    then
      raise exception using message = 'MM_PAYMENT_NOT_ALLOWED|This payment is not awaiting capture or void.';
    end if;

    update public.payment_attempts attempt
    set provider_metadata = attempt.provider_metadata || jsonb_build_object(
      'authorizationAction', p_action,
      'authorizationActionKey', p_client_action_key
    )
    where attempt.id = attempt_record.id
    returning * into attempt_record;

    insert into public.payment_state_transitions (
      restaurant_id, payment_id, payment_attempt_id, source, event_type,
      previous_state, next_state
    ) values (
      payment_record.restaurant_id, payment_record.id, attempt_record.id,
      'command', 'payment.authorization_action_reserved',
      jsonb_build_object('payment', payment_record.status, 'attempt', attempt_record.status),
      jsonb_build_object(
        'payment', payment_record.status,
        'attempt', attempt_record.status,
        'authorizationAction', p_action
      )
    );
  end if;

  return jsonb_build_object(
    'action', p_action,
    'attemptId', attempt_record.id,
    'paymentId', payment_record.id,
    'orderId', payment_record.order_id,
    'connectionId', payment_record.connection_id,
    'provider', connection_record.provider_key,
    'providerEnvironment', connection_record.environment,
    'providerIdempotencyKey', attempt_record.provider_idempotency_key || ':' || p_action,
    'providerPaymentReference', attempt_record.provider_payment_reference,
    'amountCents', payment_record.amount_cents,
    'currency', payment_record.currency,
    'attemptStatus', attempt_record.status,
    'replayed', replayed
  );
end;
$$;

create or replace function public.reserve_fake_late_success_resolution_v1(
  p_order_id uuid,
  p_access_token_hash text,
  p_resolution text,
  p_client_action_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  payment_record public.payments%rowtype;
  attempt_record public.payment_attempts%rowtype;
  order_record public.orders%rowtype;
  connection_record public.restaurant_payment_connections%rowtype;
  existing_resolution text;
  resolution_key uuid;
  replayed boolean := false;
begin
  if p_access_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception using message = 'MM_INVALID_PAYMENT_SESSION|Payment session token is invalid.';
  end if;
  if p_resolution not in ('accepted', 'refunded') then
    raise exception using message = 'MM_INVALID_PAYMENT_EVENT|Late-success resolution is invalid.';
  end if;

  select payment.* into payment_record
  from public.payment_checkout_sessions session
  join public.payments payment on payment.id = session.payment_id
  where payment.order_id = p_order_id
    and session.access_token_hash = p_access_token_hash
    and session.revoked_at is null
    and session.expires_at > now()
  for update of payment;

  if not found then
    raise exception using message = 'MM_INVALID_PAYMENT_SESSION|Payment session is invalid or expired.';
  end if;

  select * into order_record from public.orders order_row
  where order_row.id = payment_record.order_id for update;
  select * into connection_record from public.restaurant_payment_connections connection
  where connection.id = payment_record.connection_id;
  select * into attempt_record from public.payment_attempts attempt
  where attempt.payment_id = payment_record.id
  order by attempt.created_at desc
  limit 1
  for update;

  if connection_record.provider_key <> 'fake'
    or connection_record.environment <> 'test'
    or connection_record.connection_status <> 'active'
  then
    raise exception using message = 'MM_PAYMENT_PROVIDER_UNAVAILABLE|Fake late-success controls are unavailable.';
  end if;
  if attempt_record.id is null or attempt_record.provider_payment_reference is null
    or not exists (
      select 1 from public.analytics_outbox outbox
      where outbox.event_type = 'payment_late_success'
        and outbox.aggregate_type = 'payment'
        and outbox.aggregate_id = payment_record.id
    )
  then
    raise exception using message = 'MM_PAYMENT_NOT_ALLOWED|This payment is not a quarantined late success.';
  end if;

  existing_resolution := attempt_record.provider_metadata ->> 'lateSuccessResolution';
  if existing_resolution is not null then
    if existing_resolution <> p_resolution then
      raise exception using message = 'MM_PAYMENT_IN_PROGRESS|A different late-success resolution is already in progress.';
    end if;
    resolution_key := (attempt_record.provider_metadata ->> 'lateSuccessResolutionKey')::uuid;
    replayed := true;
  else
    if payment_record.status <> 'succeeded'
      or attempt_record.status <> 'succeeded'
      or order_record.order_status <> 'cancelled'
      or order_record.payment_status <> 'paid'
    then
      raise exception using message = 'MM_PAYMENT_NOT_ALLOWED|This late success cannot be resolved.';
    end if;

    resolution_key := p_client_action_key;
    update public.payment_attempts attempt
    set provider_metadata = attempt.provider_metadata || jsonb_build_object(
      'lateSuccessResolution', p_resolution,
      'lateSuccessResolutionKey', resolution_key
    )
    where attempt.id = attempt_record.id
    returning * into attempt_record;

    insert into public.payment_state_transitions (
      restaurant_id, payment_id, payment_attempt_id, source, event_type,
      previous_state, next_state
    ) values (
      payment_record.restaurant_id, payment_record.id, attempt_record.id,
      'command', 'payment.late_success_resolution_reserved',
      jsonb_build_object('payment', payment_record.status, 'order', order_record.order_status),
      jsonb_build_object(
        'payment', payment_record.status,
        'order', order_record.order_status,
        'lateSuccessResolution', p_resolution
      )
    );
  end if;

  return jsonb_build_object(
    'resolution', p_resolution,
    'resolutionKey', resolution_key,
    'attemptId', attempt_record.id,
    'paymentId', payment_record.id,
    'orderId', payment_record.order_id,
    'connectionId', payment_record.connection_id,
    'provider', connection_record.provider_key,
    'providerEnvironment', connection_record.environment,
    'providerPaymentReference', attempt_record.provider_payment_reference,
    'amountCents', payment_record.amount_cents,
    'currency', payment_record.currency,
    'replayed', replayed
  );
end;
$$;

create or replace function public.accept_fake_late_success_v1(
  p_order_id uuid,
  p_access_token_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  payment_record public.payments%rowtype;
  attempt_record public.payment_attempts%rowtype;
  order_record public.orders%rowtype;
  connection_record public.restaurant_payment_connections%rowtype;
begin
  select payment.* into payment_record
  from public.payment_checkout_sessions session
  join public.payments payment on payment.id = session.payment_id
  where payment.order_id = p_order_id
    and session.access_token_hash = p_access_token_hash
    and session.revoked_at is null
    and session.expires_at > now()
  for update of payment;

  if not found then
    raise exception using message = 'MM_INVALID_PAYMENT_SESSION|Payment session is invalid or expired.';
  end if;

  select * into order_record from public.orders order_row
  where order_row.id = payment_record.order_id for update;
  select * into connection_record from public.restaurant_payment_connections connection
  where connection.id = payment_record.connection_id;
  select * into attempt_record from public.payment_attempts attempt
  where attempt.payment_id = payment_record.id
  order by attempt.created_at desc
  limit 1
  for update;

  if connection_record.provider_key <> 'fake' or connection_record.environment <> 'test' then
    raise exception using message = 'MM_PAYMENT_PROVIDER_UNAVAILABLE|Fake late-success controls are unavailable.';
  end if;
  if attempt_record.provider_metadata ->> 'lateSuccessResolution' is distinct from 'accepted'
    or not exists (
      select 1 from public.analytics_outbox outbox
      where outbox.event_type = 'payment_late_success'
        and outbox.aggregate_type = 'payment'
        and outbox.aggregate_id = payment_record.id
    )
  then
    raise exception using message = 'MM_PAYMENT_NOT_ALLOWED|Late-success acceptance was not reserved.';
  end if;

  if order_record.order_status = 'placed' and order_record.payment_status = 'paid' then
    return public.menu_man_payment_response_v1(payment_record.id);
  end if;
  if payment_record.status <> 'succeeded'
    or attempt_record.status <> 'succeeded'
    or order_record.order_status <> 'cancelled'
    or order_record.payment_status <> 'paid'
  then
    raise exception using message = 'MM_PAYMENT_NOT_ALLOWED|This late success cannot be accepted.';
  end if;

  update public.orders order_row
  set order_status = 'placed',
      payment_status = 'paid',
      placed_at = coalesce(order_row.placed_at, now()),
      cancelled_at = null,
      cancellation_reason = null
  where order_row.id = order_record.id;

  insert into public.analytics_outbox (event_type, aggregate_type, aggregate_id, payload)
  values (
    'purchase', 'payment', payment_record.id,
    jsonb_build_object(
      'transactionId', payment_record.id,
      'name', 'purchase',
      'paymentId', payment_record.id,
      'orderId', order_record.id,
      'orderNumber', order_record.order_number::text,
      'restaurantId', order_record.restaurant_id,
      'currency', order_record.currency,
      'revenueCents', order_record.total_cents,
      'taxCents', order_record.tax_cents,
      'tipCents', order_record.tip_cents,
      'items', coalesce((
        select jsonb_agg(jsonb_build_object(
          'itemId', item.menu_item_id,
          'itemName', item.item_name,
          'priceCents', item.unit_price_cents,
          'quantity', item.quantity
        ) order by item.sort_order)
        from public.order_items item where item.order_id = order_record.id
      ), '[]'::jsonb)
    )
  ) on conflict (event_type, aggregate_type, aggregate_id) do nothing;

  insert into public.payment_state_transitions (
    restaurant_id, payment_id, payment_attempt_id, source, event_type,
    previous_state, next_state
  ) values (
    payment_record.restaurant_id, payment_record.id, attempt_record.id,
    'reconciliation', 'payment.late_success_accepted',
    jsonb_build_object(
      'payment', payment_record.status,
      'order', order_record.order_status,
      'orderPayment', order_record.payment_status,
      'cancellationReason', order_record.cancellation_reason
    ),
    jsonb_build_object('payment', 'succeeded', 'order', 'placed', 'orderPayment', 'paid')
  );

  return public.menu_man_payment_response_v1(payment_record.id);
end;
$$;

revoke all on function public.menu_man_terminal_payment_failure_v1()
  from public, anon, authenticated, service_role;
revoke all on function public.reserve_fake_authorization_action_v1(uuid, text, text, uuid)
  from public, anon, authenticated;
revoke all on function public.reserve_fake_late_success_resolution_v1(uuid, text, text, uuid)
  from public, anon, authenticated;
revoke all on function public.accept_fake_late_success_v1(uuid, text)
  from public, anon, authenticated;

grant execute on function public.reserve_fake_authorization_action_v1(uuid, text, text, uuid)
  to service_role;
grant execute on function public.reserve_fake_late_success_resolution_v1(uuid, text, text, uuid)
  to service_role;
grant execute on function public.accept_fake_late_success_v1(uuid, text)
  to service_role;
