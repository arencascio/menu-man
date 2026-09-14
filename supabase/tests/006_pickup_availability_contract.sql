-- DETERMINISTIC PICKUP CONTRACT TEST.
-- Creates isolated fixtures inside this transaction and rolls them back.

begin;

do $$
declare
  restaurant_uuid uuid := gen_random_uuid();
  availability jsonb;
  first_slot timestamptz;
  local_repeated_count integer;
begin
  insert into public.restaurants (id, name, slug, currency, is_active, timezone)
  values (restaurant_uuid, 'Pickup QA Fixture', 'qa-pickup-contract', 'USD', true, 'America/Los_Angeles');

  insert into public.restaurant_ordering_settings (
    restaurant_id, pickup_enabled, asap_enabled, scheduled_pickup_enabled,
    pickup_lead_time_minutes, pickup_cutoff_minutes_before_close,
    tax_strategy, tax_rate_basis_points
  ) values (restaurant_uuid, true, true, true, 30, 15, 'restaurant_percentage', 0);

  insert into public.restaurant_business_hours (
    restaurant_id, day_of_week, open_time, close_time, is_closed, sort_order
  ) values (restaurant_uuid, 1, time '10:00', time '20:00', false, 0);

  availability := public.get_pickup_availability_v1(
    'qa-pickup-contract', timestamptz '2026-09-14 09:00:00-07'
  );
  select min((slot ->> 'pickupAt')::timestamptz) into first_slot
  from jsonb_array_elements(availability #> '{scheduled,slots}') slot;
  if (availability #>> '{asap,available}')::boolean
    or first_slot <> timestamptz '2026-09-14 10:00:00-07'
  then
    raise exception 'Before-open availability violated lead-time/opening contract: %', availability;
  end if;

  availability := public.get_pickup_availability_v1(
    'qa-pickup-contract', timestamptz '2026-09-14 10:00:00-07'
  );
  select min((slot ->> 'pickupAt')::timestamptz) into first_slot
  from jsonb_array_elements(availability #> '{scheduled,slots}') slot;
  if not (availability #>> '{asap,available}')::boolean
    or (availability #>> '{asap,estimatedPickupAt}')::timestamptz
      <> timestamptz '2026-09-14 10:30:00-07'
    or first_slot <> timestamptz '2026-09-14 10:30:00-07'
  then
    raise exception 'Opening boundary did not apply the 30-minute lead time: %', availability;
  end if;

  availability := public.get_pickup_availability_v1(
    'qa-pickup-contract', timestamptz '2026-09-14 12:07:00-07'
  );
  select min((slot ->> 'pickupAt')::timestamptz) into first_slot
  from jsonb_array_elements(availability #> '{scheduled,slots}') slot;
  if (availability #>> '{asap,estimatedPickupAt}')::timestamptz
      <> timestamptz '2026-09-14 12:37:00-07'
    or first_slot <> timestamptz '2026-09-14 12:45:00-07'
  then
    raise exception 'Off-grid lead time did not round scheduled pickup to the next slot: %', availability;
  end if;

  update public.restaurant_ordering_settings
  set pickup_lead_time_minutes = 15,
      pickup_slot_interval_minutes = 5
  where restaurant_id = restaurant_uuid;
  availability := public.get_pickup_availability_v1(
    'qa-pickup-contract', timestamptz '2026-09-14 12:07:00-07'
  );
  select min((slot ->> 'pickupAt')::timestamptz) into first_slot
  from jsonb_array_elements(availability #> '{scheduled,slots}') slot;
  if (availability #>> '{asap,estimatedPickupAt}')::timestamptz
      <> timestamptz '2026-09-14 12:22:00-07'
    or first_slot <> timestamptz '2026-09-14 12:25:00-07'
  then
    raise exception 'Configurable lead time and 5-minute slots were not applied: %', availability;
  end if;

  update public.restaurant_ordering_settings
  set pickup_lead_time_minutes = 30,
      pickup_slot_interval_minutes = 15
  where restaurant_id = restaurant_uuid;

  availability := public.get_pickup_availability_v1(
    'qa-pickup-contract', timestamptz '2026-09-14 19:29:00-07'
  );
  if not (availability #>> '{asap,available}')::boolean
    or jsonb_array_length(availability #> '{scheduled,slots}') <> 0
  then
    raise exception 'Fulfillment-before-close lead-time boundary is incorrect: %', availability;
  end if;

  availability := public.get_pickup_availability_v1(
    'qa-pickup-contract', timestamptz '2026-09-14 19:30:00-07'
  );
  if (availability #>> '{asap,available}')::boolean
    or jsonb_array_length(availability #> '{scheduled,slots}') <> 0
  then
    raise exception 'Pickup was offered when lead time ended exactly at close: %', availability;
  end if;

  update public.restaurant_ordering_settings
  set pickup_lead_time_minutes = 0
  where restaurant_id = restaurant_uuid;
  availability := public.get_pickup_availability_v1(
    'qa-pickup-contract', timestamptz '2026-09-14 19:44:59-07'
  );
  if not (availability #>> '{asap,available}')::boolean
    or not exists (
      select 1 from jsonb_array_elements(availability #> '{scheduled,slots}') slot
      where (slot ->> 'pickupAt')::timestamptz = timestamptz '2026-09-14 19:45:00-07'
    )
  then
    raise exception 'Orders were stopped before the configured submission cutoff: %', availability;
  end if;

  availability := public.get_pickup_availability_v1(
    'qa-pickup-contract', timestamptz '2026-09-14 19:45:00-07'
  );
  if (availability #>> '{asap,available}')::boolean
    or jsonb_array_length(availability #> '{scheduled,slots}') <> 0
  then
    raise exception 'Orders remained available at the configured submission cutoff: %', availability;
  end if;

  availability := public.get_pickup_availability_v1(
    'qa-pickup-contract', timestamptz '2026-09-13 12:00:00-07'
  );
  if jsonb_array_length(availability #> '{scheduled,slots}') <> 0 then
    raise exception 'Default same-day horizon exposed a future-day pickup: %', availability;
  end if;
  update public.restaurant_ordering_settings
  set advance_order_days = 1
  where restaurant_id = restaurant_uuid;
  availability := public.get_pickup_availability_v1(
    'qa-pickup-contract', timestamptz '2026-09-13 12:00:00-07'
  );
  if jsonb_array_length(availability #> '{scheduled,slots}') = 0 then
    raise exception 'Configured one-day horizon did not expose the next service day: %', availability;
  end if;
  update public.restaurant_ordering_settings
  set advance_order_days = 0
  where restaurant_id = restaurant_uuid;

  delete from public.restaurant_business_hours where restaurant_id = restaurant_uuid;
  insert into public.restaurant_business_hours (
    restaurant_id, day_of_week, open_time, close_time, is_closed, sort_order
  ) values
    (restaurant_uuid, 3, time '10:00', time '14:00', false, 0),
    (restaurant_uuid, 3, time '17:00', time '20:00', false, 1);
  availability := public.get_pickup_availability_v1(
    'qa-pickup-contract', timestamptz '2026-09-16 15:00:00-07'
  );
  select min((slot ->> 'pickupAt')::timestamptz) into first_slot
  from jsonb_array_elements(availability #> '{scheduled,slots}') slot;
  if (availability #>> '{asap,available}')::boolean
    or first_slot <> timestamptz '2026-09-16 17:00:00-07'
    or exists (
      select 1 from jsonb_array_elements(availability #> '{scheduled,slots}') slot
      where ((slot ->> 'pickupAt')::timestamptz at time zone 'America/Los_Angeles')::time
        >= time '14:00'
        and ((slot ->> 'pickupAt')::timestamptz at time zone 'America/Los_Angeles')::time
        < time '17:00'
    )
  then
    raise exception 'Split-hours closed period exposed an invalid pickup: %', availability;
  end if;

  delete from public.restaurant_business_hours where restaurant_id = restaurant_uuid;
  insert into public.restaurant_business_hours (
    restaurant_id, day_of_week, open_time, close_time, is_closed, sort_order
  ) values (restaurant_uuid, 4, time '20:00', time '02:00', false, 0);
  availability := public.get_pickup_availability_v1(
    'qa-pickup-contract', timestamptz '2026-09-18 00:30:00-07'
  );
  if not (availability #>> '{asap,available}')::boolean then
    raise exception 'Previous-day overnight interval was not available after midnight: %', availability;
  end if;
  availability := public.get_pickup_availability_v1(
    'qa-pickup-contract', timestamptz '2026-09-18 02:00:00-07'
  );
  if (availability #>> '{asap,available}')::boolean then
    raise exception 'Overnight interval remained available at closing time: %', availability;
  end if;

  update public.restaurants set timezone = 'Not/A_Timezone' where id = restaurant_uuid;
  availability := public.get_pickup_availability_v1(
    'qa-pickup-contract', timestamptz '2026-09-18 00:30:00-07'
  );
  if (availability #>> '{asap,available}')::boolean
    or jsonb_array_length(availability #> '{scheduled,slots}') <> 0
  then
    raise exception 'Invalid restaurant timezone did not fail closed: %', availability;
  end if;

  update public.restaurants set timezone = 'America/Los_Angeles' where id = restaurant_uuid;
  update public.restaurant_ordering_settings
  set pickup_enabled = false, asap_enabled = false, scheduled_pickup_enabled = false,
      pickup_lead_time_minutes = 0, pickup_cutoff_minutes_before_close = 0
  where restaurant_id = restaurant_uuid;
  availability := public.get_pickup_availability_v1(
    'qa-pickup-contract', timestamptz '2026-09-18 00:30:00-07'
  );
  if (availability #>> '{asap,enabled}')::boolean
    or (availability #>> '{scheduled,enabled}')::boolean
  then
    raise exception 'Disabled pickup modes were exposed as enabled: %', availability;
  end if;

  update public.restaurant_ordering_settings
  set pickup_enabled = true, asap_enabled = true, scheduled_pickup_enabled = true
  where restaurant_id = restaurant_uuid;
  delete from public.restaurant_business_hours where restaurant_id = restaurant_uuid;
  insert into public.restaurant_business_hours (
    restaurant_id, day_of_week, open_time, close_time, is_closed, sort_order
  ) values (restaurant_uuid, 0, time '00:00', time '03:00', false, 0);

  availability := public.get_pickup_availability_v1(
    'qa-pickup-contract', timestamptz '2026-03-08 00:00:00-08'
  );
  if exists (
    select 1 from jsonb_array_elements(availability #> '{scheduled,slots}') slot
    where extract(hour from ((slot ->> 'pickupAt')::timestamptz at time zone 'America/Los_Angeles')) = 2
  ) then
    raise exception 'Spring DST transition exposed a nonexistent 2 AM pickup: %', availability;
  end if;

  availability := public.get_pickup_availability_v1(
    'qa-pickup-contract', timestamptz '2026-11-01 00:00:00-07'
  );
  select count(*) into local_repeated_count
  from jsonb_array_elements(availability #> '{scheduled,slots}') slot
  where ((slot ->> 'pickupAt')::timestamptz at time zone 'America/Los_Angeles')::time
    between time '01:00' and time '01:59:59';
  if local_repeated_count <> 4
    or not exists (
      select 1 from jsonb_array_elements(availability #> '{scheduled,slots}') slot
      where (slot ->> 'pickupAt')::timestamptz = timestamptz '2026-11-01 08:00:00+00'
    )
    or exists (
      select 1 from jsonb_array_elements(availability #> '{scheduled,slots}') slot
      where (slot ->> 'pickupAt')::timestamptz = timestamptz '2026-11-01 09:00:00+00'
    )
  then
    raise exception 'Fall DST slots were not canonicalized to the first occurrence: %', availability;
  end if;

  availability := public.get_pickup_availability_v1(
    'qa-pickup-contract', timestamptz '2026-11-01 09:15:00+00'
  );
  if exists (
    select 1 from jsonb_array_elements(availability #> '{scheduled,slots}') slot
    where extract(hour from ((slot ->> 'pickupAt')::timestamptz at time zone 'America/Los_Angeles')) = 1
  ) then
    raise exception 'Fall DST fallback switched to the second repeated-hour occurrence: %', availability;
  end if;
end;
$$;

do $$
declare
  restaurant_uuid uuid := gen_random_uuid();
  menu_uuid uuid := gen_random_uuid();
  section_uuid uuid := gen_random_uuid();
  item_uuid uuid := gen_random_uuid();
  request_payload jsonb;
  availability jsonb;
  pickup_at_value text;
  order_response jsonb;
  scheduled_key text := gen_random_uuid()::text;
  asap_key text := gen_random_uuid()::text;
  stale_key text := gen_random_uuid()::text;
  invalid_key text := gen_random_uuid()::text;
  counter_before bigint;
begin
  insert into public.restaurants (id, name, slug, currency, is_active, timezone)
  values (restaurant_uuid, 'Checkout Pickup QA Fixture', 'qa-checkout-pickup-contract', 'USD', true, 'UTC');
  insert into public.restaurant_ordering_settings (
    restaurant_id, pickup_enabled, asap_enabled, scheduled_pickup_enabled,
    pickup_lead_time_minutes, pickup_cutoff_minutes_before_close, advance_order_days,
    tax_strategy, tax_rate_basis_points
  ) values (restaurant_uuid, true, true, true, 0, 0, 1, 'restaurant_percentage', 0);
  insert into public.restaurant_business_hours (
    restaurant_id, day_of_week, open_time, close_time, is_closed, sort_order
  )
  select restaurant_uuid, day_number, time '00:00', time '00:00', false, 0
  from generate_series(0, 6) day_number;

  insert into public.menus (id, restaurant_id, name, is_published)
  values (menu_uuid, restaurant_uuid, 'Pickup QA Menu', true);
  insert into public.menu_sections (id, menu_id, name, sort_order, is_active)
  values (section_uuid, menu_uuid, 'QA', 0, true);
  insert into public.menu_items (
    id, restaurant_id, name, price_cents, source_system, source_item_id, is_orderable
  ) values (item_uuid, restaurant_uuid, 'QA Item', 1000, 'qa', 'pickup-item', true);
  insert into public.menu_section_items (section_id, item_id, sort_order)
  values (section_uuid, item_uuid, 0);

  availability := public.get_pickup_availability_v1(
    'qa-checkout-pickup-contract', statement_timestamp()
  );
  select slot ->> 'pickupAt' into pickup_at_value
  from jsonb_array_elements(availability #> '{scheduled,slots}') slot
  order by (slot ->> 'pickupAt')::timestamptz
  limit 1;
  if pickup_at_value is null then
    raise exception 'Dynamic checkout fixture did not produce a scheduled slot';
  end if;

  request_payload := jsonb_build_object(
    'menuId', menu_uuid,
    'items', jsonb_build_array(jsonb_build_object(
      'menuItemId', item_uuid,
      'quantity', 1,
      'modifierOptionIds', '[]'::jsonb,
      'specialInstructions', null
    )),
    'customer', jsonb_build_object('name', 'Pickup QA', 'phone', '555-0100', 'email', null),
    'pickup', jsonb_build_object('mode', 'scheduled', 'pickupAt', pickup_at_value),
    'tipChoice', 'none',
    'orderNotes', null
  );

  order_response := public.create_order_v1(
    'qa-checkout-pickup-contract', scheduled_key, request_payload
  );
  if order_response #>> '{pickup,mode}' <> 'scheduled'
    or (order_response #>> '{pickup,pickupAt}')::timestamptz <> pickup_at_value::timestamptz
  then
    raise exception 'Valid scheduled pickup was not preserved: %', order_response;
  end if;

  order_response := public.create_order_v1(
    'qa-checkout-pickup-contract', asap_key,
    jsonb_set(request_payload, '{pickup}', jsonb_build_object('mode', 'asap'))
  );
  if order_response #>> '{pickup,mode}' <> 'asap'
    or (order_response #>> '{pickup,pickupAt}')::timestamptz <> statement_timestamp()
  then
    raise exception 'Valid ASAP pickup was not server-derived: %', order_response;
  end if;

  select last_order_number into counter_before
  from public.restaurant_order_counters where restaurant_id = restaurant_uuid;
  update public.restaurant_ordering_settings
  set scheduled_pickup_enabled = false
  where restaurant_id = restaurant_uuid;
  begin
    perform public.create_order_v1(
      'qa-checkout-pickup-contract', stale_key, request_payload
    );
    raise exception 'Expected stale scheduled pickup to be rejected';
  exception when others then
    if position('MM_PICKUP_UNAVAILABLE' in sqlerrm) = 0 then raise; end if;
  end;
  if exists (
    select 1 from public.orders
    where restaurant_id = restaurant_uuid and idempotency_key = stale_key
  ) or (select last_order_number from public.restaurant_order_counters
        where restaurant_id = restaurant_uuid) <> counter_before
  then
    raise exception 'Rejected stale pickup mutated order state or order number';
  end if;

  update public.restaurant_ordering_settings
  set scheduled_pickup_enabled = true
  where restaurant_id = restaurant_uuid;
  begin
    perform public.create_order_v1(
      'qa-checkout-pickup-contract', invalid_key,
      jsonb_set(request_payload, '{pickup,pickupAt}', '"not-a-timestamp"'::jsonb)
    );
    raise exception 'Expected invalid scheduled pickup timestamp to be rejected';
  exception when others then
    if position('MM_INVALID_REQUEST' in sqlerrm) = 0 then raise; end if;
  end;

  delete from public.restaurant_business_hours where restaurant_id = restaurant_uuid;
  begin
    perform public.create_order_v1(
      'qa-checkout-pickup-contract', gen_random_uuid()::text, request_payload
    );
    raise exception 'Expected a slot invalidated by changed hours to be rejected';
  exception when others then
    if position('MM_PICKUP_UNAVAILABLE' in sqlerrm) = 0 then raise; end if;
  end;
end;
$$;

rollback;
