-- STAGING ONLY. These hours, pickup rules, and tax configuration are explicit
-- test values and must never be applied to production automatically.

begin;

do $$
declare
  restaurant_uuid uuid;
begin
  select id into restaurant_uuid
  from public.restaurants
  where slug = 'armandos'
    and is_active = true;

  if restaurant_uuid is null then
    raise exception 'Active staging restaurant not found: armandos';
  end if;

  update public.restaurants
  set timezone = 'America/Los_Angeles'
  where id = restaurant_uuid;

  -- This seed owns the complete weekly schedule for the staging fixture.
  delete from public.restaurant_business_hours
  where restaurant_id = restaurant_uuid;

  insert into public.restaurant_business_hours (
    restaurant_id,
    day_of_week,
    open_time,
    close_time,
    is_closed,
    sort_order
  ) values
    (restaurant_uuid, 0, time '07:00', time '22:00', false, 0),
    (restaurant_uuid, 1, time '07:00', time '23:00', false, 0),
    (restaurant_uuid, 2, time '07:00', time '23:00', false, 0),
    (restaurant_uuid, 3, time '07:00', time '23:00', false, 0),
    (restaurant_uuid, 4, time '07:00', time '23:00', false, 0),
    (restaurant_uuid, 5, time '07:00', time '23:00', false, 0),
    (restaurant_uuid, 6, time '07:00', time '23:00', false, 0);

  insert into public.restaurant_ordering_settings (
    restaurant_id,
    pickup_enabled,
    asap_enabled,
    scheduled_pickup_enabled,
    pickup_lead_time_minutes,
    pickup_cutoff_minutes_before_close,
    pickup_slot_interval_minutes,
    advance_order_days,
    tax_strategy,
    tax_rate_basis_points
  ) values (
    restaurant_uuid,
    true,
    true,
    true,
    15,
    15,
    5,
    0,
    'restaurant_percentage',
    875
  )
  on conflict (restaurant_id) do update set
    pickup_enabled = excluded.pickup_enabled,
    asap_enabled = excluded.asap_enabled,
    scheduled_pickup_enabled = excluded.scheduled_pickup_enabled,
    pickup_lead_time_minutes = excluded.pickup_lead_time_minutes,
    pickup_cutoff_minutes_before_close = excluded.pickup_cutoff_minutes_before_close,
    pickup_slot_interval_minutes = excluded.pickup_slot_interval_minutes,
    advance_order_days = excluded.advance_order_days,
    tax_strategy = excluded.tax_strategy,
    tax_rate_basis_points = excluded.tax_rate_basis_points;
end;
$$;

commit;
