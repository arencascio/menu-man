-- Tenant-scoped restaurant, ordering, and weekly-hours management with
-- capability defaults and immutable, idempotent audit events.

begin;

insert into public.restaurant_capabilities (capability, description)
values ('manage_restaurant_settings', 'Manage restaurant profile, ordering, and business hours')
on conflict (capability) do update set description = excluded.description;

insert into public.restaurant_role_capability_defaults (role, capability, allowed)
values
  ('owner', 'manage_restaurant_settings', true),
  ('manager', 'manage_restaurant_settings', true),
  ('staff', 'manage_restaurant_settings', false)
on conflict (role, capability) do update set allowed = excluded.allowed;

create table public.restaurant_setting_events (
  id bigint generated always as identity primary key,
  restaurant_id uuid not null references public.restaurants(id) on delete restrict,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  actor_membership_id uuid not null,
  client_action_id uuid not null,
  action text not null,
  previous_state jsonb not null,
  next_state jsonb not null,
  created_at timestamptz not null default now(),
  constraint restaurant_setting_events_membership_fkey
    foreign key (restaurant_id, actor_membership_id)
    references public.restaurant_memberships(restaurant_id, id) on delete restrict,
  constraint restaurant_setting_events_action_check check (
    action in ('settings.restaurant_updated', 'settings.ordering_updated', 'settings.hours_updated')
  ),
  constraint restaurant_setting_events_state_check check (
    jsonb_typeof(previous_state) = 'object' and jsonb_typeof(next_state) = 'object'
  ),
  constraint restaurant_setting_events_action_id_key unique (restaurant_id, client_action_id)
);

create index restaurant_setting_events_restaurant_created_idx
  on public.restaurant_setting_events (restaurant_id, created_at desc, id desc);

alter table public.restaurant_setting_events enable row level security;
revoke all on table public.restaurant_setting_events from public, anon, authenticated, service_role;

create or replace function private.prevent_restaurant_setting_event_mutation_v1()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'Restaurant setting audit events are immutable.';
end;
$$;

create trigger restaurant_setting_events_immutable
before update or delete on public.restaurant_setting_events
for each row execute function private.prevent_restaurant_setting_event_mutation_v1();

create or replace function private.restaurant_settings_json_v1(p_restaurant public.restaurants)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'name', p_restaurant.name,
    'tagline', p_restaurant.tagline,
    'description', p_restaurant.description,
    'phone', p_restaurant.phone,
    'addressLine1', p_restaurant.address_line1,
    'city', p_restaurant.city,
    'state', p_restaurant.state,
    'postalCode', p_restaurant.postal_code,
    'googleMapsUrl', p_restaurant.google_maps_url,
    'instagramUrl', p_restaurant.instagram_url,
    'facebookUrl', p_restaurant.facebook_url
  );
$$;

create or replace function private.ordering_settings_json_v1(
  p_settings public.restaurant_ordering_settings,
  p_policy public.restaurant_refund_policies
)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'pickupEnabled', p_settings.pickup_enabled,
    'asapEnabled', p_settings.asap_enabled,
    'scheduledPickupEnabled', p_settings.scheduled_pickup_enabled,
    'pickupLeadTimeMinutes', p_settings.pickup_lead_time_minutes,
    'pickupSlotIntervalMinutes', p_settings.pickup_slot_interval_minutes,
    'advanceOrderDays', p_settings.advance_order_days,
    'customerNameRequired', p_settings.customer_name_required,
    'customerEmailRequired', p_settings.customer_email_required,
    'customerPhoneRequired', p_settings.customer_phone_required,
    'customTipAdditiveCapCents', p_settings.custom_tip_additive_cap_cents,
    'refundWindowDays', p_policy.refund_window_days
  );
$$;

create or replace function private.hours_settings_json_v1(p_restaurant_id uuid)
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
    'hadMultipleIntervals', exists (
      select 1 from public.restaurant_business_hours hours
      where hours.restaurant_id = restaurant.id and hours.sort_order <> 0
    )
  )
  from public.restaurants restaurant where restaurant.id = p_restaurant_id;
$$;

create or replace function public.get_managed_restaurant_settings_v1(p_restaurant_slug text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare access_record record; restaurant_record public.restaurants%rowtype;
begin
  select * into strict access_record from private.require_restaurant_capability_v1(
    p_restaurant_slug, 'manage_restaurant_settings');
  select * into strict restaurant_record from public.restaurants where id = access_record.restaurant_id;
  return private.restaurant_settings_json_v1(restaurant_record);
end;
$$;

create or replace function public.update_managed_restaurant_settings_v1(
  p_restaurant_slug text, p_settings jsonb, p_client_action_id uuid
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  access_record record; restaurant_record public.restaurants%rowtype;
  previous_state jsonb; next_state jsonb; setting_key text; value text;
begin
  select * into strict access_record from private.require_restaurant_capability_v1(
    p_restaurant_slug, 'manage_restaurant_settings');
  if p_client_action_id is null or p_settings is null or jsonb_typeof(p_settings) <> 'object' then
    raise exception using message = 'MM_MANAGEMENT_INVALID_REQUEST|Restaurant settings are invalid.';
  end if;
  if exists (select 1 from public.restaurant_setting_events event
    where event.restaurant_id = access_record.restaurant_id and event.client_action_id = p_client_action_id)
  then
    select event.next_state into next_state from public.restaurant_setting_events event
    where event.restaurant_id = access_record.restaurant_id and event.client_action_id = p_client_action_id
      and event.action = 'settings.restaurant_updated';
    if next_state is null then raise exception using message = 'MM_MANAGEMENT_CONFLICT|This action identifier was already used.'; end if;
    return next_state;
  end if;
  for setting_key in select jsonb_object_keys(p_settings) loop
    if setting_key not in ('name','tagline','description','phone','addressLine1','city','state','postalCode','googleMapsUrl','instagramUrl','facebookUrl')
    then raise exception using message = 'MM_MANAGEMENT_INVALID_REQUEST|Restaurant settings are invalid.'; end if;
  end loop;
  if not (p_settings ?& array['name','tagline','description','phone','addressLine1','city','state','postalCode','googleMapsUrl','instagramUrl','facebookUrl'])
  then raise exception using message = 'MM_MANAGEMENT_INVALID_REQUEST|Restaurant settings are incomplete.'; end if;
  if jsonb_typeof(p_settings -> 'name') <> 'string'
    or exists (select 1 from unnest(array['tagline','description','phone','addressLine1','city','state','postalCode','googleMapsUrl','instagramUrl','facebookUrl']) key
      where jsonb_typeof(p_settings -> key) not in ('string', 'null'))
  then raise exception using message = 'MM_MANAGEMENT_INVALID_REQUEST|Restaurant fields must be text or null.'; end if;
  value := btrim(coalesce(p_settings ->> 'name', ''));
  if value = '' or char_length(value) > 120 then raise exception using message = 'MM_MANAGEMENT_INVALID_REQUEST|Restaurant name must be 1 to 120 characters.'; end if;
  if char_length(btrim(coalesce(p_settings ->> 'tagline',''))) > 180
    or char_length(btrim(coalesce(p_settings ->> 'description',''))) > 2000
    or char_length(btrim(coalesce(p_settings ->> 'phone',''))) > 40
    or char_length(btrim(coalesce(p_settings ->> 'addressLine1',''))) > 200
    or char_length(btrim(coalesce(p_settings ->> 'city',''))) > 100
    or char_length(btrim(coalesce(p_settings ->> 'state',''))) > 100
    or char_length(btrim(coalesce(p_settings ->> 'postalCode',''))) > 20
  then raise exception using message = 'MM_MANAGEMENT_INVALID_REQUEST|One or more restaurant fields are too long.'; end if;
  foreach setting_key in array array['googleMapsUrl','instagramUrl','facebookUrl'] loop
    value := nullif(btrim(coalesce(p_settings ->> setting_key, '')), '');
    if value is not null and (char_length(value) > 2048 or value !~ '^https://[^[:space:]]+$')
    then raise exception using message = 'MM_MANAGEMENT_INVALID_REQUEST|Links must be valid https:// URLs.'; end if;
  end loop;
  select * into strict restaurant_record from public.restaurants where id = access_record.restaurant_id for update;
  previous_state := private.restaurant_settings_json_v1(restaurant_record);
  update public.restaurants set
    name = btrim(p_settings ->> 'name'),
    tagline = nullif(btrim(coalesce(p_settings ->> 'tagline','')), ''),
    description = nullif(btrim(coalesce(p_settings ->> 'description','')), ''),
    phone = nullif(btrim(coalesce(p_settings ->> 'phone','')), ''),
    address_line1 = nullif(btrim(coalesce(p_settings ->> 'addressLine1','')), ''),
    city = nullif(btrim(coalesce(p_settings ->> 'city','')), ''),
    state = nullif(btrim(coalesce(p_settings ->> 'state','')), ''),
    postal_code = nullif(btrim(coalesce(p_settings ->> 'postalCode','')), ''),
    google_maps_url = nullif(btrim(coalesce(p_settings ->> 'googleMapsUrl','')), ''),
    instagram_url = nullif(btrim(coalesce(p_settings ->> 'instagramUrl','')), ''),
    facebook_url = nullif(btrim(coalesce(p_settings ->> 'facebookUrl','')), '')
  where id = access_record.restaurant_id returning * into restaurant_record;
  next_state := private.restaurant_settings_json_v1(restaurant_record);
  insert into public.restaurant_setting_events
    (restaurant_id, actor_user_id, actor_membership_id, client_action_id, action, previous_state, next_state)
  values (access_record.restaurant_id, (select auth.uid()), access_record.membership_id,
    p_client_action_id, 'settings.restaurant_updated', previous_state, next_state);
  return next_state;
end;
$$;

create or replace function public.get_managed_ordering_settings_v1(p_restaurant_slug text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare access_record record; settings_record public.restaurant_ordering_settings%rowtype; policy_record public.restaurant_refund_policies%rowtype;
begin
  select * into strict access_record from private.require_restaurant_capability_v1(p_restaurant_slug, 'manage_restaurant_settings');
  select * into strict settings_record from public.restaurant_ordering_settings where restaurant_id = access_record.restaurant_id;
  select * into strict policy_record from public.restaurant_refund_policies where restaurant_id = access_record.restaurant_id;
  return private.ordering_settings_json_v1(settings_record, policy_record);
end;
$$;

create or replace function public.update_managed_ordering_settings_v1(
  p_restaurant_slug text, p_settings jsonb, p_client_action_id uuid
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  access_record record; settings_record public.restaurant_ordering_settings%rowtype;
  policy_record public.restaurant_refund_policies%rowtype; previous_state jsonb; next_state jsonb;
  setting_key text; v_pickup_enabled boolean; v_asap_enabled boolean; v_scheduled_enabled boolean;
  v_lead_minutes integer; v_slot_minutes integer; v_advance_days integer; v_tip_cap integer; v_refund_days integer;
begin
  select * into strict access_record from private.require_restaurant_capability_v1(p_restaurant_slug, 'manage_restaurant_settings');
  if p_client_action_id is null or p_settings is null or jsonb_typeof(p_settings) <> 'object' then
    raise exception using message = 'MM_MANAGEMENT_INVALID_REQUEST|Ordering settings are invalid.';
  end if;
  if exists (select 1 from public.restaurant_setting_events event where event.restaurant_id = access_record.restaurant_id and event.client_action_id = p_client_action_id) then
    select event.next_state into next_state from public.restaurant_setting_events event
    where event.restaurant_id = access_record.restaurant_id and event.client_action_id = p_client_action_id and event.action = 'settings.ordering_updated';
    if next_state is null then raise exception using message = 'MM_MANAGEMENT_CONFLICT|This action identifier was already used.'; end if;
    return next_state;
  end if;
  for setting_key in select jsonb_object_keys(p_settings) loop
    if setting_key not in ('pickupEnabled','asapEnabled','scheduledPickupEnabled','pickupLeadTimeMinutes','pickupSlotIntervalMinutes','advanceOrderDays','customerNameRequired','customerEmailRequired','customerPhoneRequired','customTipAdditiveCapCents','refundWindowDays')
    then raise exception using message = 'MM_MANAGEMENT_INVALID_REQUEST|Ordering settings are invalid.'; end if;
  end loop;
  if not (p_settings ?& array['pickupEnabled','asapEnabled','scheduledPickupEnabled','pickupLeadTimeMinutes','pickupSlotIntervalMinutes','advanceOrderDays','customerNameRequired','customerEmailRequired','customerPhoneRequired','customTipAdditiveCapCents','refundWindowDays'])
  then raise exception using message = 'MM_MANAGEMENT_INVALID_REQUEST|Ordering settings are incomplete.'; end if;
  if exists (select 1 from unnest(array['pickupEnabled','asapEnabled','scheduledPickupEnabled','customerNameRequired','customerEmailRequired','customerPhoneRequired']) key
      where jsonb_typeof(p_settings -> key) <> 'boolean')
    or exists (select 1 from unnest(array['pickupLeadTimeMinutes','pickupSlotIntervalMinutes','advanceOrderDays','customTipAdditiveCapCents','refundWindowDays']) key
      where jsonb_typeof(p_settings -> key) <> 'number' or p_settings ->> key !~ '^\d+$')
  then raise exception using message = 'MM_MANAGEMENT_INVALID_REQUEST|Ordering values must use the expected types.'; end if;
  begin
    v_pickup_enabled := (p_settings ->> 'pickupEnabled')::boolean;
    v_asap_enabled := (p_settings ->> 'asapEnabled')::boolean;
    v_scheduled_enabled := (p_settings ->> 'scheduledPickupEnabled')::boolean;
    v_lead_minutes := (p_settings ->> 'pickupLeadTimeMinutes')::integer;
    v_slot_minutes := (p_settings ->> 'pickupSlotIntervalMinutes')::integer;
    v_advance_days := (p_settings ->> 'advanceOrderDays')::integer;
    v_tip_cap := (p_settings ->> 'customTipAdditiveCapCents')::integer;
    v_refund_days := (p_settings ->> 'refundWindowDays')::integer;
    perform (p_settings ->> 'customerNameRequired')::boolean;
    perform (p_settings ->> 'customerEmailRequired')::boolean;
    perform (p_settings ->> 'customerPhoneRequired')::boolean;
  exception when others then raise exception using message = 'MM_MANAGEMENT_INVALID_REQUEST|Ordering values must use the expected types.'; end;
  if (not v_pickup_enabled and (v_asap_enabled or v_scheduled_enabled))
    or v_lead_minutes not between 0 and 1440 or v_slot_minutes not between 5 and 1440
    or v_advance_days not between 0 and 30 or v_tip_cap not between 0 and 2147483647
    or v_refund_days not between 0 and 365
  then raise exception using message = 'MM_MANAGEMENT_INVALID_REQUEST|Ordering settings are outside supported ranges.'; end if;
  select * into strict settings_record from public.restaurant_ordering_settings where restaurant_id = access_record.restaurant_id for update;
  select * into strict policy_record from public.restaurant_refund_policies where restaurant_id = access_record.restaurant_id for update;
  previous_state := private.ordering_settings_json_v1(settings_record, policy_record);
  update public.restaurant_ordering_settings set
    pickup_enabled = v_pickup_enabled, asap_enabled = v_asap_enabled,
    scheduled_pickup_enabled = v_scheduled_enabled, pickup_lead_time_minutes = v_lead_minutes,
    pickup_slot_interval_minutes = v_slot_minutes, advance_order_days = v_advance_days,
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
    (restaurant_id, actor_user_id, actor_membership_id, client_action_id, action, previous_state, next_state)
  values (access_record.restaurant_id, (select auth.uid()), access_record.membership_id,
    p_client_action_id, 'settings.ordering_updated', previous_state, next_state);
  return next_state;
end;
$$;

create or replace function public.get_managed_hours_settings_v1(p_restaurant_slug text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare access_record record;
begin
  select * into strict access_record from private.require_restaurant_capability_v1(p_restaurant_slug, 'manage_restaurant_settings');
  return private.hours_settings_json_v1(access_record.restaurant_id);
end;
$$;

create or replace function public.update_managed_hours_settings_v1(
  p_restaurant_slug text, p_days jsonb, p_client_action_id uuid
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  access_record record; previous_state jsonb; next_state jsonb; day_value jsonb;
  day_number integer; closed boolean; opening time; closing time;
begin
  select * into strict access_record from private.require_restaurant_capability_v1(p_restaurant_slug, 'manage_restaurant_settings');
  if p_client_action_id is null or p_days is null or jsonb_typeof(p_days) <> 'array' or jsonb_array_length(p_days) <> 7
  then raise exception using message = 'MM_MANAGEMENT_INVALID_REQUEST|Include all seven days.'; end if;
  if exists (select 1 from public.restaurant_setting_events event where event.restaurant_id = access_record.restaurant_id and event.client_action_id = p_client_action_id) then
    select event.next_state into next_state from public.restaurant_setting_events event
    where event.restaurant_id = access_record.restaurant_id and event.client_action_id = p_client_action_id and event.action = 'settings.hours_updated';
    if next_state is null then raise exception using message = 'MM_MANAGEMENT_CONFLICT|This action identifier was already used.'; end if;
    return next_state;
  end if;
  if (select count(distinct (entry ->> 'dayOfWeek')::integer) from jsonb_array_elements(p_days) entry) <> 7
  then raise exception using message = 'MM_MANAGEMENT_INVALID_REQUEST|Include each day exactly once.'; end if;
  previous_state := private.hours_settings_json_v1(access_record.restaurant_id);
  delete from public.restaurant_business_hours where restaurant_id = access_record.restaurant_id;
  for day_value in select * from jsonb_array_elements(p_days) loop
    if jsonb_typeof(day_value) <> 'object'
      or jsonb_typeof(day_value -> 'dayOfWeek') <> 'number'
      or day_value ->> 'dayOfWeek' !~ '^\d$'
      or jsonb_typeof(day_value -> 'isClosed') <> 'boolean'
      or jsonb_typeof(day_value -> 'openTime') not in ('string', 'null')
      or jsonb_typeof(day_value -> 'closeTime') not in ('string', 'null')
    then raise exception using message = 'MM_MANAGEMENT_INVALID_REQUEST|Business hours contain invalid values.'; end if;
    begin
      day_number := (day_value ->> 'dayOfWeek')::integer;
      closed := (day_value ->> 'isClosed')::boolean;
      opening := nullif(day_value ->> 'openTime', '')::time;
      closing := nullif(day_value ->> 'closeTime', '')::time;
    exception when others then raise exception using message = 'MM_MANAGEMENT_INVALID_REQUEST|Business hours contain invalid values.'; end;
    if day_number not between 0 and 6 or (not closed and (opening is null or closing is null or opening >= closing))
    then raise exception using message = 'MM_MANAGEMENT_INVALID_REQUEST|Open days require a supported opening time before closing time.'; end if;
    insert into public.restaurant_business_hours
      (restaurant_id, day_of_week, open_time, close_time, is_closed, sort_order)
    values (access_record.restaurant_id, day_number,
      case when closed then null else opening end, case when closed then null else closing end, closed, 0);
  end loop;
  next_state := private.hours_settings_json_v1(access_record.restaurant_id);
  insert into public.restaurant_setting_events
    (restaurant_id, actor_user_id, actor_membership_id, client_action_id, action, previous_state, next_state)
  values (access_record.restaurant_id, (select auth.uid()), access_record.membership_id,
    p_client_action_id, 'settings.hours_updated', previous_state, next_state);
  return next_state;
end;
$$;

revoke all on function private.prevent_restaurant_setting_event_mutation_v1() from public, anon, authenticated;
revoke all on function private.restaurant_settings_json_v1(public.restaurants) from public, anon, authenticated;
revoke all on function private.ordering_settings_json_v1(public.restaurant_ordering_settings, public.restaurant_refund_policies) from public, anon, authenticated;
revoke all on function private.hours_settings_json_v1(uuid) from public, anon, authenticated;
revoke all on function public.get_managed_restaurant_settings_v1(text) from public, anon, authenticated, service_role;
revoke all on function public.update_managed_restaurant_settings_v1(text, jsonb, uuid) from public, anon, authenticated, service_role;
revoke all on function public.get_managed_ordering_settings_v1(text) from public, anon, authenticated, service_role;
revoke all on function public.update_managed_ordering_settings_v1(text, jsonb, uuid) from public, anon, authenticated, service_role;
revoke all on function public.get_managed_hours_settings_v1(text) from public, anon, authenticated, service_role;
revoke all on function public.update_managed_hours_settings_v1(text, jsonb, uuid) from public, anon, authenticated, service_role;
grant execute on function public.get_managed_restaurant_settings_v1(text) to authenticated;
grant execute on function public.update_managed_restaurant_settings_v1(text, jsonb, uuid) to authenticated;
grant execute on function public.get_managed_ordering_settings_v1(text) to authenticated;
grant execute on function public.update_managed_ordering_settings_v1(text, jsonb, uuid) to authenticated;
grant execute on function public.get_managed_hours_settings_v1(text) to authenticated;
grant execute on function public.update_managed_hours_settings_v1(text, jsonb, uuid) to authenticated;

commit;
