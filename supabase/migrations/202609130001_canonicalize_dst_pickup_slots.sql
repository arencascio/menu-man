-- Keep scheduled pickup wall-clock labels unique across the fall DST repeat.
-- V1 canonically retains the first chronological occurrence of a repeated
-- local pickup time. Cutoff remains an order-submission deadline; lead time
-- independently requires that fulfillment occur before the interval closes.

begin;

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

  for day_offset in -1..6 loop
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
            from generate_series(interval_start, interval_end - interval '1 minute', interval '15 minutes') slot
            order by (slot at time zone restaurant_record.timezone), slot
          ) canonical_slot
          where canonical_slot.slot >= p_now
            + make_interval(mins => settings_record.pickup_lead_time_minutes)
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

revoke all on function public.get_pickup_availability_v1(text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.get_pickup_availability_v1(text, timestamptz)
  to service_role;

commit;
