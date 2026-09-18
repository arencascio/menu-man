-- Date-specific hours override weekly hours. Checkout receives an explicit
-- current-open signal and only the two customer notification preferences it
-- needs for pre-payment expectation copy.

begin;

create table public.restaurant_special_hours (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete restrict,
  service_date date not null,
  label text,
  is_closed boolean not null default true,
  open_time time,
  close_time time,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint restaurant_special_hours_date_key unique (restaurant_id, service_date),
  constraint restaurant_special_hours_label_check check (
    label is null or (btrim(label) <> '' and char_length(label) <= 100)
  ),
  constraint restaurant_special_hours_interval_check check (
    (is_closed and open_time is null and close_time is null)
    or (not is_closed and open_time is not null and close_time is not null and open_time < close_time)
  )
);

create index restaurant_special_hours_restaurant_date_idx
  on public.restaurant_special_hours (restaurant_id, service_date);
create trigger restaurant_special_hours_set_updated_at before update on public.restaurant_special_hours
for each row execute function public.set_menu_man_updated_at();
alter table public.restaurant_special_hours enable row level security;
revoke all on table public.restaurant_special_hours from public, anon, authenticated;
grant select on table public.restaurant_special_hours to service_role;

create or replace function private.hours_settings_json_v2(p_restaurant_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'timezone', restaurant.timezone,
    'days', (
      select jsonb_agg(jsonb_build_object(
        'dayOfWeek', day_value,
        'isClosed', coalesce(hours.is_closed, true),
        'openTime', case when coalesce(hours.is_closed, true) then null else to_char(hours.open_time, 'HH24:MI') end,
        'closeTime', case when coalesce(hours.is_closed, true) then null else to_char(hours.close_time, 'HH24:MI') end
      ) order by day_value)
      from generate_series(0, 6) day_value
      left join public.restaurant_business_hours hours
        on hours.restaurant_id = restaurant.id and hours.day_of_week = day_value and hours.sort_order = 0
    ),
    'specialDates', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', special.id,
        'serviceDate', special.service_date,
        'label', special.label,
        'isClosed', special.is_closed,
        'openTime', case when special.is_closed then null else to_char(special.open_time, 'HH24:MI') end,
        'closeTime', case when special.is_closed then null else to_char(special.close_time, 'HH24:MI') end
      ) order by special.service_date, special.id)
      from public.restaurant_special_hours special where special.restaurant_id = restaurant.id
    ), '[]'::jsonb),
    'hadMultipleIntervals', exists (
      select 1 from public.restaurant_business_hours hours
      where hours.restaurant_id = restaurant.id and hours.sort_order <> 0
    )
  )
  from public.restaurants restaurant where restaurant.id = p_restaurant_id;
$$;

create or replace function public.get_managed_hours_settings_v2(p_restaurant_slug text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare access_record record;
begin
  select * into strict access_record from private.require_restaurant_capability_v1(
    p_restaurant_slug, 'manage_restaurant_settings');
  return private.hours_settings_json_v2(access_record.restaurant_id);
end;
$$;

create or replace function public.update_managed_hours_settings_v2(
  p_restaurant_slug text, p_days jsonb, p_special_dates jsonb, p_client_action_id uuid
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  access_record record; previous_state jsonb; next_state jsonb; day_value jsonb; special_value jsonb;
  day_number integer; closed boolean; opening time; closing time; special_id uuid;
  special_date date; special_label text;
begin
  select * into strict access_record from private.require_restaurant_capability_v1(
    p_restaurant_slug, 'manage_restaurant_settings');
  if p_client_action_id is null or p_days is null or jsonb_typeof(p_days) <> 'array'
    or jsonb_array_length(p_days) <> 7 or p_special_dates is null
    or jsonb_typeof(p_special_dates) <> 'array' or jsonb_array_length(p_special_dates) > 100
  then raise exception using message = 'MM_MANAGEMENT_INVALID_REQUEST|Hours settings are invalid.'; end if;
  if exists (select 1 from public.restaurant_setting_events event
    where event.restaurant_id = access_record.restaurant_id and event.client_action_id = p_client_action_id)
  then
    select event.next_state into next_state from public.restaurant_setting_events event
    where event.restaurant_id = access_record.restaurant_id and event.client_action_id = p_client_action_id
      and event.action = 'settings.hours_updated';
    if next_state is null then raise exception using message = 'MM_MANAGEMENT_CONFLICT|This action identifier was already used.'; end if;
    return next_state;
  end if;
  begin
    if (select count(distinct (entry ->> 'dayOfWeek')::integer) from jsonb_array_elements(p_days) entry) <> 7
      or (select count(distinct (entry ->> 'serviceDate')::date) from jsonb_array_elements(p_special_dates) entry)
        <> jsonb_array_length(p_special_dates)
    then raise exception using message = 'MM_MANAGEMENT_INVALID_REQUEST|Each weekly day and special date must be unique.'; end if;
  exception when invalid_text_representation then
    raise exception using message = 'MM_MANAGEMENT_INVALID_REQUEST|Hours dates and days are invalid.';
  end;
  previous_state := private.hours_settings_json_v2(access_record.restaurant_id);

  delete from public.restaurant_business_hours where restaurant_id = access_record.restaurant_id;
  for day_value in select * from jsonb_array_elements(p_days) loop
    if jsonb_typeof(day_value) <> 'object'
      or not (day_value ?& array['dayOfWeek','isClosed','openTime','closeTime'])
      or jsonb_typeof(day_value -> 'dayOfWeek') <> 'number'
      or day_value ->> 'dayOfWeek' !~ '^\d$'
      or jsonb_typeof(day_value -> 'isClosed') <> 'boolean'
      or jsonb_typeof(day_value -> 'openTime') not in ('string', 'null')
      or jsonb_typeof(day_value -> 'closeTime') not in ('string', 'null')
    then raise exception using message = 'MM_MANAGEMENT_INVALID_REQUEST|Weekly hours contain invalid values.'; end if;
    begin
      day_number := (day_value ->> 'dayOfWeek')::integer;
      closed := (day_value ->> 'isClosed')::boolean;
      opening := nullif(day_value ->> 'openTime', '')::time;
      closing := nullif(day_value ->> 'closeTime', '')::time;
    exception when others then raise exception using message = 'MM_MANAGEMENT_INVALID_REQUEST|Weekly hours contain invalid values.'; end;
    if day_number not between 0 and 6 or (not closed and (opening is null or closing is null or opening >= closing))
    then raise exception using message = 'MM_MANAGEMENT_INVALID_REQUEST|Open days require a same-day opening time before closing time.'; end if;
    insert into public.restaurant_business_hours
      (restaurant_id, day_of_week, open_time, close_time, is_closed, sort_order)
    values (access_record.restaurant_id, day_number, case when closed then null else opening end,
      case when closed then null else closing end, closed, 0);
  end loop;

  delete from public.restaurant_special_hours where restaurant_id = access_record.restaurant_id;
  for special_value in select * from jsonb_array_elements(p_special_dates) loop
    if jsonb_typeof(special_value) <> 'object'
      or not (special_value ?& array['id','serviceDate','label','isClosed','openTime','closeTime'])
      or jsonb_typeof(special_value -> 'id') <> 'string'
      or jsonb_typeof(special_value -> 'serviceDate') <> 'string'
      or jsonb_typeof(special_value -> 'label') not in ('string', 'null')
      or jsonb_typeof(special_value -> 'isClosed') <> 'boolean'
      or jsonb_typeof(special_value -> 'openTime') not in ('string', 'null')
      or jsonb_typeof(special_value -> 'closeTime') not in ('string', 'null')
    then raise exception using message = 'MM_MANAGEMENT_INVALID_REQUEST|Special hours contain invalid values.'; end if;
    begin
      special_id := (special_value ->> 'id')::uuid;
      special_date := (special_value ->> 'serviceDate')::date;
      special_label := nullif(btrim(coalesce(special_value ->> 'label', '')), '');
      closed := (special_value ->> 'isClosed')::boolean;
      opening := nullif(special_value ->> 'openTime', '')::time;
      closing := nullif(special_value ->> 'closeTime', '')::time;
    exception when others then raise exception using message = 'MM_MANAGEMENT_INVALID_REQUEST|Special hours contain invalid values.'; end;
    if special_id is null or special_date is null or char_length(coalesce(special_label, '')) > 100
      or (not closed and (opening is null or closing is null or opening >= closing))
    then raise exception using message = 'MM_MANAGEMENT_INVALID_REQUEST|Special hours require a valid date and same-day range.'; end if;
    insert into public.restaurant_special_hours
      (id, restaurant_id, service_date, label, is_closed, open_time, close_time)
    values (special_id, access_record.restaurant_id, special_date, special_label, closed,
      case when closed then null else opening end, case when closed then null else closing end);
  end loop;

  next_state := private.hours_settings_json_v2(access_record.restaurant_id);
  insert into public.restaurant_setting_events
    (restaurant_id, actor_user_id, actor_membership_id, client_action_id, action, previous_state, next_state)
  values (access_record.restaurant_id, (select auth.uid()), access_record.membership_id,
    p_client_action_id, 'settings.hours_updated', previous_state, next_state);
  return next_state;
end;
$$;

create or replace function public.get_pickup_availability_v1(
  p_restaurant_slug text, p_now timestamptz default statement_timestamp()
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  restaurant_record record; settings_record record; local_today date; service_date date;
  day_offset integer; hour_record record; special_record record; interval_start timestamptz;
  interval_end timestamptz; order_deadline timestamptz; candidate timestamptz;
  estimated_asap timestamptz; asap_available boolean := false; currently_open boolean := false;
  has_special boolean;
  slots jsonb := '[]'::jsonb;
begin
  select id, timezone into restaurant_record from public.restaurants
  where slug = p_restaurant_slug and is_active = true;
  if not found then return jsonb_build_object('timezone', null, 'generatedAt', p_now,
    'currentlyOpen', false, 'asap', jsonb_build_object('enabled', false, 'available', false, 'estimatedPickupAt', null),
    'scheduled', jsonb_build_object('enabled', false, 'slots', slots)); end if;
  select * into settings_record from public.restaurant_ordering_settings
  where restaurant_id = restaurant_record.id;
  if not found or not settings_record.pickup_enabled or restaurant_record.timezone is null then
    return jsonb_build_object('timezone', restaurant_record.timezone, 'generatedAt', p_now,
      'currentlyOpen', false, 'asap', jsonb_build_object('enabled', false, 'available', false, 'estimatedPickupAt', null),
      'scheduled', jsonb_build_object('enabled', false, 'slots', slots));
  end if;
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = restaurant_record.timezone) then
    return jsonb_build_object('timezone', restaurant_record.timezone, 'generatedAt', p_now,
      'currentlyOpen', false, 'asap', jsonb_build_object('enabled', settings_record.asap_enabled, 'available', false, 'estimatedPickupAt', null),
      'scheduled', jsonb_build_object('enabled', settings_record.scheduled_pickup_enabled, 'slots', slots));
  end if;
  local_today := (p_now at time zone restaurant_record.timezone)::date;

  for day_offset in -1..settings_record.advance_order_days loop
    service_date := local_today + day_offset;
    select * into special_record from public.restaurant_special_hours special
      where special.restaurant_id = restaurant_record.id and special.service_date = service_date;
    has_special := found;
    for hour_record in
      select source.open_time, source.close_time from (
        select special_record.open_time, special_record.close_time
        where has_special and not special_record.is_closed
        union all
        select weekly.open_time, weekly.close_time from public.restaurant_business_hours weekly
        where not has_special and weekly.restaurant_id = restaurant_record.id
          and weekly.day_of_week = extract(dow from service_date)::integer and not weekly.is_closed
      ) source order by source.open_time
    loop
      interval_start := (service_date + hour_record.open_time) at time zone restaurant_record.timezone;
      interval_end := (service_date + case when hour_record.close_time <= hour_record.open_time then 1 else 0 end
        + hour_record.close_time) at time zone restaurant_record.timezone;
      order_deadline := interval_end - make_interval(mins => settings_record.pickup_cutoff_minutes_before_close);
      if p_now >= interval_start and p_now < interval_end then currently_open := true; end if;
      if settings_record.asap_enabled and p_now >= interval_start and p_now < interval_end
        and p_now < order_deadline and p_now + make_interval(mins => settings_record.pickup_lead_time_minutes) < interval_end
      then asap_available := true; estimated_asap := p_now + make_interval(mins => settings_record.pickup_lead_time_minutes); end if;
      if settings_record.scheduled_pickup_enabled and service_date >= local_today and p_now < order_deadline then
        for candidate in
          select canonical_slot.slot from (
            select distinct on (slot at time zone restaurant_record.timezone) slot
            from generate_series(interval_start, interval_end - interval '1 minute',
              make_interval(mins => settings_record.pickup_slot_interval_minutes)) slot
            order by (slot at time zone restaurant_record.timezone), slot
          ) canonical_slot
          where canonical_slot.slot >= p_now + make_interval(mins => settings_record.pickup_lead_time_minutes)
          order by canonical_slot.slot
        loop slots := slots || jsonb_build_array(jsonb_build_object('pickupAt', candidate)); end loop;
      end if;
    end loop;
  end loop;
  return jsonb_build_object('timezone', restaurant_record.timezone, 'generatedAt', p_now,
    'currentlyOpen', currently_open,
    'asap', jsonb_build_object('enabled', settings_record.asap_enabled, 'available', asap_available, 'estimatedPickupAt', estimated_asap),
    'scheduled', jsonb_build_object('enabled', settings_record.scheduled_pickup_enabled, 'slots', slots));
end;
$$;

create or replace function public.get_checkout_notification_preferences_v1(p_restaurant_slug text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce((select jsonb_build_object(
    'orderConfirmationEnabled', settings.customer_order_confirmation_email,
    'readyForPickupEnabled', settings.customer_ready_for_pickup_email)
    from public.restaurants restaurant join public.restaurant_notification_settings settings
      on settings.restaurant_id = restaurant.id
    where restaurant.slug = p_restaurant_slug and restaurant.is_active = true),
    jsonb_build_object('orderConfirmationEnabled', false, 'readyForPickupEnabled', false));
$$;

revoke all on function private.hours_settings_json_v2(uuid) from public, anon, authenticated;
revoke all on function public.get_managed_hours_settings_v2(text) from public, anon, authenticated, service_role;
revoke all on function public.update_managed_hours_settings_v2(text, jsonb, jsonb, uuid) from public, anon, authenticated, service_role;
revoke all on function public.get_pickup_availability_v1(text, timestamptz) from public, anon, authenticated;
revoke all on function public.get_checkout_notification_preferences_v1(text) from public, anon, authenticated;
grant execute on function public.get_managed_hours_settings_v2(text) to authenticated;
grant execute on function public.update_managed_hours_settings_v2(text, jsonb, jsonb, uuid) to authenticated;
grant execute on function public.get_pickup_availability_v1(text, timestamptz) to service_role;
grant execute on function public.get_checkout_notification_preferences_v1(text) to service_role;

commit;
