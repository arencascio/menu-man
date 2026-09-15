-- Restaurant notification preferences, an idempotent operational-email outbox,
-- retry-safe delivery claims, tenant-safe export additions, and staging SEO
-- control. Business/payment authority remains in the existing checkout,
-- payment-event, and fulfillment functions.

begin;

alter table public.restaurants
  add column if not exists is_indexable boolean not null default true;

insert into public.restaurant_capabilities (capability, description)
values ('manage_notifications', 'Manage restaurant customer and internal notification preferences')
on conflict (capability) do update set description = excluded.description;

insert into public.restaurant_role_capability_defaults (role, capability, allowed)
values
  ('owner', 'manage_notifications', true),
  ('manager', 'manage_notifications', true),
  ('staff', 'manage_notifications', false)
on conflict (role, capability) do update set allowed = excluded.allowed;

create table public.restaurant_notification_settings (
  restaurant_id uuid primary key references public.restaurants(id) on delete restrict,
  customer_order_confirmation_email boolean not null default true,
  customer_ready_for_pickup_email boolean not null default true,
  customer_refund_confirmation_email boolean not null default true,
  internal_new_paid_order_email boolean not null default false,
  internal_payment_refund_exception_email boolean not null default false,
  internal_email_recipient text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint restaurant_notification_settings_recipient_check check (
    internal_email_recipient is null or (
      btrim(internal_email_recipient) <> ''
      and char_length(internal_email_recipient) <= 320
      and internal_email_recipient ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    )
  ),
  constraint restaurant_notification_settings_internal_recipient_required_check check (
    not (internal_new_paid_order_email or internal_payment_refund_exception_email)
    or internal_email_recipient is not null
  )
);

insert into public.restaurant_notification_settings (restaurant_id)
select restaurant.id from public.restaurants restaurant
on conflict (restaurant_id) do nothing;

create trigger restaurant_notification_settings_set_updated_at
before update on public.restaurant_notification_settings
for each row execute function public.set_menu_man_updated_at();

create or replace function public.initialize_restaurant_notification_settings_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.restaurant_notification_settings (restaurant_id)
  values (new.id)
  on conflict (restaurant_id) do nothing;
  return new;
end;
$$;

create trigger restaurants_initialize_notification_settings
after insert on public.restaurants
for each row execute function public.initialize_restaurant_notification_settings_v1();

create table public.restaurant_notification_setting_events (
  id bigint generated always as identity primary key,
  restaurant_id uuid not null references public.restaurants(id) on delete restrict,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  actor_membership_id uuid not null,
  actor_role_snapshot text not null,
  client_action_id uuid not null,
  action text not null,
  previous_state jsonb not null,
  next_state jsonb not null,
  created_at timestamptz not null default now(),
  constraint restaurant_notification_setting_events_membership_fkey
    foreign key (restaurant_id, actor_membership_id)
    references public.restaurant_memberships(restaurant_id, id) on delete restrict,
  constraint restaurant_notification_setting_events_role_check
    check (actor_role_snapshot in ('owner', 'manager', 'staff')),
  constraint restaurant_notification_setting_events_action_check
    check (action = 'notifications.settings_updated'),
  constraint restaurant_notification_setting_events_state_check
    check (jsonb_typeof(previous_state) = 'object' and jsonb_typeof(next_state) = 'object'),
  constraint restaurant_notification_setting_events_action_key
    unique (restaurant_id, client_action_id)
);

create index restaurant_notification_setting_events_restaurant_created_idx
  on public.restaurant_notification_setting_events (restaurant_id, created_at desc, id desc);

create table public.notification_outbox (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete restrict,
  order_id uuid not null,
  notification_type text not null,
  channel text not null default 'email',
  recipient text not null,
  status text not null default 'pending',
  attempt_count integer not null default 0,
  available_at timestamptz not null default now(),
  next_attempt_at timestamptz,
  lease_token uuid,
  provider_message_id text,
  last_error text,
  last_attempt_at timestamptz,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  idempotency_key text not null,
  constraint notification_outbox_order_fkey
    foreign key (restaurant_id, order_id)
    references public.orders(restaurant_id, id) on delete restrict,
  constraint notification_outbox_type_check check (notification_type in (
    'customer.order_confirmed', 'customer.ready_for_pickup',
    'customer.refund_confirmed', 'internal.new_paid_order',
    'internal.payment_refund_exception'
  )),
  constraint notification_outbox_channel_check check (channel = 'email'),
  constraint notification_outbox_recipient_check check (
    btrim(recipient) <> '' and char_length(recipient) <= 320
  ),
  constraint notification_outbox_status_check check (
    status in ('pending', 'delivering', 'retry', 'sent', 'permanent_failure')
  ),
  constraint notification_outbox_attempt_count_check check (attempt_count >= 0),
  constraint notification_outbox_idempotency_key_check check (
    btrim(idempotency_key) <> '' and char_length(idempotency_key) <= 256
  ),
  constraint notification_outbox_idempotency_key_key unique (idempotency_key)
);

create index notification_outbox_due_idx
  on public.notification_outbox (coalesce(next_attempt_at, available_at), created_at, id)
  where status in ('pending', 'retry', 'delivering');
create index notification_outbox_restaurant_created_idx
  on public.notification_outbox (restaurant_id, created_at desc, id desc);

create table public.notification_delivery_attempts (
  id bigint generated always as identity primary key,
  notification_outbox_id uuid not null references public.notification_outbox(id) on delete restrict,
  attempt_number integer not null,
  outcome text not null,
  http_status integer,
  provider_message_id text,
  error_code text,
  error_message text,
  created_at timestamptz not null default now(),
  constraint notification_delivery_attempts_number_check check (attempt_number > 0),
  constraint notification_delivery_attempts_outcome_check check (
    outcome in ('sent', 'retryable_failure', 'permanent_failure')
  ),
  constraint notification_delivery_attempts_error_check check (
    error_code is null or char_length(error_code) <= 100
  ),
  constraint notification_delivery_attempts_message_check check (
    error_message is null or char_length(error_message) <= 1000
  ),
  constraint notification_delivery_attempts_outbox_number_key
    unique (notification_outbox_id, attempt_number)
);

create index notification_delivery_attempts_outbox_created_idx
  on public.notification_delivery_attempts (notification_outbox_id, created_at, id);

create or replace function private.prevent_notification_audit_mutation_v1()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Notification audit records are append-only.';
end;
$$;

create trigger restaurant_notification_setting_events_append_only
before update or delete on public.restaurant_notification_setting_events
for each row execute function private.prevent_notification_audit_mutation_v1();
create trigger notification_delivery_attempts_append_only
before update or delete on public.notification_delivery_attempts
for each row execute function private.prevent_notification_audit_mutation_v1();

create or replace function private.notification_settings_json_v1(
  p_settings public.restaurant_notification_settings
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'customerOrderConfirmationEmail', p_settings.customer_order_confirmation_email,
    'customerReadyForPickupEmail', p_settings.customer_ready_for_pickup_email,
    'customerRefundConfirmationEmail', p_settings.customer_refund_confirmation_email,
    'internalNewPaidOrderEmail', p_settings.internal_new_paid_order_email,
    'internalPaymentRefundExceptionEmail', p_settings.internal_payment_refund_exception_email,
    'internalEmailRecipient', p_settings.internal_email_recipient,
    'updatedAt', p_settings.updated_at
  );
$$;

create or replace function public.get_restaurant_notification_settings_v1(
  p_restaurant_slug text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  access_record record;
  settings_record public.restaurant_notification_settings%rowtype;
begin
  select * into strict access_record
  from private.require_restaurant_capability_v1(
    p_restaurant_slug, 'manage_notifications'
  );
  select settings.* into strict settings_record
  from public.restaurant_notification_settings settings
  where settings.restaurant_id = access_record.restaurant_id;
  return private.notification_settings_json_v1(settings_record);
end;
$$;

create or replace function public.update_restaurant_notification_settings_v1(
  p_restaurant_slug text,
  p_settings jsonb,
  p_client_action_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  access_record record;
  settings_record public.restaurant_notification_settings%rowtype;
  previous_state jsonb;
  next_state jsonb;
  setting_key text;
  replay_event public.restaurant_notification_setting_events%rowtype;
begin
  select * into strict access_record
  from private.require_restaurant_capability_v1(
    p_restaurant_slug, 'manage_notifications'
  );
  if p_settings is null or jsonb_typeof(p_settings) <> 'object' then
    raise exception using message = 'MM_MANAGEMENT_INVALID_REQUEST|Notification settings are invalid.';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(access_record.restaurant_id::text, 0));
  for setting_key in select jsonb_object_keys(p_settings)
  loop
    if setting_key not in (
      'customerOrderConfirmationEmail', 'customerReadyForPickupEmail',
      'customerRefundConfirmationEmail', 'internalNewPaidOrderEmail',
      'internalPaymentRefundExceptionEmail', 'internalEmailRecipient'
    ) then
      raise exception using message = 'MM_MANAGEMENT_INVALID_REQUEST|Notification settings are invalid.';
    end if;
  end loop;
  if not (p_settings ?& array[
      'customerOrderConfirmationEmail', 'customerReadyForPickupEmail',
      'customerRefundConfirmationEmail', 'internalNewPaidOrderEmail',
      'internalPaymentRefundExceptionEmail', 'internalEmailRecipient'
    ])
    or jsonb_typeof(p_settings -> 'customerOrderConfirmationEmail') <> 'boolean'
    or jsonb_typeof(p_settings -> 'customerReadyForPickupEmail') <> 'boolean'
    or jsonb_typeof(p_settings -> 'customerRefundConfirmationEmail') <> 'boolean'
    or jsonb_typeof(p_settings -> 'internalNewPaidOrderEmail') <> 'boolean'
    or jsonb_typeof(p_settings -> 'internalPaymentRefundExceptionEmail') <> 'boolean'
    or (
      jsonb_typeof(p_settings -> 'internalEmailRecipient') not in ('string', 'null')
    )
  then
    raise exception using message = 'MM_MANAGEMENT_INVALID_REQUEST|Notification settings are invalid.';
  end if;

  select event.* into replay_event
  from public.restaurant_notification_setting_events event
  where event.restaurant_id = access_record.restaurant_id
    and event.client_action_id = p_client_action_id;
  if found then
    return replay_event.next_state || jsonb_build_object(
      'updatedAt', replay_event.created_at, 'replayed', true,
      'changed', replay_event.previous_state is distinct from replay_event.next_state
    );
  end if;

  select settings.* into strict settings_record
  from public.restaurant_notification_settings settings
  where settings.restaurant_id = access_record.restaurant_id
  for update;
  previous_state := private.notification_settings_json_v1(settings_record) - 'updatedAt';

  update public.restaurant_notification_settings settings
  set customer_order_confirmation_email = (p_settings ->> 'customerOrderConfirmationEmail')::boolean,
      customer_ready_for_pickup_email = (p_settings ->> 'customerReadyForPickupEmail')::boolean,
      customer_refund_confirmation_email = (p_settings ->> 'customerRefundConfirmationEmail')::boolean,
      internal_new_paid_order_email = (p_settings ->> 'internalNewPaidOrderEmail')::boolean,
      internal_payment_refund_exception_email = (p_settings ->> 'internalPaymentRefundExceptionEmail')::boolean,
      internal_email_recipient = nullif(lower(btrim(p_settings ->> 'internalEmailRecipient')), '')
  where settings.restaurant_id = access_record.restaurant_id
  returning settings.* into settings_record;
  next_state := private.notification_settings_json_v1(settings_record) - 'updatedAt';

  insert into public.restaurant_notification_setting_events (
    restaurant_id, actor_user_id, actor_membership_id, actor_role_snapshot,
    client_action_id, action, previous_state, next_state
  ) values (
    access_record.restaurant_id, (select auth.uid()), access_record.membership_id,
    access_record.member_role, p_client_action_id,
    'notifications.settings_updated', previous_state, next_state
  );
  return private.notification_settings_json_v1(settings_record)
    || jsonb_build_object('replayed', false, 'changed', previous_state is distinct from next_state);
end;
$$;

create or replace function private.enqueue_order_notifications_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare settings_record public.restaurant_notification_settings%rowtype;
begin
  if new.order_status = 'placed' and new.payment_status = 'paid'
    and (tg_op = 'INSERT' or old.order_status is distinct from new.order_status
      or old.payment_status is distinct from new.payment_status)
  then
    select settings.* into settings_record
    from public.restaurant_notification_settings settings
    where settings.restaurant_id = new.restaurant_id;
    if settings_record.restaurant_id is not null
      and settings_record.customer_order_confirmation_email
      and nullif(btrim(new.customer_email), '') is not null
    then
      insert into public.notification_outbox (
        restaurant_id, order_id, notification_type, recipient, idempotency_key
      ) values (
        new.restaurant_id, new.id, 'customer.order_confirmed',
        lower(btrim(new.customer_email)), 'customer.order_confirmed/' || new.id::text
      ) on conflict (idempotency_key) do nothing;
    end if;
    if settings_record.restaurant_id is not null
      and settings_record.internal_new_paid_order_email
      and settings_record.internal_email_recipient is not null
    then
      insert into public.notification_outbox (
        restaurant_id, order_id, notification_type, recipient, idempotency_key
      ) values (
        new.restaurant_id, new.id, 'internal.new_paid_order',
        settings_record.internal_email_recipient, 'internal.new_paid_order/' || new.id::text
      ) on conflict (idempotency_key) do nothing;
    end if;
  end if;
  return new;
end;
$$;

create trigger orders_enqueue_notifications
after insert or update of order_status, payment_status on public.orders
for each row execute function private.enqueue_order_notifications_v1();

create or replace function private.enqueue_ready_notification_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  order_record public.orders%rowtype;
  enabled boolean;
begin
  if new.status = 'ready' and old.status is distinct from new.status then
    select order_value.* into order_record
    from public.orders order_value
    where order_value.id = new.order_id and order_value.restaurant_id = new.restaurant_id;
    select settings.customer_ready_for_pickup_email into enabled
    from public.restaurant_notification_settings settings
    where settings.restaurant_id = new.restaurant_id;
    if coalesce(enabled, false) and nullif(btrim(order_record.customer_email), '') is not null then
      insert into public.notification_outbox (
        restaurant_id, order_id, notification_type, recipient, idempotency_key
      ) values (
        new.restaurant_id, new.order_id, 'customer.ready_for_pickup',
        lower(btrim(order_record.customer_email)), 'customer.ready_for_pickup/' || new.order_id::text
      ) on conflict (idempotency_key) do nothing;
    end if;
  end if;
  return new;
end;
$$;

create trigger order_fulfillments_enqueue_ready_notification
after update of status on public.order_fulfillments
for each row execute function private.enqueue_ready_notification_v1();

create or replace function private.enqueue_refund_notification_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  order_record public.orders%rowtype;
  enabled boolean;
begin
  if new.status = 'succeeded' and old.status is distinct from new.status then
    select order_value.* into order_record
    from public.payments payment
    join public.orders order_value on order_value.id = payment.order_id
    where payment.id = new.payment_id and payment.restaurant_id = new.restaurant_id;
    select settings.customer_refund_confirmation_email into enabled
    from public.restaurant_notification_settings settings
    where settings.restaurant_id = new.restaurant_id;
    if coalesce(enabled, false) and nullif(btrim(order_record.customer_email), '') is not null then
      insert into public.notification_outbox (
        restaurant_id, order_id, notification_type, recipient, idempotency_key
      ) values (
        new.restaurant_id, order_record.id, 'customer.refund_confirmed',
        lower(btrim(order_record.customer_email)),
        'customer.refund_confirmed/' || new.id::text
      ) on conflict (idempotency_key) do nothing;
    end if;
  end if;
  return new;
end;
$$;

create trigger refunds_enqueue_customer_notification
after update of status on public.refunds
for each row execute function private.enqueue_refund_notification_v1();

create or replace function private.protect_notification_outbox_v1()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Notification outbox records cannot be deleted.';
  end if;
  if old.restaurant_id is distinct from new.restaurant_id
    or old.order_id is distinct from new.order_id
    or old.notification_type is distinct from new.notification_type
    or old.channel is distinct from new.channel
    or old.recipient is distinct from new.recipient
    or old.idempotency_key is distinct from new.idempotency_key
    or old.created_at is distinct from new.created_at
  then
    raise exception 'Notification outbox event identity is immutable.';
  end if;
  return new;
end;
$$;

create trigger notification_outbox_immutable
before update or delete on public.notification_outbox
for each row execute function private.protect_notification_outbox_v1();

create or replace function public.claim_notification_outbox_v1(
  p_limit integer default 5
)
returns table (
  outbox_id uuid,
  claim_token uuid,
  attempt_number integer,
  notification_type text,
  recipient text,
  idempotency_key text,
  restaurant_name text,
  order_number text,
  pickup_mode text,
  pickup_at timestamptz,
  pickup_timezone text
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_limit not between 1 and 20 then
    raise exception 'Notification claim limit is invalid.';
  end if;
  update public.notification_outbox outbox
  set status = 'permanent_failure', lease_token = null, next_attempt_at = null,
      last_error = coalesce(outbox.last_error, 'Delivery lease expired after the final attempt.')
  where outbox.status = 'delivering' and outbox.attempt_count >= 8
    and outbox.next_attempt_at <= now();
  return query
  with candidates as (
    select outbox.id
    from public.notification_outbox outbox
    where outbox.attempt_count < 8
      and outbox.available_at <= now()
      and (
        outbox.status in ('pending', 'retry')
        or (outbox.status = 'delivering' and outbox.next_attempt_at <= now())
      )
      and coalesce(outbox.next_attempt_at, outbox.available_at) <= now()
    order by coalesce(outbox.next_attempt_at, outbox.available_at), outbox.created_at, outbox.id
    for update skip locked
    limit p_limit
  ), claimed as (
    update public.notification_outbox outbox
    set status = 'delivering',
        attempt_count = outbox.attempt_count + 1,
        lease_token = gen_random_uuid(),
        last_attempt_at = now(),
        next_attempt_at = now() + interval '5 minutes'
    from candidates
    where outbox.id = candidates.id
    returning outbox.*
  )
  select claimed.id, claimed.lease_token, claimed.attempt_count,
         claimed.notification_type, claimed.recipient, claimed.idempotency_key,
         restaurant.name, order_record.order_number::text,
         order_record.pickup_mode, order_record.pickup_at, order_record.pickup_timezone
  from claimed
  join public.restaurants restaurant on restaurant.id = claimed.restaurant_id
  join public.orders order_record on order_record.id = claimed.order_id
    and order_record.restaurant_id = claimed.restaurant_id;
end;
$$;

create or replace function public.complete_notification_delivery_v1(
  p_outbox_id uuid,
  p_claim_token uuid,
  p_succeeded boolean,
  p_retryable boolean,
  p_http_status integer default null,
  p_provider_message_id text default null,
  p_error_code text default null,
  p_error_message text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare outbox_record public.notification_outbox%rowtype;
begin
  select outbox.* into outbox_record
  from public.notification_outbox outbox
  where outbox.id = p_outbox_id for update;
  if not found or outbox_record.status <> 'delivering'
    or outbox_record.lease_token is distinct from p_claim_token
  then
    raise exception 'Notification delivery claim is stale.';
  end if;

  insert into public.notification_delivery_attempts (
    notification_outbox_id, attempt_number, outcome, http_status,
    provider_message_id, error_code, error_message
  ) values (
    outbox_record.id, outbox_record.attempt_count,
    case when p_succeeded then 'sent'
      when p_retryable and outbox_record.attempt_count < 8 then 'retryable_failure'
      else 'permanent_failure' end,
    p_http_status, nullif(left(p_provider_message_id, 255), ''),
    nullif(left(p_error_code, 100), ''), nullif(left(p_error_message, 1000), '')
  );

  update public.notification_outbox outbox
  set status = case when p_succeeded then 'sent'
        when p_retryable and outbox.attempt_count < 8 then 'retry'
        else 'permanent_failure' end,
      provider_message_id = case when p_succeeded
        then nullif(left(p_provider_message_id, 255), '') else outbox.provider_message_id end,
      last_error = case when p_succeeded then null
        else nullif(left(coalesce(p_error_code || ': ', '') || coalesce(p_error_message, 'Delivery failed.'), 1000), '') end,
      sent_at = case when p_succeeded then now() else outbox.sent_at end,
      next_attempt_at = case
        when p_succeeded or not p_retryable or outbox.attempt_count >= 8 then null
        else now() + make_interval(secs => least(3600, 30 * (2 ^ least(outbox.attempt_count, 7)))) end,
      lease_token = null
  where outbox.id = outbox_record.id
  returning outbox.* into outbox_record;
  return jsonb_build_object(
    'outboxId', outbox_record.id,
    'status', outbox_record.status,
    'attemptCount', outbox_record.attempt_count,
    'nextAttemptAt', outbox_record.next_attempt_at
  );
end;
$$;

-- Extend the export read model without inferring ASAP from timestamp shape.
drop function public.list_managed_order_export_rows_v1(
  text, date, date, text, timestamptz, uuid, integer
);

create function public.list_managed_order_export_rows_v1(
  p_restaurant_slug text,
  p_from_date date,
  p_to_date date,
  p_date_basis text default 'placed',
  p_cursor_at timestamptz default null,
  p_cursor_order_id uuid default null,
  p_limit integer default 500
)
returns table (
  order_id uuid,
  order_number text,
  history_at timestamptz,
  placed_at timestamptz,
  pickup_mode text,
  pickup_at timestamptz,
  customer_name text,
  fulfillment_status text,
  payment_status text,
  refund_status text,
  item_count integer,
  subtotal_cents integer,
  tax_cents integer,
  tip_cents integer,
  total_cents integer,
  refund_amount_cents integer,
  ready_at timestamptz,
  ready_on_time boolean,
  completed_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  access_record record;
  restaurant_record public.restaurants%rowtype;
begin
  if p_from_date is null or p_to_date is null or p_from_date > p_to_date
    or p_date_basis not in ('placed', 'pickup') or p_limit not between 1 and 1000
    or (p_cursor_at is null) <> (p_cursor_order_id is null)
  then
    raise exception using message = 'MM_MANAGEMENT_INVALID_REQUEST|Export query is invalid.';
  end if;
  select * into access_record from private.require_restaurant_capability_v1(
    p_restaurant_slug, 'export_order_history'
  );
  select * into restaurant_record from public.restaurants restaurant
  where restaurant.id = access_record.restaurant_id;

  return query
  select order_record.id, order_record.order_number::text,
         case p_date_basis when 'pickup' then order_record.pickup_at
           else coalesce(order_record.placed_at, order_record.created_at) end,
         coalesce(order_record.placed_at, order_record.created_at),
         order_record.pickup_mode, order_record.pickup_at,
         case when access_record.can_view_contact then order_record.customer_name else null end,
         fulfillment.status, order_record.payment_status,
         case
           when exists (select 1 from public.refunds pending_refund
             where pending_refund.payment_id = payment.id
               and pending_refund.status in ('requested', 'processing')) then 'processing'
           when coalesce(payment.refunded_cents, 0) > 0
             and payment.refunded_cents >= payment.captured_cents then 'refunded'
           when coalesce(payment.refunded_cents, 0) > 0 then 'partially_refunded'
           when exists (select 1 from public.refunds failed_refund
             where failed_refund.payment_id = payment.id and failed_refund.status = 'failed') then 'failed'
           else null
         end,
         coalesce((select sum(item.quantity)::integer from public.order_items item
           where item.order_id = order_record.id), 0),
         order_record.subtotal_cents, order_record.tax_cents, order_record.tip_cents,
         order_record.total_cents, coalesce(payment.refunded_cents, 0),
         fulfillment.ready_at,
         case when fulfillment.ready_at is null or order_record.pickup_at is null then null
           else fulfillment.ready_at <= order_record.pickup_at end,
         fulfillment.completed_at
  from public.order_fulfillments fulfillment
  join public.orders order_record on order_record.restaurant_id = fulfillment.restaurant_id
    and order_record.id = fulfillment.order_id
  left join public.payments payment on payment.order_id = order_record.id
  where fulfillment.restaurant_id = access_record.restaurant_id
    and fulfillment.status = 'completed'
    and (case p_date_basis when 'pickup' then order_record.pickup_at
      else coalesce(order_record.placed_at, order_record.created_at) end)
      >= (p_from_date::timestamp at time zone restaurant_record.timezone)
    and (case p_date_basis when 'pickup' then order_record.pickup_at
      else coalesce(order_record.placed_at, order_record.created_at) end)
      < ((p_to_date + 1)::timestamp at time zone restaurant_record.timezone)
    and (p_cursor_at is null or ((case p_date_basis when 'pickup' then order_record.pickup_at
      else coalesce(order_record.placed_at, order_record.created_at) end), order_record.id)
      < (p_cursor_at, p_cursor_order_id))
  order by case p_date_basis when 'pickup' then order_record.pickup_at
    else coalesce(order_record.placed_at, order_record.created_at) end desc,
    order_record.id desc
  limit p_limit + 1;
end;
$$;

alter table public.restaurant_notification_settings enable row level security;
alter table public.restaurant_notification_setting_events enable row level security;
alter table public.notification_outbox enable row level security;
alter table public.notification_delivery_attempts enable row level security;

revoke all on table public.restaurant_notification_settings,
  public.restaurant_notification_setting_events,
  public.notification_outbox,
  public.notification_delivery_attempts
from public, anon, authenticated, service_role;

revoke all on function private.notification_settings_json_v1(public.restaurant_notification_settings)
  from public, anon, authenticated;
revoke all on function private.enqueue_order_notifications_v1()
  from public, anon, authenticated;
revoke all on function private.enqueue_ready_notification_v1()
  from public, anon, authenticated;
revoke all on function private.enqueue_refund_notification_v1()
  from public, anon, authenticated;
revoke all on function private.protect_notification_outbox_v1()
  from public, anon, authenticated;
revoke all on function private.prevent_notification_audit_mutation_v1()
  from public, anon, authenticated;
revoke all on function public.initialize_restaurant_notification_settings_v1()
  from public, anon, authenticated, service_role;
revoke all on function public.get_restaurant_notification_settings_v1(text)
  from public, anon, authenticated, service_role;
revoke all on function public.update_restaurant_notification_settings_v1(text, jsonb, uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.claim_notification_outbox_v1(integer)
  from public, anon, authenticated, service_role;
revoke all on function public.complete_notification_delivery_v1(
  uuid, uuid, boolean, boolean, integer, text, text, text
) from public, anon, authenticated, service_role;
revoke all on function public.list_managed_order_export_rows_v1(
  text, date, date, text, timestamptz, uuid, integer
) from public, anon, authenticated, service_role;

grant execute on function public.get_restaurant_notification_settings_v1(text)
  to authenticated;
grant execute on function public.update_restaurant_notification_settings_v1(text, jsonb, uuid)
  to authenticated;
grant execute on function public.claim_notification_outbox_v1(integer)
  to service_role;
grant execute on function public.complete_notification_delivery_v1(
  uuid, uuid, boolean, boolean, integer, text, text, text
) to service_role;
grant execute on function public.list_managed_order_export_rows_v1(
  text, date, date, text, timestamptz, uuid, integer
) to authenticated;

commit;
