-- Restaurant user management: invite lifecycle, granular capability assignment,
-- tenant-safe mutations, last-owner protection, and immutable access auditing.

begin;

alter table public.restaurant_memberships
  drop constraint restaurant_memberships_status_check,
  drop constraint restaurant_memberships_revocation_check;

alter table public.restaurant_memberships
  add constraint restaurant_memberships_status_check
    check (status in ('invited', 'active', 'revoked')),
  add constraint restaurant_memberships_revocation_check check (
    (status in ('invited', 'active') and revoked_at is null)
    or (status = 'revoked' and revoked_at is not null)
  );

create index restaurant_memberships_restaurant_status_idx
  on public.restaurant_memberships (restaurant_id, status, role, created_at, id);

alter table public.restaurant_access_events
  drop constraint restaurant_access_events_action_check;

alter table public.restaurant_access_events
  add column actor_membership_id uuid,
  add column client_action_id uuid,
  add column metadata jsonb not null default '{}'::jsonb;

-- Preserve compatibility with any pre-v1 operator-created events that already
-- identify an actor user but predate actor_membership_id.
update public.restaurant_access_events event
set actor_membership_id = actor.id
from public.restaurant_memberships actor
where event.actor_user_id = actor.user_id
  and event.restaurant_id = actor.restaurant_id
  and event.actor_membership_id is null;

alter table public.restaurant_access_events
  add constraint restaurant_access_events_actor_membership_fkey
    foreign key (restaurant_id, actor_membership_id)
    references public.restaurant_memberships(restaurant_id, id) on delete restrict,
  add constraint restaurant_access_events_action_check check (
    action in (
      'membership.bootstrapped', 'membership.created', 'membership.updated',
      'membership.invited', 'membership.invitation_resend_requested',
      'membership.invitation_resent', 'membership.invitation_resend_failed',
      'membership.activated', 'membership.reinstated',
      'membership.role_changed', 'membership.capabilities_changed',
      'membership.revoked', 'permission.changed'
    )
  ),
  add constraint restaurant_access_events_actor_check check (
    (actor_user_id is null and actor_membership_id is null)
    or (actor_user_id is not null and actor_membership_id is not null)
  ),
  add constraint restaurant_access_events_metadata_check
    check (jsonb_typeof(metadata) = 'object'),
  add constraint restaurant_access_events_restaurant_action_key
    unique (restaurant_id, client_action_id);

create index restaurant_access_events_target_created_idx
  on public.restaurant_access_events (target_membership_id, created_at desc, id desc);

create or replace function private.membership_capabilities_v1(
  p_membership_id uuid,
  p_role text
)
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(capability.capability order by capability.capability)
    filter (where private.member_has_capability_v1(
      p_membership_id, p_role, capability.capability
    )), '{}'::text[])
  from public.restaurant_capabilities capability;
$$;

create or replace function private.membership_access_state_v1(
  p_membership public.restaurant_memberships
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'displayName', (p_membership).display_name,
    'role', (p_membership).role,
    'status', (p_membership).status,
    'capabilities', private.membership_capabilities_v1(
      (p_membership).id, (p_membership).role
    )
  );
$$;

create or replace function private.assert_team_assignment_v1(
  p_actor_membership_id uuid,
  p_actor_role text,
  p_current_target_role text,
  p_target_role text,
  p_capabilities text[]
)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  requested_capability text;
begin
  if p_target_role not in ('owner', 'manager', 'staff') then
    raise exception using message = 'MM_MANAGEMENT_INVALID_REQUEST|Choose a valid role.';
  end if;

  if p_actor_role <> 'owner'
    and (p_target_role = 'owner' or p_current_target_role = 'owner')
  then
    raise exception using message = 'MM_MANAGEMENT_FORBIDDEN|Only an owner can manage owners.';
  end if;

  if exists (
    select 1
    from unnest(coalesce(p_capabilities, '{}'::text[])) requested(value)
    left join public.restaurant_capabilities capability
      on capability.capability = requested.value
    where capability.capability is null
  ) then
    raise exception using message = 'MM_MANAGEMENT_INVALID_REQUEST|A requested permission is unavailable.';
  end if;

  for requested_capability in
    select distinct value
    from unnest(coalesce(p_capabilities, '{}'::text[])) requested(value)
  loop
    if not private.member_has_capability_v1(
      p_actor_membership_id, p_actor_role, requested_capability
    ) then
      raise exception using message = 'MM_MANAGEMENT_FORBIDDEN|You cannot grant a permission you do not have.';
    end if;
  end loop;
end;
$$;

create or replace function private.replace_membership_capabilities_v1(
  p_restaurant_id uuid,
  p_membership_id uuid,
  p_role text,
  p_capabilities text[],
  p_actor_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.restaurant_membership_permission_overrides permission
  where permission.membership_id = p_membership_id;

  insert into public.restaurant_membership_permission_overrides (
    restaurant_id, membership_id, capability, allowed, created_by_user_id
  )
  select p_restaurant_id,
         p_membership_id,
         capability.capability,
         capability.capability = any(coalesce(p_capabilities, '{}'::text[])),
         p_actor_user_id
  from public.restaurant_capabilities capability
  join public.restaurant_role_capability_defaults role_default
    on role_default.role = p_role
   and role_default.capability = capability.capability
  where role_default.allowed <>
    (capability.capability = any(coalesce(p_capabilities, '{}'::text[])));
end;
$$;

create or replace function public.authorize_restaurant_member_invite_v1(
  p_restaurant_slug text,
  p_role text,
  p_capabilities text[]
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor_record record;
begin
  select * into strict actor_record
  from private.require_restaurant_capability_v1(
    p_restaurant_slug, 'manage_memberships'
  );
  perform private.assert_team_assignment_v1(
    actor_record.membership_id, actor_record.member_role,
    null, p_role, p_capabilities
  );
  return jsonb_build_object(
    'restaurantId', actor_record.restaurant_id,
    'actorMembershipId', actor_record.membership_id,
    'actorRole', actor_record.member_role
  );
end;
$$;

create or replace function public.provision_restaurant_member_v1(
  p_restaurant_slug text,
  p_user_id uuid,
  p_display_name text,
  p_role text,
  p_capabilities text[],
  p_client_action_id uuid,
  p_existing_auth_user boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_record record;
  target_record public.restaurant_memberships%rowtype;
  previous_state jsonb := '{}'::jsonb;
  target_email text;
  target_confirmed_at timestamptz;
  next_status text;
  event_action text := 'membership.invited';
  replay_event public.restaurant_access_events%rowtype;
begin
  select * into strict actor_record
  from private.require_restaurant_capability_v1(
    p_restaurant_slug, 'manage_memberships'
  );
  perform private.assert_team_assignment_v1(
    actor_record.membership_id, actor_record.member_role,
    null, p_role, p_capabilities
  );

  if btrim(coalesce(p_display_name, '')) = '' or char_length(p_display_name) > 200 then
    raise exception using message = 'MM_MANAGEMENT_INVALID_REQUEST|Enter a valid display name.';
  end if;

  select event.* into replay_event
  from public.restaurant_access_events event
  where event.restaurant_id = actor_record.restaurant_id
    and event.client_action_id = p_client_action_id;
  if found then
    return jsonb_build_object(
      'membershipId', replay_event.target_membership_id,
      'replayed', true,
      'action', replay_event.action
    );
  end if;

  select lower(users.email), users.email_confirmed_at
    into target_email, target_confirmed_at
  from auth.users users where users.id = p_user_id;
  if target_email is null then
    raise exception using message = 'MM_MANAGEMENT_INVALID_REQUEST|The invited Auth user does not exist.';
  end if;
  next_status := case when target_confirmed_at is null then 'invited' else 'active' end;

  perform pg_advisory_xact_lock(hashtextextended(actor_record.restaurant_id::text, 0));
  select membership.* into target_record
  from public.restaurant_memberships membership
  where membership.restaurant_id = actor_record.restaurant_id
    and membership.user_id = p_user_id
  for update;

  if found then
    previous_state := private.membership_access_state_v1(target_record);
    if target_record.status <> 'revoked' then
      if target_record.display_name = btrim(p_display_name)
        and target_record.role = p_role
        and private.membership_capabilities_v1(target_record.id, target_record.role)
          = coalesce((select array_agg(distinct requested.value order by requested.value)
              from unnest(coalesce(p_capabilities, '{}'::text[])) requested(value)), '{}'::text[])
      then
        return jsonb_build_object(
          'membershipId', target_record.id,
          'status', target_record.status,
          'replayed', true,
          'action', 'unchanged'
        );
      end if;
      raise exception using message = 'MM_MANAGEMENT_CONFLICT|This user is already a restaurant member.';
    end if;
    perform private.assert_team_assignment_v1(
      actor_record.membership_id, actor_record.member_role,
      target_record.role, p_role, p_capabilities
    );
    update public.restaurant_memberships
    set display_name = btrim(p_display_name), role = p_role,
        status = next_status, revoked_at = null,
        created_by_user_id = (select auth.uid())
    where id = target_record.id
    returning * into target_record;
    event_action := 'membership.reinstated';
  else
    insert into public.restaurant_memberships (
      restaurant_id, user_id, role, status, display_name, created_by_user_id
    ) values (
      actor_record.restaurant_id, p_user_id, p_role, next_status,
      btrim(p_display_name), (select auth.uid())
    ) returning * into target_record;
  end if;

  perform private.replace_membership_capabilities_v1(
    actor_record.restaurant_id, target_record.id, p_role,
    p_capabilities, (select auth.uid())
  );
  select membership.* into target_record
  from public.restaurant_memberships membership where membership.id = target_record.id;

  insert into public.restaurant_access_events (
    restaurant_id, target_membership_id, actor_user_id,
    actor_membership_id, client_action_id, action,
    previous_state, next_state, metadata
  ) values (
    actor_record.restaurant_id, target_record.id, (select auth.uid()),
    actor_record.membership_id, p_client_action_id, event_action,
    previous_state, private.membership_access_state_v1(target_record),
    jsonb_build_object(
      'existingAuthUser', p_existing_auth_user,
      'emailHash', pg_catalog.encode(
        extensions.digest(pg_catalog.convert_to(target_email, 'UTF8'), 'sha256'),
        'hex'
      )
    )
  );

  if event_action = 'membership.invited' and target_record.status = 'active' then
    insert into public.restaurant_access_events (
      restaurant_id, target_membership_id, actor_user_id,
      actor_membership_id, action, previous_state, next_state, metadata
    ) values (
      actor_record.restaurant_id, target_record.id, (select auth.uid()),
      actor_record.membership_id, 'membership.activated',
      jsonb_set(private.membership_access_state_v1(target_record),
        '{status}', '"invited"'::jsonb),
      private.membership_access_state_v1(target_record),
      jsonb_build_object('source', 'existing_auth_account')
    );
  end if;

  return jsonb_build_object(
    'membershipId', target_record.id,
    'status', target_record.status,
    'replayed', false,
    'action', event_action
  );
end;
$$;

create or replace function public.update_restaurant_member_v1(
  p_restaurant_slug text,
  p_membership_id uuid,
  p_display_name text,
  p_role text,
  p_capabilities text[],
  p_client_action_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_record record;
  target_record public.restaurant_memberships%rowtype;
  previous_state jsonb;
  next_state jsonb;
  replay_event public.restaurant_access_events%rowtype;
  role_changed boolean;
  capabilities_changed boolean;
begin
  select * into strict actor_record
  from private.require_restaurant_capability_v1(
    p_restaurant_slug, 'manage_memberships'
  );
  select event.* into replay_event from public.restaurant_access_events event
  where event.restaurant_id = actor_record.restaurant_id
    and event.client_action_id = p_client_action_id;
  if found then
    return jsonb_build_object('membershipId', replay_event.target_membership_id,
      'replayed', true, 'action', replay_event.action);
  end if;

  perform pg_advisory_xact_lock(hashtextextended(actor_record.restaurant_id::text, 0));
  select membership.* into target_record
  from public.restaurant_memberships membership
  where membership.id = p_membership_id
    and membership.restaurant_id = actor_record.restaurant_id
  for update;
  if not found then
    raise exception using message = 'MM_MANAGEMENT_NOT_FOUND|Team member not found.';
  end if;
  if target_record.status = 'revoked' then
    raise exception using message = 'MM_MANAGEMENT_CONFLICT|Reinstate this member before editing them.';
  end if;
  perform private.assert_team_assignment_v1(
    actor_record.membership_id, actor_record.member_role,
    target_record.role, p_role, p_capabilities
  );
  if target_record.role = 'owner' and p_role <> 'owner'
    and target_record.status = 'active'
    and (select count(*) from public.restaurant_memberships membership
         where membership.restaurant_id = actor_record.restaurant_id
           and membership.role = 'owner' and membership.status = 'active') <= 1
  then
    raise exception using message = 'MM_MANAGEMENT_CONFLICT|The final active owner cannot be demoted.';
  end if;
  if btrim(coalesce(p_display_name, '')) = '' or char_length(p_display_name) > 200 then
    raise exception using message = 'MM_MANAGEMENT_INVALID_REQUEST|Enter a valid display name.';
  end if;

  previous_state := private.membership_access_state_v1(target_record);
  role_changed := target_record.role <> p_role;
  capabilities_changed := private.membership_capabilities_v1(target_record.id, target_record.role)
    <> coalesce((select array_agg(distinct requested.value order by requested.value)
      from unnest(coalesce(p_capabilities, '{}'::text[])) requested(value)), '{}'::text[]);
  update public.restaurant_memberships
  set display_name = btrim(p_display_name), role = p_role
  where id = target_record.id returning * into target_record;
  perform private.replace_membership_capabilities_v1(
    actor_record.restaurant_id, target_record.id, p_role,
    p_capabilities, (select auth.uid())
  );
  select membership.* into target_record from public.restaurant_memberships membership
  where membership.id = target_record.id;
  next_state := private.membership_access_state_v1(target_record);

  insert into public.restaurant_access_events (
    restaurant_id, target_membership_id, actor_user_id,
    actor_membership_id, client_action_id, action,
    previous_state, next_state, metadata
  ) values (
    actor_record.restaurant_id, target_record.id, (select auth.uid()),
    actor_record.membership_id, p_client_action_id,
    case when role_changed then 'membership.role_changed'
         when capabilities_changed then 'membership.capabilities_changed'
         else 'membership.updated' end,
    previous_state, next_state,
    jsonb_build_object('roleChanged', role_changed,
      'capabilitiesChanged', capabilities_changed)
  );
  return jsonb_build_object('membershipId', target_record.id,
    'status', target_record.status, 'replayed', false,
    'action', case when role_changed then 'membership.role_changed'
      when capabilities_changed then 'membership.capabilities_changed'
      else 'membership.updated' end);
end;
$$;

create or replace function public.revoke_restaurant_member_v1(
  p_restaurant_slug text,
  p_membership_id uuid,
  p_reason text,
  p_client_action_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_record record;
  target_record public.restaurant_memberships%rowtype;
  previous_state jsonb;
  replay_event public.restaurant_access_events%rowtype;
begin
  select * into strict actor_record from private.require_restaurant_capability_v1(
    p_restaurant_slug, 'manage_memberships'
  );
  select event.* into replay_event from public.restaurant_access_events event
  where event.restaurant_id = actor_record.restaurant_id
    and event.client_action_id = p_client_action_id;
  if found then return jsonb_build_object('membershipId', replay_event.target_membership_id,
    'replayed', true, 'action', replay_event.action); end if;

  perform pg_advisory_xact_lock(hashtextextended(actor_record.restaurant_id::text, 0));
  select membership.* into target_record from public.restaurant_memberships membership
  where membership.id = p_membership_id
    and membership.restaurant_id = actor_record.restaurant_id for update;
  if not found then raise exception using message = 'MM_MANAGEMENT_NOT_FOUND|Team member not found.'; end if;
  if target_record.status = 'revoked' then
    return jsonb_build_object('membershipId', target_record.id,
      'status', 'revoked', 'replayed', true, 'action', 'membership.revoked');
  end if;
  if actor_record.member_role <> 'owner' and target_record.role = 'owner' then
    raise exception using message = 'MM_MANAGEMENT_FORBIDDEN|Only an owner can manage owners.';
  end if;
  if target_record.role = 'owner' and target_record.status = 'active'
    and (select count(*) from public.restaurant_memberships membership
         where membership.restaurant_id = actor_record.restaurant_id
           and membership.role = 'owner' and membership.status = 'active') <= 1
  then raise exception using message = 'MM_MANAGEMENT_CONFLICT|The final active owner cannot be revoked.'; end if;
  if char_length(coalesce(p_reason, '')) > 500 then
    raise exception using message = 'MM_MANAGEMENT_INVALID_REQUEST|The reason is too long.';
  end if;
  previous_state := private.membership_access_state_v1(target_record);
  update public.restaurant_memberships set status = 'revoked', revoked_at = now()
  where id = target_record.id returning * into target_record;
  insert into public.restaurant_access_events (
    restaurant_id, target_membership_id, actor_user_id, actor_membership_id,
    client_action_id, action, previous_state, next_state, reason
  ) values (
    actor_record.restaurant_id, target_record.id, (select auth.uid()),
    actor_record.membership_id, p_client_action_id, 'membership.revoked',
    previous_state, private.membership_access_state_v1(target_record),
    nullif(btrim(coalesce(p_reason, '')), '')
  );
  return jsonb_build_object('membershipId', target_record.id,
    'status', 'revoked', 'replayed', false, 'action', 'membership.revoked');
end;
$$;

create or replace function public.reinstate_restaurant_member_v1(
  p_restaurant_slug text,
  p_membership_id uuid,
  p_client_action_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_record record;
  target_record public.restaurant_memberships%rowtype;
  previous_state jsonb;
  next_status text;
begin
  select * into strict actor_record from private.require_restaurant_capability_v1(
    p_restaurant_slug, 'manage_memberships'
  );
  perform pg_advisory_xact_lock(hashtextextended(actor_record.restaurant_id::text, 0));
  select membership.* into target_record from public.restaurant_memberships membership
  where membership.id = p_membership_id
    and membership.restaurant_id = actor_record.restaurant_id for update;
  if not found then raise exception using message = 'MM_MANAGEMENT_NOT_FOUND|Team member not found.'; end if;
  perform private.assert_team_assignment_v1(
    actor_record.membership_id, actor_record.member_role,
    target_record.role, target_record.role,
    private.membership_capabilities_v1(target_record.id, target_record.role)
  );
  if target_record.status <> 'revoked' then
    return jsonb_build_object('membershipId', target_record.id,
      'status', target_record.status, 'replayed', true,
      'action', 'membership.reinstated');
  end if;
  if exists (select 1 from public.restaurant_access_events event
    where event.restaurant_id = actor_record.restaurant_id
      and event.client_action_id = p_client_action_id) then
    return jsonb_build_object('membershipId', target_record.id,
      'replayed', true, 'action', 'membership.reinstated');
  end if;
  previous_state := private.membership_access_state_v1(target_record);
  select case when users.email_confirmed_at is null then 'invited' else 'active' end
    into next_status from auth.users users where users.id = target_record.user_id;
  update public.restaurant_memberships set status = next_status, revoked_at = null
  where id = target_record.id returning * into target_record;
  insert into public.restaurant_access_events (
    restaurant_id, target_membership_id, actor_user_id, actor_membership_id,
    client_action_id, action, previous_state, next_state
  ) values (
    actor_record.restaurant_id, target_record.id, (select auth.uid()),
    actor_record.membership_id, p_client_action_id, 'membership.reinstated',
    previous_state, private.membership_access_state_v1(target_record)
  );
  return jsonb_build_object('membershipId', target_record.id,
    'status', target_record.status, 'replayed', false,
    'action', 'membership.reinstated');
end;
$$;

create or replace function public.reserve_restaurant_invitation_resend_v1(
  p_restaurant_slug text,
  p_membership_id uuid,
  p_client_action_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_record record;
  target_record public.restaurant_memberships%rowtype;
  inserted_count integer;
begin
  select * into strict actor_record from private.require_restaurant_capability_v1(
    p_restaurant_slug, 'manage_memberships'
  );
  select membership.* into target_record from public.restaurant_memberships membership
  where membership.id = p_membership_id
    and membership.restaurant_id = actor_record.restaurant_id;
  if not found then raise exception using message = 'MM_MANAGEMENT_NOT_FOUND|Team member not found.'; end if;
  if target_record.status <> 'invited' then
    raise exception using message = 'MM_MANAGEMENT_CONFLICT|Only pending invitations can be resent.';
  end if;
  perform private.assert_team_assignment_v1(actor_record.membership_id,
    actor_record.member_role, target_record.role, target_record.role,
    private.membership_capabilities_v1(target_record.id, target_record.role));
  insert into public.restaurant_access_events (
    restaurant_id, target_membership_id, actor_user_id, actor_membership_id,
    client_action_id, action, previous_state, next_state
  ) values (
    actor_record.restaurant_id, target_record.id, (select auth.uid()),
    actor_record.membership_id, p_client_action_id,
    'membership.invitation_resend_requested',
    private.membership_access_state_v1(target_record),
    private.membership_access_state_v1(target_record)
  ) on conflict (restaurant_id, client_action_id) do nothing;
  get diagnostics inserted_count = row_count;
  return jsonb_build_object('membershipId', target_record.id,
    'status', target_record.status, 'replayed', inserted_count = 0,
    'shouldSend', inserted_count = 1,
    'action', 'membership.invitation_resend_requested');
end;
$$;

create or replace function public.record_restaurant_invitation_resend_result_v1(
  p_restaurant_slug text,
  p_membership_id uuid,
  p_client_action_id uuid,
  p_succeeded boolean,
  p_error_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_record record;
  target_record public.restaurant_memberships%rowtype;
  event_action text;
begin
  select * into strict actor_record from private.require_restaurant_capability_v1(
    p_restaurant_slug, 'manage_memberships'
  );
  select membership.* into target_record from public.restaurant_memberships membership
  where membership.id = p_membership_id
    and membership.restaurant_id = actor_record.restaurant_id;
  if not found then raise exception using message = 'MM_MANAGEMENT_NOT_FOUND|Team member not found.'; end if;
  if not exists (
    select 1 from public.restaurant_access_events event
    where event.restaurant_id = actor_record.restaurant_id
      and event.target_membership_id = p_membership_id
      and event.client_action_id = p_client_action_id
      and event.action = 'membership.invitation_resend_requested'
  ) then raise exception using message = 'MM_MANAGEMENT_CONFLICT|The resend command was not reserved.'; end if;
  if exists (
    select 1 from public.restaurant_access_events event
    where event.restaurant_id = actor_record.restaurant_id
      and event.target_membership_id = p_membership_id
      and event.metadata ->> 'commandActionId' = p_client_action_id::text
      and event.action in ('membership.invitation_resent', 'membership.invitation_resend_failed')
  ) then return jsonb_build_object('membershipId', p_membership_id,
    'replayed', true, 'succeeded', p_succeeded); end if;
  event_action := case when p_succeeded then 'membership.invitation_resent'
    else 'membership.invitation_resend_failed' end;
  insert into public.restaurant_access_events (
    restaurant_id, target_membership_id, actor_user_id, actor_membership_id,
    action, previous_state, next_state, metadata
  ) values (
    actor_record.restaurant_id, target_record.id, (select auth.uid()),
    actor_record.membership_id, event_action,
    private.membership_access_state_v1(target_record),
    private.membership_access_state_v1(target_record),
    jsonb_build_object('commandActionId', p_client_action_id,
      'deliveryErrorCode', case when p_succeeded then null
        else left(coalesce(p_error_code, 'unknown'), 100) end)
  );
  return jsonb_build_object('membershipId', target_record.id,
    'replayed', false, 'succeeded', p_succeeded, 'action', event_action);
end;
$$;

create or replace function public.activate_my_restaurant_memberships_v1()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_record public.restaurant_memberships%rowtype;
  activated_count integer := 0;
begin
  if (select auth.uid()) is null then
    raise exception using message = 'MM_MANAGEMENT_UNAUTHENTICATED|Authentication is required.';
  end if;
  for target_record in
    select membership.* from public.restaurant_memberships membership
    where membership.user_id = (select auth.uid())
      and membership.status = 'invited' for update
  loop
    update public.restaurant_memberships set status = 'active'
    where id = target_record.id returning * into target_record;
    insert into public.restaurant_access_events (
      restaurant_id, target_membership_id, actor_user_id,
      actor_membership_id, action, previous_state, next_state,
      metadata
    ) values (
      target_record.restaurant_id, target_record.id, (select auth.uid()),
      target_record.id, 'membership.activated',
      jsonb_build_object('displayName', target_record.display_name,
        'role', target_record.role, 'status', 'invited',
        'capabilities', private.membership_capabilities_v1(target_record.id, target_record.role)),
      private.membership_access_state_v1(target_record),
      jsonb_build_object('source', 'auth_callback')
    );
    activated_count := activated_count + 1;
  end loop;
  return activated_count;
end;
$$;

create or replace function public.list_restaurant_team_v1(
  p_restaurant_slug text
)
returns table (
  membership_id uuid,
  user_id uuid,
  email text,
  display_name text,
  member_role text,
  member_status text,
  invited_at timestamptz,
  joined_at timestamptz,
  membership_created_at timestamptz,
  revoked_at timestamptz,
  capabilities text[],
  role_default_capabilities text[]
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare actor_record record;
begin
  select * into strict actor_record from private.require_restaurant_capability_v1(
    p_restaurant_slug, 'manage_memberships'
  );
  return query
  select membership.id, membership.user_id, lower(users.email),
    membership.display_name, membership.role, membership.status,
    users.invited_at, users.email_confirmed_at,
    membership.created_at, membership.revoked_at,
    private.membership_capabilities_v1(membership.id, membership.role),
    coalesce((select array_agg(defaults.capability order by defaults.capability)
      from public.restaurant_role_capability_defaults defaults
      where defaults.role = membership.role and defaults.allowed), '{}'::text[])
  from public.restaurant_memberships membership
  join auth.users users on users.id = membership.user_id
  where membership.restaurant_id = actor_record.restaurant_id
  order by case membership.status when 'active' then 0 when 'invited' then 1 else 2 end,
    lower(membership.display_name), membership.id;
end;
$$;

create or replace function public.list_restaurant_access_events_v1(
  p_restaurant_slug text,
  p_limit integer default 50
)
returns table (
  event_id bigint, target_membership_id uuid, target_display_name text,
  actor_display_name text, action text, previous_state jsonb,
  next_state jsonb, reason text, metadata jsonb, created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare actor_record record;
begin
  select * into strict actor_record from private.require_restaurant_capability_v1(
    p_restaurant_slug, 'manage_memberships'
  );
  return query
  select event.id, event.target_membership_id, target.display_name,
    actor.display_name, event.action, event.previous_state,
    event.next_state, event.reason, event.metadata, event.created_at
  from public.restaurant_access_events event
  join public.restaurant_memberships target on target.id = event.target_membership_id
  left join public.restaurant_memberships actor on actor.id = event.actor_membership_id
  where event.restaurant_id = actor_record.restaurant_id
  order by event.created_at desc, event.id desc
  limit greatest(1, least(coalesce(p_limit, 50), 100));
end;
$$;

revoke all on function private.membership_capabilities_v1(uuid, text) from public, anon, authenticated;
revoke all on function private.membership_access_state_v1(public.restaurant_memberships) from public, anon, authenticated;
revoke all on function private.assert_team_assignment_v1(uuid, text, text, text, text[]) from public, anon, authenticated;
revoke all on function private.replace_membership_capabilities_v1(uuid, uuid, text, text[], uuid) from public, anon, authenticated;

revoke all on function public.authorize_restaurant_member_invite_v1(text, text, text[]) from public, anon, authenticated;
revoke all on function public.provision_restaurant_member_v1(text, uuid, text, text, text[], uuid, boolean) from public, anon, authenticated;
revoke all on function public.update_restaurant_member_v1(text, uuid, text, text, text[], uuid) from public, anon, authenticated;
revoke all on function public.revoke_restaurant_member_v1(text, uuid, text, uuid) from public, anon, authenticated;
revoke all on function public.reinstate_restaurant_member_v1(text, uuid, uuid) from public, anon, authenticated;
revoke all on function public.reserve_restaurant_invitation_resend_v1(text, uuid, uuid) from public, anon, authenticated;
revoke all on function public.record_restaurant_invitation_resend_result_v1(text, uuid, uuid, boolean, text) from public, anon, authenticated;
revoke all on function public.activate_my_restaurant_memberships_v1() from public, anon, authenticated;
revoke all on function public.list_restaurant_team_v1(text) from public, anon, authenticated;
revoke all on function public.list_restaurant_access_events_v1(text, integer) from public, anon, authenticated;

grant execute on function public.authorize_restaurant_member_invite_v1(text, text, text[]) to authenticated;
grant execute on function public.provision_restaurant_member_v1(text, uuid, text, text, text[], uuid, boolean) to authenticated;
grant execute on function public.update_restaurant_member_v1(text, uuid, text, text, text[], uuid) to authenticated;
grant execute on function public.revoke_restaurant_member_v1(text, uuid, text, uuid) to authenticated;
grant execute on function public.reinstate_restaurant_member_v1(text, uuid, uuid) to authenticated;
grant execute on function public.reserve_restaurant_invitation_resend_v1(text, uuid, uuid) to authenticated;
grant execute on function public.record_restaurant_invitation_resend_result_v1(text, uuid, uuid, boolean, text) to authenticated;
grant execute on function public.activate_my_restaurant_memberships_v1() to authenticated;
grant execute on function public.list_restaurant_team_v1(text) to authenticated;
grant execute on function public.list_restaurant_access_events_v1(text, integer) to authenticated;

commit;
