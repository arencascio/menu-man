-- STAGING ONLY. Run after first-owner bootstrap. Gives each active Armando
-- owner an idempotent Test Kitchen owner membership for multi-tenant QA.

\if :{?menu_man_environment}
\else
  \echo 'Missing -v menu_man_environment=staging'
  \quit
\endif

begin;

select pg_catalog.set_config('menu_man.seed_environment', :'menu_man_environment', false);

do $$
begin
  if pg_catalog.current_setting('menu_man.seed_environment') <> 'staging' then
    raise exception 'Test Kitchen membership linking is restricted to staging';
  end if;
end;
$$;

do $$
declare
  armandos_uuid uuid;
  test_kitchen_uuid uuid;
  owner_record record;
  membership_uuid uuid;
begin
  select id into strict armandos_uuid from public.restaurants where slug = 'armandos';
  select id into strict test_kitchen_uuid from public.restaurants where slug = 'test-kitchen';

  for owner_record in
    select membership.user_id, membership.display_name
    from public.restaurant_memberships membership
    where membership.restaurant_id = armandos_uuid
      and membership.role = 'owner' and membership.status = 'active'
  loop
    insert into public.restaurant_memberships (
      restaurant_id, user_id, role, status, display_name, created_by_user_id
    ) values (
      test_kitchen_uuid, owner_record.user_id, 'owner', 'active',
      owner_record.display_name, owner_record.user_id
    ) on conflict (restaurant_id, user_id) do update set
      role = 'owner', status = 'active', display_name = excluded.display_name,
      revoked_at = null
    returning id into membership_uuid;

    insert into public.restaurant_access_events (
      restaurant_id, target_membership_id, actor_user_id, actor_membership_id,
      action, previous_state, next_state, metadata
    )
    select test_kitchen_uuid, membership_uuid, owner_record.user_id,
      membership_uuid, 'membership.bootstrapped', '{}'::jsonb,
      jsonb_build_object(
        'displayName', owner_record.display_name, 'role', 'owner',
        'status', 'active',
        'capabilities', private.membership_capabilities_v1(membership_uuid, 'owner')
      ), jsonb_build_object('source', 'staging_multi_tenant_fixture')
    where not exists (
      select 1 from public.restaurant_access_events event
      where event.restaurant_id = test_kitchen_uuid
        and event.target_membership_id = membership_uuid
        and event.action = 'membership.bootstrapped'
    );
  end loop;

  if not exists (
    select 1 from public.restaurant_memberships membership
    where membership.restaurant_id = test_kitchen_uuid
      and membership.status = 'active'
  ) then
    raise exception 'Bootstrap an active Armando owner before linking Test Kitchen membership';
  end if;
end;
$$;

commit;
