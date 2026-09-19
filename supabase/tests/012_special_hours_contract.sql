-- DETERMINISTIC SPECIAL-HOURS CONTRACT TEST. All fixtures roll back.

begin;

do $$
declare
  restaurant_uuid uuid := gen_random_uuid();
  special_uuid uuid := gen_random_uuid();
  availability jsonb;
  first_slot timestamptz;
begin
  insert into public.restaurants (id, name, slug, currency, is_active, timezone)
  values (restaurant_uuid, 'Special Hours QA', 'qa-special-hours', 'USD', true, 'America/Los_Angeles');
  insert into public.restaurant_ordering_settings (
    restaurant_id, pickup_enabled, asap_enabled, scheduled_pickup_enabled,
    pickup_lead_time_minutes, pickup_cutoff_minutes_before_close,
    pickup_slot_interval_minutes, advance_order_days, tax_strategy, tax_rate_basis_points
  ) values (restaurant_uuid, true, true, true, 0, 0, 15, 5, 'restaurant_percentage', 0);
  insert into public.restaurant_business_hours
    (restaurant_id, day_of_week, open_time, close_time, is_closed, sort_order)
  values
    (restaurant_uuid, 1, time '09:00', time '20:00', false, 0),
    (restaurant_uuid, 3, time '10:00', time '18:00', false, 0),
    (restaurant_uuid, 4, time '11:00', time '19:00', false, 0);

  -- No exception row: after today's close and an intervening closed Tuesday,
  -- the weekly Wednesday schedule must still be searched within the horizon.
  availability := public.get_pickup_availability_v1(
    'qa-special-hours', timestamptz '2026-12-21 21:00:00-08'
  );
  select min((slot ->> 'pickupAt')::timestamptz) into first_slot
  from jsonb_array_elements(availability #> '{scheduled,slots}') slot;
  if (availability ->> 'currentlyOpen')::boolean
    or (availability #>> '{asap,available}')::boolean
    or first_slot <> timestamptz '2026-12-23 10:00:00-08'
  then raise exception 'Weekly fallback did not search past closed days: %', availability; end if;

  insert into public.restaurant_special_hours
    (id, restaurant_id, service_date, label, is_closed)
  values (special_uuid, restaurant_uuid, date '2026-12-21', 'Holiday closure', true);
  availability := public.get_pickup_availability_v1('qa-special-hours', timestamptz '2026-12-21 12:00:00-08');
  if (availability ->> 'currentlyOpen')::boolean
    or (availability #>> '{asap,available}')::boolean
    or exists (select 1 from jsonb_array_elements(availability #> '{scheduled,slots}') slot
      where ((slot ->> 'pickupAt')::timestamptz at time zone 'America/Los_Angeles')::date = date '2026-12-21')
  then raise exception 'Closed special date did not override weekly hours: %', availability; end if;

  update public.restaurant_special_hours set is_closed = false,
    open_time = time '15:00', close_time = time '17:00' where id = special_uuid;
  availability := public.get_pickup_availability_v1('qa-special-hours', timestamptz '2026-12-21 12:00:00-08');
  select min((slot ->> 'pickupAt')::timestamptz) into first_slot
  from jsonb_array_elements(availability #> '{scheduled,slots}') slot
  where ((slot ->> 'pickupAt')::timestamptz at time zone 'America/Los_Angeles')::date = date '2026-12-21';
  if (availability ->> 'currentlyOpen')::boolean
    or first_slot <> timestamptz '2026-12-21 15:00:00-08'
  then raise exception 'Custom special hours did not override the weekly interval: %', availability; end if;

  delete from public.restaurant_special_hours where id = special_uuid;
  availability := public.get_pickup_availability_v1('qa-special-hours', timestamptz '2026-12-21 12:00:00-08');
  if not (availability ->> 'currentlyOpen')::boolean
    or not (availability #>> '{asap,available}')::boolean
  then raise exception 'Deleting a special date did not restore weekly behavior: %', availability; end if;

  begin
    insert into public.restaurant_special_hours
      (restaurant_id, service_date, is_closed, open_time, close_time)
    values (restaurant_uuid, date '2026-12-22', false, time '20:00', time '02:00');
    raise exception 'Overnight special hours were accepted';
  exception when check_violation then null; end;
end;
$$;

rollback;
