-- STAGING PICKUP REPAIR CONTRACT. Run after the staging restaurant seeds.
-- Both restaurant fixtures are made deterministic inside this transaction.

begin;

do $$
declare
  armandos_uuid uuid;
  test_kitchen_uuid uuid;
  availability jsonb;
  first_slot timestamptz;
begin
  select restaurant.id into strict armandos_uuid
  from public.restaurants restaurant where restaurant.slug = 'armandos';
  select restaurant.id into strict test_kitchen_uuid
  from public.restaurants restaurant where restaurant.slug = 'test-kitchen';

  update public.restaurant_ordering_settings
  set pickup_enabled = true,
      asap_enabled = true,
      scheduled_pickup_enabled = true,
      pickup_lead_time_minutes = 10,
      pickup_cutoff_minutes_before_close = 10,
      pickup_slot_interval_minutes = 10,
      advance_order_days = 5
  where restaurant_id = test_kitchen_uuid;
  delete from public.restaurant_business_hours where restaurant_id = test_kitchen_uuid;
  insert into public.restaurant_business_hours
    (restaurant_id, day_of_week, open_time, close_time, is_closed, sort_order)
  values
    (test_kitchen_uuid, 1, null, null, true, 0),
    (test_kitchen_uuid, 2, null, null, true, 0),
    (test_kitchen_uuid, 3, time '09:00', time '18:00', false, 0);
  delete from public.restaurant_special_hours
  where restaurant_id = test_kitchen_uuid
    and service_date between date '2026-12-21' and date '2026-12-26';

  availability := public.get_pickup_availability_v1(
    'test-kitchen', timestamptz '2026-12-21 12:00:00-08'
  );
  select min((slot ->> 'pickupAt')::timestamptz) into first_slot
  from jsonb_array_elements(availability #> '{scheduled,slots}') slot;
  if (availability ->> 'currentlyOpen')::boolean
    or (availability #>> '{asap,available}')::boolean
    or first_slot <> timestamptz '2026-12-23 09:00:00-08'
  then
    raise exception 'Test Kitchen did not retrieve future pickup across its five-day horizon: %', availability;
  end if;

  update public.restaurant_ordering_settings
  set pickup_enabled = true,
      asap_enabled = true,
      scheduled_pickup_enabled = true,
      pickup_lead_time_minutes = 15,
      pickup_cutoff_minutes_before_close = 15,
      pickup_slot_interval_minutes = 15,
      advance_order_days = 1
  where restaurant_id = armandos_uuid;
  delete from public.restaurant_business_hours where restaurant_id = armandos_uuid;
  insert into public.restaurant_business_hours
    (restaurant_id, day_of_week, open_time, close_time, is_closed, sort_order)
  values (armandos_uuid, 1, time '07:00', time '22:00', false, 0);
  delete from public.restaurant_special_hours
  where restaurant_id = armandos_uuid and service_date = date '2026-12-21';

  availability := public.get_pickup_availability_v1(
    'armandos', timestamptz '2026-12-21 12:00:00-08'
  );
  if not (availability ->> 'currentlyOpen')::boolean
    or not (availability #>> '{asap,available}')::boolean
    or jsonb_array_length(availability #> '{scheduled,slots}') = 0
  then
    raise exception 'Armandos did not retrieve normal pickup availability: %', availability;
  end if;
end;
$$;

rollback;
