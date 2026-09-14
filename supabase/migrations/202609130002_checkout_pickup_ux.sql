-- Configurable pickup cadence/horizon and authoritative fixed-amount tips.
-- The existing checkout implementation is retained as an internal base so
-- custom-tip handling remains atomic without duplicating its pricing logic.

begin;

alter table public.restaurant_ordering_settings
  add column if not exists pickup_slot_interval_minutes integer not null default 15,
  add column if not exists advance_order_days integer not null default 0;

alter table public.restaurant_ordering_settings
  drop constraint if exists restaurant_ordering_settings_slot_interval_check,
  drop constraint if exists restaurant_ordering_settings_advance_days_check;

alter table public.restaurant_ordering_settings
  add constraint restaurant_ordering_settings_slot_interval_check
    check (pickup_slot_interval_minutes between 5 and 1440),
  add constraint restaurant_ordering_settings_advance_days_check
    check (advance_order_days between 0 and 30);

alter table public.orders
  alter column tip_basis_points drop not null;

create or replace function public.get_pickup_availability_v1(
  p_restaurant_slug text,
  p_now timestamptz default statement_timestamp()
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  restaurant_record record;
  settings_record record;
  local_today date;
  service_date date;
  day_offset integer;
  hour_record record;
  interval_start timestamptz;
  interval_end timestamptz;
  order_deadline timestamptz;
  candidate timestamptz;
  estimated_asap timestamptz;
  asap_available boolean := false;
  slots jsonb := '[]'::jsonb;
begin
  select id, timezone
  into restaurant_record
  from public.restaurants
  where slug = p_restaurant_slug
    and is_active = true;

  if not found then
    return jsonb_build_object(
      'timezone', null,
      'generatedAt', p_now,
      'asap', jsonb_build_object('enabled', false, 'available', false, 'estimatedPickupAt', null),
      'scheduled', jsonb_build_object('enabled', false, 'slots', slots)
    );
  end if;

  select *
  into settings_record
  from public.restaurant_ordering_settings
  where restaurant_id = restaurant_record.id;

  if not found then
    return jsonb_build_object(
      'timezone', restaurant_record.timezone,
      'generatedAt', p_now,
      'asap', jsonb_build_object('enabled', false, 'available', false, 'estimatedPickupAt', null),
      'scheduled', jsonb_build_object('enabled', false, 'slots', slots)
    );
  end if;

  if not settings_record.pickup_enabled or restaurant_record.timezone is null then
    return jsonb_build_object(
      'timezone', restaurant_record.timezone,
      'generatedAt', p_now,
      'asap', jsonb_build_object('enabled', false, 'available', false, 'estimatedPickupAt', null),
      'scheduled', jsonb_build_object('enabled', false, 'slots', slots)
    );
  end if;

  if not exists (
    select 1 from pg_catalog.pg_timezone_names
    where name = restaurant_record.timezone
  ) then
    return jsonb_build_object(
      'timezone', restaurant_record.timezone,
      'generatedAt', p_now,
      'asap', jsonb_build_object('enabled', settings_record.asap_enabled, 'available', false, 'estimatedPickupAt', null),
      'scheduled', jsonb_build_object('enabled', settings_record.scheduled_pickup_enabled, 'slots', slots)
    );
  end if;

  local_today := (p_now at time zone restaurant_record.timezone)::date;

  -- Day -1 preserves overnight intervals. Zero means same-day ordering only.
  for day_offset in -1..settings_record.advance_order_days loop
    service_date := local_today + day_offset;
    for hour_record in
      select open_time, close_time
      from public.restaurant_business_hours
      where restaurant_id = restaurant_record.id
        and day_of_week = extract(dow from service_date)::integer
        and not is_closed
      order by sort_order
    loop
      interval_start := (service_date + hour_record.open_time) at time zone restaurant_record.timezone;
      interval_end := (
        service_date
        + case when hour_record.close_time <= hour_record.open_time then 1 else 0 end
        + hour_record.close_time
      ) at time zone restaurant_record.timezone;
      order_deadline := interval_end
        - make_interval(mins => settings_record.pickup_cutoff_minutes_before_close);

      if settings_record.asap_enabled
        and p_now >= interval_start
        and p_now < interval_end
        and p_now < order_deadline
        and p_now + make_interval(mins => settings_record.pickup_lead_time_minutes) < interval_end
      then
        asap_available := true;
        estimated_asap := p_now + make_interval(mins => settings_record.pickup_lead_time_minutes);
      end if;

      if settings_record.scheduled_pickup_enabled
        and service_date >= local_today
        and p_now < order_deadline
      then
        for candidate in
          select canonical_slot.slot
          from (
            select distinct on (slot at time zone restaurant_record.timezone) slot
            from generate_series(
              interval_start,
              interval_end - interval '1 minute',
              make_interval(mins => settings_record.pickup_slot_interval_minutes)
            ) slot
            order by (slot at time zone restaurant_record.timezone), slot
          ) canonical_slot
          where canonical_slot.slot >= p_now
            + make_interval(mins => settings_record.pickup_lead_time_minutes)
          -- Future blocked/capacity ranges can be excluded here without
          -- changing checkout requests or authoritative revalidation.
          order by canonical_slot.slot
        loop
          slots := slots || jsonb_build_array(jsonb_build_object('pickupAt', candidate));
        end loop;
      end if;
    end loop;
  end loop;

  return jsonb_build_object(
    'timezone', restaurant_record.timezone,
    'generatedAt', p_now,
    'asap', jsonb_build_object(
      'enabled', settings_record.asap_enabled,
      'available', asap_available,
      'estimatedPickupAt', estimated_asap
    ),
    'scheduled', jsonb_build_object(
      'enabled', settings_record.scheduled_pickup_enabled,
      'slots', slots
    )
  );
end;
$$;

alter function public.create_order_v1(text, text, jsonb)
  rename to create_order_base_v1;

revoke all on function public.create_order_base_v1(text, text, jsonb)
  from public, anon, authenticated, service_role;

create function public.create_order_v1(
  p_restaurant_slug text,
  p_idempotency_key text,
  p_request jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  base_response jsonb;
  base_request jsonb;
  order_uuid uuid;
  custom_tip_value bigint;
  final_total bigint;
begin
  if p_request ->> 'tipChoice' <> 'custom' then
    return public.create_order_base_v1(p_restaurant_slug, p_idempotency_key, p_request);
  end if;

  if jsonb_typeof(p_request -> 'customTipCents') <> 'number'
    or p_request ->> 'customTipCents' !~ '^\d+$'
  then
    raise exception using message = 'MM_INVALID_REQUEST|A custom tip must be a nonnegative whole-cent amount.';
  end if;

  begin
    custom_tip_value := (p_request ->> 'customTipCents')::bigint;
  exception when numeric_value_out_of_range then
    raise exception using message = 'MM_TOTAL_TOO_LARGE|The custom tip exceeds the supported limit.';
  end;

  if custom_tip_value > 2147483647 then
    raise exception using message = 'MM_TOTAL_TOO_LARGE|The custom tip exceeds the supported limit.';
  end if;

  -- The internal marker keeps custom-tip fingerprints distinct from normal
  -- no-tip requests while the base function performs all existing validation,
  -- repricing, locking, snapshotting, and order-number allocation.
  base_request := jsonb_set(p_request, '{tipChoice}', '"none"'::jsonb)
    || jsonb_build_object('_menuManCustomTip', true);
  base_response := public.create_order_base_v1(
    p_restaurant_slug,
    p_idempotency_key,
    base_request
  );
  order_uuid := (base_response ->> 'orderId')::uuid;
  final_total := (base_response ->> 'subtotalCents')::bigint
    + (base_response ->> 'taxCents')::bigint
    + custom_tip_value;

  if final_total > 2147483647 then
    raise exception using message = 'MM_TOTAL_TOO_LARGE|The order total exceeds the supported limit.';
  end if;

  update public.orders
  set tip_basis_points = null,
      tip_cents = custom_tip_value::integer,
      total_cents = final_total::integer
  where id = order_uuid;

  return public.menu_man_order_response_v1(
    order_uuid,
    (base_response ->> 'replayed')::boolean
  );
end;
$$;

revoke all on function public.get_pickup_availability_v1(text, timestamptz)
  from public, anon, authenticated;
revoke all on function public.create_order_v1(text, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.get_pickup_availability_v1(text, timestamptz)
  to service_role;
grant execute on function public.create_order_v1(text, text, jsonb)
  to service_role;

commit;
