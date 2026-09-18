-- STAGING CONTRACT TEST. Run after Test Kitchen memberships. All changes roll back.

begin;

do $$
declare
  armandos_uuid uuid;
  test_uuid uuid;
  owner_user uuid;
  armandos_membership uuid;
  test_membership uuid;
  original_armandos_name text;
  result jsonb;
  action_id uuid := gen_random_uuid();
  special_action_id uuid := gen_random_uuid();
  special_id uuid := gen_random_uuid();
begin
  select id, name into strict armandos_uuid, original_armandos_name
  from public.restaurants where slug = 'armandos';
  select id into strict test_uuid from public.restaurants where slug = 'test-kitchen';
  select id, user_id into strict armandos_membership, owner_user
  from public.restaurant_memberships
  where restaurant_id = armandos_uuid and role = 'owner' and status = 'active' limit 1;
  select id into strict test_membership from public.restaurant_memberships
  where restaurant_id = test_uuid and user_id = owner_user and status = 'active';
  perform set_config('request.jwt.claims', jsonb_build_object('sub', owner_user, 'role', 'authenticated')::text, true);

  if not private.member_has_capability_v1(armandos_membership, 'owner', 'manage_restaurant_settings')
    or not private.member_has_capability_v1(armandos_membership, 'manager', 'manage_restaurant_settings')
    or private.member_has_capability_v1(armandos_membership, 'staff', 'manage_restaurant_settings')
  then raise exception 'Restaurant settings role defaults are incorrect'; end if;

  insert into public.restaurant_membership_permission_overrides
    (restaurant_id, membership_id, capability, allowed, created_by_user_id)
  values (armandos_uuid, armandos_membership, 'manage_restaurant_settings', false, owner_user);
  begin
    perform public.get_managed_restaurant_settings_v1('armandos');
    raise exception 'Explicit restaurant settings deny was ignored';
  exception when others then
    if sqlerrm not like 'MM_MANAGEMENT_FORBIDDEN|%' then raise; end if;
  end;
  delete from public.restaurant_membership_permission_overrides
  where membership_id = armandos_membership and capability = 'manage_restaurant_settings';

  update public.restaurant_memberships set status = 'revoked', revoked_at = now() where id = test_membership;
  begin
    perform public.get_managed_ordering_settings_v1('test-kitchen');
    raise exception 'Revoked Test Kitchen access could still read settings';
  exception when others then
    if sqlerrm not like 'MM_MANAGEMENT_FORBIDDEN|%' then raise; end if;
  end;
  if public.get_managed_restaurant_settings_v1('armandos') ->> 'name' <> original_armandos_name
  then raise exception 'Revoking Test Kitchen access affected Armando access'; end if;
  update public.restaurant_memberships set status = 'active', revoked_at = null where id = test_membership;

  result := public.update_managed_restaurant_settings_v1('test-kitchen', jsonb_build_object(
    'name', 'Settings Contract Kitchen', 'tagline', null, 'description', null, 'phone', null,
    'addressLine1', '100 Contract Way', 'city', 'Test City', 'state', 'CA', 'postalCode', '90000',
    'googleMapsUrl', 'https://maps.google.com/', 'instagramUrl', null, 'facebookUrl', null
  ), action_id);
  if result ->> 'name' <> 'Settings Contract Kitchen'
    or (select name from public.restaurants where id = armandos_uuid) <> original_armandos_name
    or not exists (select 1 from public.restaurant_setting_events where restaurant_id = test_uuid
      and actor_membership_id = test_membership and client_action_id = action_id)
  then raise exception 'Restaurant update/readback/audit was not tenant isolated'; end if;

  result := public.update_managed_ordering_settings_v1('test-kitchen', jsonb_build_object(
    'pickupEnabled', false, 'asapEnabled', false, 'scheduledPickupEnabled', false,
    'pickupLeadTimeMinutes', 20, 'pickupSlotIntervalMinutes', 10, 'advanceOrderDays', 5,
    'customerNameRequired', false, 'customerEmailRequired', true, 'customerPhoneRequired', false,
    'customTipAdditiveCapCents', 12345, 'refundWindowDays', 14
  ), gen_random_uuid());
  if result ->> 'customTipAdditiveCapCents' <> '12345'
    or public.get_pickup_availability_v1('test-kitchen') #>> '{asap,enabled}' <> 'false'
    or jsonb_array_length(public.get_pickup_availability_v1('test-kitchen') #> '{scheduled,slots}') <> 0
  then raise exception 'Ordering settings did not drive authoritative availability'; end if;

  result := public.update_managed_hours_settings_v1('test-kitchen', jsonb_build_array(
    jsonb_build_object('dayOfWeek',0,'isClosed',true,'openTime',null,'closeTime',null),
    jsonb_build_object('dayOfWeek',1,'isClosed',false,'openTime','09:00','closeTime','17:00'),
    jsonb_build_object('dayOfWeek',2,'isClosed',false,'openTime','09:00','closeTime','17:00'),
    jsonb_build_object('dayOfWeek',3,'isClosed',false,'openTime','09:00','closeTime','17:00'),
    jsonb_build_object('dayOfWeek',4,'isClosed',false,'openTime','09:00','closeTime','17:00'),
    jsonb_build_object('dayOfWeek',5,'isClosed',false,'openTime','09:00','closeTime','17:00'),
    jsonb_build_object('dayOfWeek',6,'isClosed',true,'openTime',null,'closeTime',null)
  ), gen_random_uuid());
  if jsonb_array_length(result -> 'days') <> 7
    or (select count(*) from public.restaurant_business_hours where restaurant_id = test_uuid) <> 7
  then raise exception 'Weekly hours did not save and read back'; end if;

  result := public.get_managed_hours_settings_v2('test-kitchen');
  result := public.update_managed_hours_settings_v2(
    'test-kitchen', result -> 'days', jsonb_build_array(jsonb_build_object(
      'id', special_id, 'serviceDate', '2037-12-25', 'label', 'Tenant audit holiday',
      'isClosed', true, 'openTime', null, 'closeTime', null
    )), special_action_id
  );
  if result #>> '{specialDates,0,label}' <> 'Tenant audit holiday'
    or not exists (select 1 from public.restaurant_special_hours special
      where special.id = special_id and special.restaurant_id = test_uuid)
    or exists (select 1 from public.restaurant_special_hours special
      where special.restaurant_id = armandos_uuid and special.service_date = date '2037-12-25')
    or not exists (select 1 from public.restaurant_setting_events event
      where event.restaurant_id = test_uuid and event.actor_membership_id = test_membership
        and event.client_action_id = special_action_id
        and event.previous_state ? 'specialDates' and event.next_state ? 'specialDates')
  then raise exception 'Special hours were not tenant isolated and audited'; end if;

  result := public.update_managed_hours_settings_v2(
    'test-kitchen', result -> 'days', '[]'::jsonb, gen_random_uuid()
  );
  if exists (select 1 from public.restaurant_special_hours where id = special_id)
    or jsonb_array_length(result -> 'specialDates') <> 0
  then raise exception 'Deleting a special-hours exception did not restore the empty state'; end if;

  begin
    perform public.update_managed_hours_settings_v1('test-kitchen', jsonb_build_array(
      jsonb_build_object('dayOfWeek',0,'isClosed',false,'openTime','17:00','closeTime','09:00')
    ), gen_random_uuid());
    raise exception 'Impossible hours were accepted';
  exception when others then
    if sqlerrm not like 'MM_MANAGEMENT_INVALID_REQUEST|%' then raise; end if;
  end;
end;
$$;

rollback;
