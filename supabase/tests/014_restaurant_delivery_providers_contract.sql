-- STAGING CONTRACT TEST. Run after Test Kitchen memberships. All changes roll back.

begin;

do $$
declare
  armandos_uuid uuid;
  test_uuid uuid;
  owner_user uuid;
  test_membership uuid;
  first_provider_id uuid := gen_random_uuid();
  second_provider_id uuid := gen_random_uuid();
  action_id uuid := gen_random_uuid();
  result jsonb;
begin
  select id into strict armandos_uuid from public.restaurants where slug = 'armandos';
  select id into strict test_uuid from public.restaurants where slug = 'test-kitchen';
  select membership.user_id, membership.id into strict owner_user, test_membership
  from public.restaurant_memberships membership
  where membership.restaurant_id = test_uuid
    and membership.role = 'owner'
    and membership.status = 'active'
  limit 1;
  perform set_config('request.jwt.claims', jsonb_build_object(
    'sub', owner_user, 'role', 'authenticated'
  )::text, true);

  result := public.update_managed_delivery_settings_v1(
    'test-kitchen',
    jsonb_build_array(
      jsonb_build_object(
        'id', first_provider_id,
        'displayName', 'Provider One',
        'providerKey', null,
        'destinationUrl', 'https://delivery.example.test/one',
        'imageUrl', null,
        'sortOrder', 0,
        'isActive', true
      ),
      jsonb_build_object(
        'id', second_provider_id,
        'displayName', 'Provider Two',
        'providerKey', null,
        'destinationUrl', 'https://delivery.example.test/two',
        'imageUrl', null,
        'sortOrder', 1,
        'isActive', false
      )
    ),
    action_id
  );

  if jsonb_array_length(result -> 'providers') <> 2
    or result #>> '{providers,0,displayName}' <> 'Provider One'
    or result #>> '{providers,1,isActive}' <> 'false'
    or (select count(*) from public.restaurant_delivery_providers where restaurant_id = test_uuid) <> 2
    or exists (
      select 1 from public.restaurant_delivery_providers
      where restaurant_id = armandos_uuid and id in (first_provider_id, second_provider_id)
    )
    or not exists (
      select 1 from public.restaurant_setting_events event
      where event.restaurant_id = test_uuid
        and event.actor_membership_id = test_membership
        and event.client_action_id = action_id
        and event.action = 'settings.delivery_updated'
    )
  then
    raise exception 'Delivery provider save/readback/audit was not tenant isolated';
  end if;

  if public.update_managed_delivery_settings_v1(
    'test-kitchen', result -> 'providers', action_id
  ) is distinct from result then
    raise exception 'Delivery provider idempotent replay changed the result';
  end if;

  result := public.update_managed_delivery_settings_v1(
    'test-kitchen',
    jsonb_build_array((result -> 'providers' -> 1) || jsonb_build_object('sortOrder', 0)),
    gen_random_uuid()
  );
  if jsonb_array_length(result -> 'providers') <> 1
    or result #>> '{providers,0,displayName}' <> 'Provider Two'
    or exists (
      select 1 from public.restaurant_delivery_providers
      where restaurant_id = test_uuid and id = first_provider_id
    )
  then
    raise exception 'Removing and reordering delivery providers did not replace the tenant list';
  end if;

  begin
    perform public.update_managed_delivery_settings_v1(
      'test-kitchen',
      jsonb_build_array(jsonb_build_object(
        'id', gen_random_uuid(),
        'displayName', 'Unsafe provider',
        'providerKey', null,
        'destinationUrl', 'javascript:alert(1)',
        'imageUrl', null,
        'sortOrder', 0,
        'isActive', true
      )),
      gen_random_uuid()
    );
    raise exception 'Invalid delivery URL was accepted';
  exception when others then
    if sqlerrm not like 'MM_MANAGEMENT_INVALID_REQUEST|%' then raise; end if;
  end;
end;
$$;

rollback;
