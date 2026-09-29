-- Scheduled pickup capacity. Existing slot cadence remains the single source
-- of truth; pickup_interval_minutes is a generated SQL alias for it. Existing
-- restaurants retain their cadence and default to 1000 orders per interval
-- until an operator explicitly sets a tighter cap.
begin;

alter table public.restaurant_ordering_settings
  add column pickup_interval_minutes integer
    generated always as (pickup_slot_interval_minutes) stored,
  add column pickup_max_orders_per_interval integer not null default 1000,
  add constraint pickup_max_orders_per_interval_range
    check (pickup_max_orders_per_interval between 1 and 1000);

create table public.pickup_slot_reservations (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete restrict,
  order_id uuid not null references public.orders(id) on delete restrict,
  payment_attempt_id uuid not null unique references public.payment_attempts(id) on delete restrict,
  pickup_at timestamptz not null,
  slot_start_at timestamptz not null,
  expires_at timestamptz not null,
  committed_at timestamptz,
  released_at timestamptz,
  created_at timestamptz not null default now(),
  constraint pickup_slot_reservation_timing_check
    check (expires_at > created_at and not (committed_at is not null and released_at is not null))
);
create index pickup_slot_reservations_capacity_idx
  on public.pickup_slot_reservations (restaurant_id, slot_start_at, expires_at)
  where released_at is null;
create index pickup_slot_reservations_order_idx
  on public.pickup_slot_reservations (order_id, created_at desc);
alter table public.pickup_slot_reservations enable row level security;
revoke all on public.pickup_slot_reservations from public, anon, authenticated, service_role;

create function private.pickup_slot_start_v1(p_at timestamptz, p_interval_minutes integer)
returns timestamptz language sql immutable set search_path = '' as $$
  select pg_catalog.date_bin(
    pg_catalog.make_interval(mins => p_interval_minutes), p_at,
    timestamptz '1970-01-01 00:00:00+00'
  );
$$;

create function private.pickup_slot_lock_key_v1(
  p_restaurant_id uuid, p_slot_start_at timestamptz
)
returns bigint language sql immutable set search_path = '' as $$
  select pg_catalog.hashtextextended(
    'pickup-slot:' || p_restaurant_id::text || ':'
      || pg_catalog.date_part('epoch', p_slot_start_at)::bigint::text, 0
  );
$$;

-- Committed operational orders count once regardless of their reservation row.
-- Pending orders count only while they own an unexpired, unreleased reservation.
-- Cancelled orders and failed/released/expired attempts never consume capacity.
create function private.pickup_slot_load_v1(
  p_restaurant_id uuid, p_slot_start_at timestamptz,
  p_interval_minutes integer, p_now timestamptz
)
returns integer language sql volatile security definer set search_path = '' as $$
  select ((
    select count(*) from public.orders placed
    where placed.restaurant_id = p_restaurant_id
      and placed.pickup_mode = 'scheduled'
      and placed.order_status in ('placed','confirmed','preparing','ready','completed')
      and private.pickup_slot_start_v1(placed.pickup_at, p_interval_minutes) = p_slot_start_at
  ) + (
    select count(*) from public.pickup_slot_reservations reservation
    join public.orders pending on pending.id = reservation.order_id
    where reservation.restaurant_id = p_restaurant_id
      and pending.order_status = 'pending_payment'
      and reservation.committed_at is null
      and reservation.released_at is null
      and reservation.expires_at > p_now
      and private.pickup_slot_start_v1(reservation.pickup_at, p_interval_minutes) = p_slot_start_at
  ))::integer;
$$;

-- Preserve the existing business-hours/special-hours/DST generator. Its
-- candidate list is filtered by the same canonical DB bucket used at reserve.
alter function public.get_pickup_availability_v1(text, timestamptz)
  rename to get_pickup_availability_unbounded_v1;
revoke all on function public.get_pickup_availability_unbounded_v1(text, timestamptz)
  from public, anon, authenticated, service_role;

create function public.get_pickup_availability_v1(
  p_restaurant_slug text, p_now timestamptz default statement_timestamp()
)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  availability jsonb;
  restaurant_uuid uuid;
  interval_minutes integer;
  max_orders integer;
  slot jsonb;
  available_slots jsonb := '[]'::jsonb;
  slot_start timestamptz;
begin
  availability := public.get_pickup_availability_unbounded_v1(p_restaurant_slug, p_now);
  select restaurant.id, settings.pickup_interval_minutes,
         settings.pickup_max_orders_per_interval
  into restaurant_uuid, interval_minutes, max_orders
  from public.restaurants restaurant
  join public.restaurant_ordering_settings settings
    on settings.restaurant_id = restaurant.id
  where restaurant.slug = p_restaurant_slug and restaurant.is_active;
  if restaurant_uuid is null then return availability; end if;

  for slot in select value from pg_catalog.jsonb_array_elements(availability #> '{scheduled,slots}') loop
    slot_start := private.pickup_slot_start_v1(
      (slot ->> 'pickupAt')::timestamptz, interval_minutes
    );
    if private.pickup_slot_load_v1(restaurant_uuid, slot_start, interval_minutes, p_now) < max_orders then
      available_slots := available_slots || pg_catalog.jsonb_build_array(slot);
    end if;
  end loop;
  return pg_catalog.jsonb_set(availability, '{scheduled,slots}', available_slots);
end;
$$;
revoke all on function public.get_pickup_availability_v1(text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.get_pickup_availability_v1(text, timestamptz)
  to service_role;

-- Existing in-flight attempts predate this migration. Honor them with a
-- reservation so deployment cannot turn a legitimate provider success into
-- an unreserved late success. They may temporarily exceed the new cap.
insert into public.pickup_slot_reservations (
  restaurant_id, order_id, payment_attempt_id, pickup_at, slot_start_at, expires_at
)
select orders.restaurant_id, orders.id, attempt.id, orders.pickup_at,
       private.pickup_slot_start_v1(orders.pickup_at, settings.pickup_interval_minutes),
       greatest(payment.payment_due_at, pg_catalog.clock_timestamp() + interval '30 minutes')
from public.payment_attempts attempt
join public.payments payment on payment.id = attempt.payment_id
join public.orders orders on orders.id = payment.order_id
join public.restaurant_ordering_settings settings on settings.restaurant_id = orders.restaurant_id
where orders.order_status = 'pending_payment'
  and orders.pickup_mode = 'scheduled'
  and attempt.status in ('processing','unknown','authorized');

-- The old public wrapper checked hours but not capacity. Retire it and call
-- its authenticated, row-locking reservation core from the new wrapper.
alter function public.reserve_payment_attempt_v1(uuid, text, uuid)
  rename to reserve_payment_attempt_pre_capacity_v1;
revoke all on function public.reserve_payment_attempt_pre_capacity_v1(uuid, text, uuid)
  from public, anon, authenticated, service_role;

create function public.reserve_payment_attempt_v1(
  p_order_id uuid, p_access_token_hash text, p_client_attempt_key uuid
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  reservation jsonb;
  order_record record;
  availability jsonb;
  checked_at timestamptz;
  slot_start timestamptz;
  interval_minutes integer;
  max_orders integer;
begin
  reservation := public.reserve_payment_attempt_unchecked_v1(
    p_order_id, p_access_token_hash, p_client_attempt_key
  );
  if coalesce((reservation ->> 'replayed')::boolean, false) then return reservation; end if;

  select orders.restaurant_id, orders.pickup_mode, orders.pickup_at,
         restaurant.slug, payment.payment_due_at
  into strict order_record
  from public.orders orders
  join public.restaurants restaurant on restaurant.id = orders.restaurant_id
  join public.payments payment on payment.order_id = orders.id
  where orders.id = p_order_id;

  perform pg_catalog.pg_advisory_xact_lock_shared(
    private.pickup_availability_lock_key_v1(order_record.restaurant_id)
  );
  select settings.pickup_interval_minutes, settings.pickup_max_orders_per_interval
  into strict interval_minutes, max_orders
  from public.restaurant_ordering_settings settings
  where settings.restaurant_id = order_record.restaurant_id;
  if order_record.pickup_mode = 'scheduled' then
    slot_start := private.pickup_slot_start_v1(
      order_record.pickup_at, interval_minutes
    );
    perform pg_catalog.pg_advisory_xact_lock(
      private.pickup_slot_lock_key_v1(order_record.restaurant_id, slot_start)
    );
  end if;

  checked_at := pg_catalog.clock_timestamp();
  if order_record.payment_due_at <= checked_at then
    raise exception using message = 'MM_PAYMENT_EXPIRED|This payment session has expired.';
  end if;
  availability := public.get_pickup_availability_unbounded_v1(order_record.slug, checked_at);
  if order_record.pickup_mode = 'asap' then
    if not coalesce((availability #>> '{asap,available}')::boolean, false) then
      raise exception using message =
        'MM_PICKUP_UNAVAILABLE|Pickup availability changed. Choose a new pickup time.';
    end if;
  elsif order_record.pickup_mode = 'scheduled' then
    if not exists (
      select 1 from pg_catalog.jsonb_array_elements(availability #> '{scheduled,slots}') slot
      where (slot ->> 'pickupAt')::timestamptz = order_record.pickup_at
    ) then
      raise exception using message =
        'MM_PICKUP_UNAVAILABLE|Pickup availability changed. Choose a new pickup time.';
    end if;
    if private.pickup_slot_load_v1(
      order_record.restaurant_id, slot_start, interval_minutes,
      checked_at
    ) >= max_orders then
      raise exception using message =
        'MM_PICKUP_CAPACITY|That pickup time just filled up. Please choose another time.';
    end if;
    insert into public.pickup_slot_reservations (
      restaurant_id, order_id, payment_attempt_id, pickup_at, slot_start_at, expires_at
    ) values (
      order_record.restaurant_id, p_order_id, (reservation ->> 'attemptId')::uuid,
      order_record.pickup_at, slot_start,
      least(order_record.payment_due_at, checked_at + interval '30 minutes')
    );
  else
    raise exception using message = 'MM_PICKUP_UNAVAILABLE|Pickup availability changed.';
  end if;
  return reservation;
end;
$$;
revoke all on function public.reserve_payment_attempt_v1(uuid, text, uuid)
  from public, anon, authenticated;
grant execute on function public.reserve_payment_attempt_v1(uuid, text, uuid)
  to service_role;

create function private.sync_pickup_reservation_v1()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_table_name = 'orders' then
    if new.order_status = 'placed' and old.order_status is distinct from 'placed' then
      update public.pickup_slot_reservations
      set committed_at = coalesce(committed_at, pg_catalog.clock_timestamp())
      where order_id = new.id and released_at is null and committed_at is null;
    elsif new.order_status = 'cancelled' and old.order_status is distinct from 'cancelled' then
      update public.pickup_slot_reservations
      set released_at = coalesce(released_at, pg_catalog.clock_timestamp())
      where order_id = new.id and committed_at is null and released_at is null;
    end if;
  elsif tg_table_name = 'payment_attempts' then
    if new.status in ('failed','cancelled') and old.status is distinct from new.status then
      update public.pickup_slot_reservations
      set released_at = coalesce(released_at, pg_catalog.clock_timestamp())
      where payment_attempt_id = new.id and committed_at is null and released_at is null;
    end if;
  end if;
  return new;
end;
$$;
create trigger pickup_reservation_order_lifecycle
after update of order_status on public.orders
for each row execute function private.sync_pickup_reservation_v1();
create trigger pickup_reservation_attempt_lifecycle
after update of status on public.payment_attempts
for each row execute function private.sync_pickup_reservation_v1();

-- A delayed success may arrive after its reservation expired. Never place an
-- unreserved order: route it through the existing late-success/refund review
-- path. Square automatic capture may already have happened at this point.
alter function public.apply_payment_event_v1(uuid)
  rename to apply_payment_event_without_capacity_v1;
revoke all on function public.apply_payment_event_without_capacity_v1(uuid)
  from public, anon, authenticated, service_role;

create function public.apply_payment_event_v1(p_webhook_event_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  event_record record;
  attempt_record record;
  payment_record record;
  order_record record;
  reservation_record record;
  interval_minutes integer;
  attempt_uuid uuid;
begin
  select id, connection_id, processing_status, normalized_event, available_at into event_record
  from public.payment_webhook_events where id = p_webhook_event_id for update;
  if not found then return public.apply_payment_event_without_capacity_v1(p_webhook_event_id); end if;
  if event_record.processing_status in ('processed','ignored')
    or event_record.available_at > now()
    or event_record.normalized_event ->> 'kind' <> 'payment.succeeded'
  then return public.apply_payment_event_without_capacity_v1(p_webhook_event_id); end if;

  begin
    attempt_uuid := (event_record.normalized_event ->> 'attemptId')::uuid;
  exception when others then
    return public.apply_payment_event_without_capacity_v1(p_webhook_event_id);
  end;
  select attempt.id, attempt.payment_id into attempt_record
  from public.payment_attempts attempt
  where attempt.id = attempt_uuid
    and attempt.connection_id = event_record.connection_id for update;
  if not found then return public.apply_payment_event_without_capacity_v1(p_webhook_event_id); end if;
  select order_id into payment_record
  from public.payments where id = attempt_record.payment_id for update;
  if not found then return public.apply_payment_event_without_capacity_v1(p_webhook_event_id); end if;
  select id, restaurant_id, pickup_at, pickup_mode, order_status into order_record
  from public.orders where id = payment_record.order_id for update;
  if not found then return public.apply_payment_event_without_capacity_v1(p_webhook_event_id); end if;

  if order_record.pickup_mode = 'scheduled' and order_record.order_status = 'pending_payment' then
    perform pg_catalog.pg_advisory_xact_lock_shared(
      private.pickup_availability_lock_key_v1(order_record.restaurant_id)
    );
    select pickup_interval_minutes into strict interval_minutes
    from public.restaurant_ordering_settings
    where restaurant_id = order_record.restaurant_id;
    perform pg_catalog.pg_advisory_xact_lock(
      private.pickup_slot_lock_key_v1(order_record.restaurant_id,
        private.pickup_slot_start_v1(order_record.pickup_at, interval_minutes))
    );
    select id, restaurant_id, pickup_at, expires_at, committed_at, released_at
    into reservation_record
    from public.pickup_slot_reservations
    where payment_attempt_id = attempt_record.id and order_id = order_record.id
    for update;
    if not found then
      update public.orders set order_status = 'cancelled', payment_status = 'failed',
        cancelled_at = coalesce(cancelled_at, pg_catalog.clock_timestamp()),
        cancellation_reason = 'pickup_reservation_expired'
      where id = order_record.id and order_status = 'pending_payment';
    elsif reservation_record.restaurant_id <> order_record.restaurant_id
      or reservation_record.pickup_at <> order_record.pickup_at
      or reservation_record.released_at is not null
      or reservation_record.committed_at is not null
      or reservation_record.expires_at <= pg_catalog.clock_timestamp() then
      update public.orders set order_status = 'cancelled', payment_status = 'failed',
        cancelled_at = coalesce(cancelled_at, pg_catalog.clock_timestamp()),
        cancellation_reason = 'pickup_reservation_expired'
      where id = order_record.id and order_status = 'pending_payment';
    end if;
  end if;
  return public.apply_payment_event_without_capacity_v1(p_webhook_event_id);
end;
$$;
revoke all on function public.apply_payment_event_v1(uuid)
  from public, anon, authenticated;
grant execute on function public.apply_payment_event_v1(uuid) to service_role;

-- The staging-only fake late-success acceptance is another route to placed.
-- Let its existing authorization/state checks run, but roll the transaction
-- back unless the scheduled order still owns a live capacity reservation.
alter function public.accept_fake_late_success_v1(uuid, text)
  rename to accept_fake_late_success_without_capacity_v1;
revoke all on function public.accept_fake_late_success_without_capacity_v1(uuid, text)
  from public, anon, authenticated, service_role;

create function public.accept_fake_late_success_v1(
  p_order_id uuid, p_access_token_hash text
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  result jsonb;
  order_record record;
  interval_minutes integer;
  was_placed boolean;
begin
  select order_status = 'placed' into was_placed
  from public.orders where id = p_order_id;
  result := public.accept_fake_late_success_without_capacity_v1(
    p_order_id, p_access_token_hash
  );
  if was_placed then return result; end if;
  select restaurant_id, pickup_at, pickup_mode into strict order_record
  from public.orders where id = p_order_id;
  if order_record.pickup_mode = 'scheduled' then
    perform pg_catalog.pg_advisory_xact_lock_shared(
      private.pickup_availability_lock_key_v1(order_record.restaurant_id)
    );
    select pickup_interval_minutes into strict interval_minutes
    from public.restaurant_ordering_settings
    where restaurant_id = order_record.restaurant_id;
    perform pg_catalog.pg_advisory_xact_lock(
      private.pickup_slot_lock_key_v1(order_record.restaurant_id,
        private.pickup_slot_start_v1(order_record.pickup_at, interval_minutes))
    );
  end if;
  if order_record.pickup_mode = 'scheduled' and not exists (
    select 1 from public.pickup_slot_reservations reservation
    join public.payment_attempts attempt on attempt.id = reservation.payment_attempt_id
    join public.payments payment on payment.id = attempt.payment_id
    where reservation.order_id = p_order_id
      and payment.order_id = p_order_id
      and attempt.status = 'succeeded'
      and reservation.released_at is null
      and reservation.expires_at > pg_catalog.clock_timestamp()
  ) then
    raise exception using message =
      'MM_PAYMENT_NOT_ALLOWED|The pickup reservation expired. This payment requires refund review.';
  end if;
  return result;
end;
$$;
revoke all on function public.accept_fake_late_success_v1(uuid, text)
  from public, anon, authenticated;
grant execute on function public.accept_fake_late_success_v1(uuid, text)
  to service_role;

alter function public.reserve_fake_late_success_resolution_v1(uuid, text, text, uuid)
  rename to reserve_fake_late_success_resolution_without_capacity_v1;
revoke all on function public.reserve_fake_late_success_resolution_without_capacity_v1(uuid, text, text, uuid)
  from public, anon, authenticated, service_role;

create function public.reserve_fake_late_success_resolution_v1(
  p_order_id uuid, p_access_token_hash text,
  p_resolution text, p_client_action_key uuid
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  result jsonb;
  pickup_mode_value text;
begin
  result := public.reserve_fake_late_success_resolution_without_capacity_v1(
    p_order_id, p_access_token_hash, p_resolution, p_client_action_key
  );
  if p_resolution = 'accepted' then
    select pickup_mode into strict pickup_mode_value
    from public.orders where id = p_order_id;
    if pickup_mode_value = 'scheduled' and not exists (
      select 1 from public.pickup_slot_reservations reservation
      join public.payment_attempts attempt on attempt.id = reservation.payment_attempt_id
      join public.payments payment on payment.id = attempt.payment_id
      where reservation.order_id = p_order_id
        and payment.order_id = p_order_id
        and attempt.status = 'succeeded'
        and reservation.released_at is null
        and reservation.expires_at > pg_catalog.clock_timestamp()
    ) then
      raise exception using message =
        'MM_PICKUP_RESERVATION_EXPIRED|The pickup reservation expired. Choose a refund for this payment.';
    end if;
  end if;
  return result;
end;
$$;
revoke all on function public.reserve_fake_late_success_resolution_v1(uuid, text, text, uuid)
  from public, anon, authenticated;
grant execute on function public.reserve_fake_late_success_resolution_v1(uuid, text, text, uuid)
  to service_role;

-- Extend the existing audited ordering-settings endpoint, not a parallel
-- capacity editor. Legacy intervals remain readable/saveable unchanged;
-- newly selected intervals are limited to 10, 15, 20, or 30 minutes.
create or replace function private.ordering_settings_json_v1(
  p_settings public.restaurant_ordering_settings,
  p_policy public.restaurant_refund_policies
)
returns jsonb language sql stable security definer set search_path = '' as $$
  select pg_catalog.jsonb_build_object(
    'pickupEnabled', p_settings.pickup_enabled,
    'asapEnabled', p_settings.asap_enabled,
    'scheduledPickupEnabled', p_settings.scheduled_pickup_enabled,
    'pickupLeadTimeMinutes', p_settings.pickup_lead_time_minutes,
    'pickupSlotIntervalMinutes', p_settings.pickup_slot_interval_minutes,
    'pickupIntervalMinutes', p_settings.pickup_interval_minutes,
    'pickupMaxOrdersPerInterval', p_settings.pickup_max_orders_per_interval,
    'advanceOrderDays', p_settings.advance_order_days,
    'customerNameRequired', p_settings.customer_name_required,
    'customerEmailRequired', p_settings.customer_email_required,
    'customerPhoneRequired', p_settings.customer_phone_required,
    'customTipAdditiveCapCents', p_settings.custom_tip_additive_cap_cents,
    'refundWindowDays', p_policy.refund_window_days
  );
$$;

create or replace function public.update_managed_ordering_settings_v1(
  p_restaurant_slug text, p_settings jsonb, p_client_action_id uuid
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  access_record record;
  settings_record public.restaurant_ordering_settings%rowtype;
  policy_record public.restaurant_refund_policies%rowtype;
  previous_state jsonb; next_state jsonb; setting_key text;
  v_pickup_enabled boolean; v_asap_enabled boolean; v_scheduled_enabled boolean;
  v_lead_minutes integer; v_slot_minutes integer; v_max_orders integer;
  v_advance_days integer; v_tip_cap integer; v_refund_days integer;
begin
  select * into strict access_record from private.require_restaurant_capability_v1(
    p_restaurant_slug, 'manage_restaurant_settings');
  if p_client_action_id is null or p_settings is null or pg_catalog.jsonb_typeof(p_settings) <> 'object' then
    raise exception using message = 'MM_MANAGEMENT_INVALID_REQUEST|Ordering settings are invalid.';
  end if;
  if exists (select 1 from public.restaurant_setting_events event
    where event.restaurant_id = access_record.restaurant_id and event.client_action_id = p_client_action_id)
  then
    select event.next_state into next_state from public.restaurant_setting_events event
    where event.restaurant_id = access_record.restaurant_id
      and event.client_action_id = p_client_action_id
      and event.action = 'settings.ordering_updated';
    if next_state is null then
      raise exception using message = 'MM_MANAGEMENT_CONFLICT|This action identifier was already used.';
    end if;
    return next_state;
  end if;
  for setting_key in select pg_catalog.jsonb_object_keys(p_settings) loop
    if setting_key not in (
      'pickupEnabled','asapEnabled','scheduledPickupEnabled','pickupLeadTimeMinutes',
      'pickupSlotIntervalMinutes','pickupMaxOrdersPerInterval','advanceOrderDays',
      'customerNameRequired','customerEmailRequired','customerPhoneRequired',
      'customTipAdditiveCapCents','refundWindowDays'
    ) then raise exception using message = 'MM_MANAGEMENT_INVALID_REQUEST|Ordering settings are invalid.'; end if;
  end loop;
  if not (p_settings ?& array[
    'pickupEnabled','asapEnabled','scheduledPickupEnabled','pickupLeadTimeMinutes',
    'pickupSlotIntervalMinutes','pickupMaxOrdersPerInterval','advanceOrderDays',
    'customerNameRequired','customerEmailRequired','customerPhoneRequired',
    'customTipAdditiveCapCents','refundWindowDays'
  ]) then raise exception using message = 'MM_MANAGEMENT_INVALID_REQUEST|Ordering settings are incomplete.'; end if;
  if exists (select 1 from pg_catalog.unnest(array[
      'pickupEnabled','asapEnabled','scheduledPickupEnabled',
      'customerNameRequired','customerEmailRequired','customerPhoneRequired'
    ]) key where pg_catalog.jsonb_typeof(p_settings -> key) <> 'boolean')
    or exists (select 1 from pg_catalog.unnest(array[
      'pickupLeadTimeMinutes','pickupSlotIntervalMinutes','pickupMaxOrdersPerInterval',
      'advanceOrderDays','customTipAdditiveCapCents','refundWindowDays'
    ]) key where pg_catalog.jsonb_typeof(p_settings -> key) <> 'number'
      or p_settings ->> key !~ '^\d+$')
  then raise exception using message = 'MM_MANAGEMENT_INVALID_REQUEST|Ordering values must use the expected types.'; end if;
  begin
    v_pickup_enabled := (p_settings ->> 'pickupEnabled')::boolean;
    v_asap_enabled := (p_settings ->> 'asapEnabled')::boolean;
    v_scheduled_enabled := (p_settings ->> 'scheduledPickupEnabled')::boolean;
    v_lead_minutes := (p_settings ->> 'pickupLeadTimeMinutes')::integer;
    v_slot_minutes := (p_settings ->> 'pickupSlotIntervalMinutes')::integer;
    v_max_orders := (p_settings ->> 'pickupMaxOrdersPerInterval')::integer;
    v_advance_days := (p_settings ->> 'advanceOrderDays')::integer;
    v_tip_cap := (p_settings ->> 'customTipAdditiveCapCents')::integer;
    v_refund_days := (p_settings ->> 'refundWindowDays')::integer;
  exception when others then
    raise exception using message = 'MM_MANAGEMENT_INVALID_REQUEST|Ordering values must use the expected types.';
  end;
  select * into strict settings_record from public.restaurant_ordering_settings
  where restaurant_id = access_record.restaurant_id for update;
  select * into strict policy_record from public.restaurant_refund_policies
  where restaurant_id = access_record.restaurant_id for update;
  if (not v_pickup_enabled and (v_asap_enabled or v_scheduled_enabled))
    or v_lead_minutes not between 0 and 1440
    or (v_slot_minutes not in (10,15,20,30)
      and v_slot_minutes <> settings_record.pickup_slot_interval_minutes)
    or v_max_orders not between 1 and 1000
    or v_advance_days not between 0 and 30
    or v_tip_cap not between 0 and 2147483647
    or v_refund_days not between 0 and 365
  then raise exception using message = 'MM_MANAGEMENT_INVALID_REQUEST|Ordering settings are outside supported ranges.'; end if;

  previous_state := private.ordering_settings_json_v1(settings_record, policy_record);
  update public.restaurant_ordering_settings set
    pickup_enabled = v_pickup_enabled, asap_enabled = v_asap_enabled,
    scheduled_pickup_enabled = v_scheduled_enabled,
    pickup_lead_time_minutes = v_lead_minutes,
    pickup_slot_interval_minutes = v_slot_minutes,
    pickup_max_orders_per_interval = v_max_orders,
    advance_order_days = v_advance_days,
    customer_name_required = (p_settings ->> 'customerNameRequired')::boolean,
    customer_email_required = (p_settings ->> 'customerEmailRequired')::boolean,
    customer_phone_required = (p_settings ->> 'customerPhoneRequired')::boolean,
    custom_tip_additive_cap_cents = v_tip_cap
  where restaurant_id = access_record.restaurant_id returning * into settings_record;
  update public.restaurant_refund_policies set refund_window_days = v_refund_days,
    updated_by_user_id = (select auth.uid()), updated_at = now()
  where restaurant_id = access_record.restaurant_id returning * into policy_record;
  next_state := private.ordering_settings_json_v1(settings_record, policy_record);
  insert into public.restaurant_setting_events
    (restaurant_id, actor_user_id, actor_membership_id, client_action_id,
     action, previous_state, next_state)
  values (access_record.restaurant_id, (select auth.uid()), access_record.membership_id,
    p_client_action_id, 'settings.ordering_updated', previous_state, next_state);
  return next_state;
end;
$$;

revoke all on function private.pickup_slot_start_v1(timestamptz, integer)
  from public, anon, authenticated, service_role;
revoke all on function private.pickup_slot_lock_key_v1(uuid, timestamptz)
  from public, anon, authenticated, service_role;
revoke all on function private.pickup_slot_load_v1(uuid, timestamptz, integer, timestamptz)
  from public, anon, authenticated, service_role;
revoke all on function private.sync_pickup_reservation_v1()
  from public, anon, authenticated, service_role;

commit;
