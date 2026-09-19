-- Repair the special-hours lookup added in 202609170002. Its unqualified
-- service_date variable conflicted with restaurant_special_hours.service_date
-- at runtime, causing every enabled pickup availability request to fail.

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
  target_service_date date;
  day_offset integer;
  hour_record record;
  special_is_closed boolean;
  special_open_time time;
  special_close_time time;
  interval_start timestamptz;
  interval_end timestamptz;
  order_deadline timestamptz;
  candidate timestamptz;
  estimated_asap timestamptz;
  asap_available boolean := false;
  currently_open boolean := false;
  has_special boolean;
  slots jsonb := '[]'::jsonb;
begin
  select restaurant.id, restaurant.timezone
  into restaurant_record
  from public.restaurants restaurant
  where restaurant.slug = p_restaurant_slug
    and restaurant.is_active = true;

  if not found then
    return jsonb_build_object(
      'timezone', null,
      'generatedAt', p_now,
      'currentlyOpen', false,
      'asap', jsonb_build_object('enabled', false, 'available', false, 'estimatedPickupAt', null),
      'scheduled', jsonb_build_object('enabled', false, 'slots', slots)
    );
  end if;

  select settings.*
  into settings_record
  from public.restaurant_ordering_settings settings
  where settings.restaurant_id = restaurant_record.id;

  if not found then
    return jsonb_build_object(
      'timezone', restaurant_record.timezone,
      'generatedAt', p_now,
      'currentlyOpen', false,
      'asap', jsonb_build_object('enabled', false, 'available', false, 'estimatedPickupAt', null),
      'scheduled', jsonb_build_object('enabled', false, 'slots', slots)
    );
  end if;

  if not settings_record.pickup_enabled or restaurant_record.timezone is null then
    return jsonb_build_object(
      'timezone', restaurant_record.timezone,
      'generatedAt', p_now,
      'currentlyOpen', false,
      'asap', jsonb_build_object('enabled', false, 'available', false, 'estimatedPickupAt', null),
      'scheduled', jsonb_build_object('enabled', false, 'slots', slots)
    );
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_timezone_names timezone_name
    where timezone_name.name = restaurant_record.timezone
  ) then
    return jsonb_build_object(
      'timezone', restaurant_record.timezone,
      'generatedAt', p_now,
      'currentlyOpen', false,
      'asap', jsonb_build_object(
        'enabled', settings_record.asap_enabled,
        'available', false,
        'estimatedPickupAt', null
      ),
      'scheduled', jsonb_build_object(
        'enabled', settings_record.scheduled_pickup_enabled,
        'slots', slots
      )
    );
  end if;

  local_today := (p_now at time zone restaurant_record.timezone)::date;

  -- Day -1 preserves existing overnight weekly intervals. Each date through
  -- advance_order_days is evaluated independently, so closed dates do not
  -- prevent later eligible dates from contributing scheduled slots.
  for day_offset in -1..settings_record.advance_order_days loop
    target_service_date := local_today + day_offset;

    select special.is_closed, special.open_time, special.close_time
    into special_is_closed, special_open_time, special_close_time
    from public.restaurant_special_hours special
    where special.restaurant_id = restaurant_record.id
      and special.service_date = target_service_date;
    has_special := found;

    for hour_record in
      select schedule.open_time, schedule.close_time
      from (
        select special_open_time as open_time, special_close_time as close_time
        where has_special and not special_is_closed

        union all

        select weekly.open_time, weekly.close_time
        from public.restaurant_business_hours weekly
        where not has_special
          and weekly.restaurant_id = restaurant_record.id
          and weekly.day_of_week = extract(dow from target_service_date)::integer
          and not weekly.is_closed
      ) schedule
      order by schedule.open_time
    loop
      interval_start := (
        target_service_date + hour_record.open_time
      ) at time zone restaurant_record.timezone;
      interval_end := (
        target_service_date
        + case when hour_record.close_time <= hour_record.open_time then 1 else 0 end
        + hour_record.close_time
      ) at time zone restaurant_record.timezone;
      order_deadline := interval_end
        - make_interval(mins => settings_record.pickup_cutoff_minutes_before_close);

      if p_now >= interval_start and p_now < interval_end then
        currently_open := true;
      end if;

      if settings_record.asap_enabled
        and p_now >= interval_start
        and p_now < interval_end
        and p_now < order_deadline
        and p_now + make_interval(mins => settings_record.pickup_lead_time_minutes) < interval_end
      then
        asap_available := true;
        estimated_asap := p_now
          + make_interval(mins => settings_record.pickup_lead_time_minutes);
      end if;

      if settings_record.scheduled_pickup_enabled
        and target_service_date >= local_today
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
    'currentlyOpen', currently_open,
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
