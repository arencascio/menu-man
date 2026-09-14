-- STAGING CONTRACT TEST. Run after 202609140003 and first-owner bootstrap.
-- The outer transaction rolls back policy probes and any audit rows.

begin;

do $$
declare
  restaurant_uuid uuid;
  owner_membership_uuid uuid;
  owner_user_uuid uuid;
  owner_capabilities text[];
  result jsonb;
begin
  select restaurant.id into strict restaurant_uuid
  from public.restaurants restaurant
  where restaurant.slug = 'armandos' and restaurant.is_active;

  select membership.id, membership.user_id
    into strict owner_membership_uuid, owner_user_uuid
  from public.restaurant_memberships membership
  where membership.restaurant_id = restaurant_uuid
    and membership.role = 'owner'
    and membership.status = 'active'
  order by membership.created_at
  limit 1;

  owner_capabilities := private.membership_capabilities_v1(
    owner_membership_uuid, 'owner'
  );
  if not ('manage_memberships' = any(owner_capabilities))
    or not ('issue_refunds' = any(owner_capabilities))
  then raise exception 'Owner effective capabilities are incomplete'; end if;

  perform set_config('request.jwt.claims', jsonb_build_object(
    'sub', owner_user_uuid, 'role', 'authenticated'
  )::text, true);

  result := public.authorize_restaurant_member_invite_v1(
    'armandos', 'staff', array['view_orders', 'advance_fulfillment']
  );
  if (result ->> 'actorMembershipId')::uuid <> owner_membership_uuid then
    raise exception 'Invite preflight did not bind the authenticated membership';
  end if;

  if not exists (
    select 1 from public.list_restaurant_team_v1('armandos') team
    where team.membership_id = owner_membership_uuid
      and team.member_role = 'owner'
      and team.member_status = 'active'
      and team.email is not null
  ) then raise exception 'Authorized team list omitted the current owner'; end if;

  begin
    perform private.assert_team_assignment_v1(
      owner_membership_uuid, 'manager', null, 'owner', array['view_orders']
    );
    raise exception 'A non-owner policy probe was allowed to create an owner';
  exception when others then
    if sqlerrm not like 'MM_MANAGEMENT_FORBIDDEN|Only an owner%' then raise; end if;
  end;

  begin
    perform private.assert_team_assignment_v1(
      owner_membership_uuid, 'staff', null, 'staff', array['issue_refunds']
    );
    raise exception 'An actor granted a capability absent from their effective access';
  exception when others then
    if sqlerrm not like 'MM_MANAGEMENT_FORBIDDEN|You cannot grant%' then raise; end if;
  end;

  begin
    perform public.update_restaurant_member_v1(
      'armandos', owner_membership_uuid, 'Contract Owner', 'manager',
      array['view_orders'], gen_random_uuid()
    );
    raise exception 'The final active owner was demoted';
  exception when others then
    if sqlerrm not like 'MM_MANAGEMENT_CONFLICT|The final active owner cannot be demoted.%' then raise; end if;
  end;

  begin
    perform public.revoke_restaurant_member_v1(
      'armandos', owner_membership_uuid, 'contract probe', gen_random_uuid()
    );
    raise exception 'The final active owner was revoked';
  exception when others then
    if sqlerrm not like 'MM_MANAGEMENT_CONFLICT|The final active owner cannot be revoked.%' then raise; end if;
  end;

  perform set_config('request.jwt.claims', jsonb_build_object(
    'sub', gen_random_uuid(), 'role', 'authenticated'
  )::text, true);
  begin
    perform public.list_restaurant_team_v1('armandos');
    raise exception 'A cross-tenant/non-member user listed the team';
  exception when others then
    if sqlerrm not like 'MM_MANAGEMENT_FORBIDDEN|%' then raise; end if;
  end;

  if has_function_privilege('anon', 'public.list_restaurant_team_v1(text)', 'EXECUTE')
    or has_function_privilege('anon', 'public.provision_restaurant_member_v1(text,uuid,text,text,text[],uuid,boolean)', 'EXECUTE')
    or has_table_privilege('authenticated', 'public.restaurant_memberships', 'UPDATE')
    or has_table_privilege('authenticated', 'public.restaurant_access_events', 'DELETE')
  then raise exception 'Restaurant user management exposes an unsafe privilege'; end if;
end;
$$;

rollback;
