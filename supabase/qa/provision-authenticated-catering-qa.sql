-- Execute only through scripts/provision-staging-auth-qa.ps1 after creating the
-- four dedicated synthetic, email-confirmed Auth users and replacing the four
-- placeholder email literals below. The runner checks both linked project metadata
-- and requires explicit confirmation of Staging ref jjvongzvtnzlvwdfcnjk.
-- Do not paste this fixture script into an arbitrary SQL Editor session.
-- This provisions exactly two isolated tenants, four memberships, two catering
-- settings rows with notifications disabled, and only the catering manager grants.
-- It creates no menus, orders, inquiries, notification recipients, or real emails.

begin;
set local lock_timeout = '2s';
set local statement_timeout = '15s';

do $qa$
declare
  primary_restaurant constant uuid := 'e1000000-0000-4000-8000-000000000001';
  second_restaurant constant uuid := 'e1000000-0000-4000-8000-000000000002';
  primary_owner_membership constant uuid := 'e2000000-0000-4000-8000-000000000001';
  catering_manager_membership constant uuid := 'e2000000-0000-4000-8000-000000000002';
  restricted_manager_membership constant uuid := 'e2000000-0000-4000-8000-000000000003';
  second_owner_membership constant uuid := 'e2000000-0000-4000-8000-000000000004';
  primary_owner_user uuid;
  catering_manager_user uuid;
  restricted_manager_user uuid;
  second_owner_user uuid;
  member_row record;
  permission_row record;
begin
  if to_regclass('public.restaurant_capabilities') is null
    or to_regclass('public.restaurant_role_capability_defaults') is null
    or to_regclass('public.restaurant_memberships') is null
    or to_regclass('public.restaurant_membership_permission_overrides') is null
    or to_regclass('public.restaurant_catering_settings') is null
  then raise exception 'Required staging Catering schema is not installed; no fixtures were provisioned.'; end if;

  if exists (
    select 1 from public.restaurants
    where (slug = 'menu-man-qa-catering-primary' and id <> primary_restaurant)
       or (slug = 'menu-man-qa-catering-secondary' and id <> second_restaurant)
       or (id = primary_restaurant and slug <> 'menu-man-qa-catering-primary')
       or (id = second_restaurant and slug <> 'menu-man-qa-catering-secondary')
  ) then raise exception 'A dedicated Catering QA fixture slug or ID is already assigned; stopped without overwriting it.'; end if;

  if exists (
    select 1 from public.restaurant_memberships
    where restaurant_id in (primary_restaurant, second_restaurant)
      and id not in (primary_owner_membership, catering_manager_membership, restricted_manager_membership, second_owner_membership)
  ) then raise exception 'Unexpected membership exists on a dedicated Catering QA tenant; stopped without changing it.'; end if;

  select id into primary_owner_user from auth.users where lower(email) = lower('owner@menumanqa.com') and deleted_at is null and email_confirmed_at is not null;
  select id into catering_manager_user from auth.users where lower(email) = lower('manager@menumanqa.com') and deleted_at is null and email_confirmed_at is not null;
  select id into restricted_manager_user from auth.users where lower(email) = lower('shiftlead@menumanqa.com') and deleted_at is null and email_confirmed_at is not null;
  select id into second_owner_user from auth.users where lower(email) = lower('test@menumanqa.com') and deleted_at is null and email_confirmed_at is not null;
  if primary_owner_user is null or catering_manager_user is null or restricted_manager_user is null or second_owner_user is null
    or (select count(distinct user_id) from unnest(array[primary_owner_user, catering_manager_user, restricted_manager_user, second_owner_user]) as users(user_id)) <> 4
  then raise exception 'Create four distinct, confirmed synthetic QA Auth users before provisioning these fixtures.'; end if;

  insert into public.restaurants (id, slug, name, currency, is_active, timezone, theme_preset, theme_overrides, is_indexable)
  values
    (primary_restaurant, 'menu-man-qa-catering-primary', 'Menu Man QA Catering Primary', 'USD', true, 'UTC', 'classic-red', '{}'::jsonb, false),
    (second_restaurant, 'menu-man-qa-catering-secondary', 'Menu Man QA Catering Secondary', 'USD', true, 'UTC', 'classic-red', '{}'::jsonb, false)
  on conflict do nothing;

  if (select count(*) from public.restaurants where
      (id = primary_restaurant and slug = 'menu-man-qa-catering-primary' and name = 'Menu Man QA Catering Primary' and is_active and not is_indexable)
      or (id = second_restaurant and slug = 'menu-man-qa-catering-secondary' and name = 'Menu Man QA Catering Secondary' and is_active and not is_indexable)) <> 2
  then raise exception 'Existing QA restaurant fixture differs from the reviewed values; stopped without overwriting it.'; end if;

  for member_row in
    select * from (values
      (primary_owner_membership, primary_restaurant, primary_owner_user, 'owner'::text, 'QA Primary Owner'::text, primary_owner_user),
      (catering_manager_membership, primary_restaurant, catering_manager_user, 'manager'::text, 'QA Catering Manager'::text, primary_owner_user),
      (restricted_manager_membership, primary_restaurant, restricted_manager_user, 'manager'::text, 'QA Restricted Manager'::text, primary_owner_user),
      (second_owner_membership, second_restaurant, second_owner_user, 'owner'::text, 'QA Second Tenant Owner'::text, second_owner_user)
    ) as fixture(id, restaurant_id, user_id, role, display_name, created_by_user_id)
  loop
    insert into public.restaurant_memberships (id, restaurant_id, user_id, role, status, display_name, created_by_user_id)
    values (member_row.id, member_row.restaurant_id, member_row.user_id, member_row.role, 'active', member_row.display_name, member_row.created_by_user_id)
    on conflict do nothing;
  end loop;

  if (select count(*) from public.restaurant_memberships where
      (id = primary_owner_membership and restaurant_id = primary_restaurant and user_id = primary_owner_user and role = 'owner' and status = 'active')
      or (id = catering_manager_membership and restaurant_id = primary_restaurant and user_id = catering_manager_user and role = 'manager' and status = 'active')
      or (id = restricted_manager_membership and restaurant_id = primary_restaurant and user_id = restricted_manager_user and role = 'manager' and status = 'active')
      or (id = second_owner_membership and restaurant_id = second_restaurant and user_id = second_owner_user and role = 'owner' and status = 'active')) <> 4
  then raise exception 'Existing QA memberships differ from the reviewed role map; stopped without overwriting them.'; end if;

  for permission_row in
    select * from (values
      (primary_restaurant, catering_manager_membership, true, primary_owner_user),
      (primary_restaurant, restricted_manager_membership, false, primary_owner_user),
      (second_restaurant, second_owner_membership, true, second_owner_user)
    ) as fixture(restaurant_id, membership_id, allowed, created_by_user_id)
  loop
    insert into public.restaurant_membership_permission_overrides (restaurant_id, membership_id, capability, allowed, created_by_user_id)
    values (permission_row.restaurant_id, permission_row.membership_id, 'manage_catering', permission_row.allowed, permission_row.created_by_user_id)
    on conflict do nothing;
  end loop;

  if (select count(*) from public.restaurant_membership_permission_overrides where
      (restaurant_id = primary_restaurant and membership_id = catering_manager_membership and capability = 'manage_catering' and allowed)
      or (restaurant_id = primary_restaurant and membership_id = restricted_manager_membership and capability = 'manage_catering' and not allowed)
      or (restaurant_id = second_restaurant and membership_id = second_owner_membership and capability = 'manage_catering' and allowed)) <> 3
  then raise exception 'Existing QA catering permission overrides differ from the reviewed role map; stopped without overwriting them.'; end if;

  insert into public.restaurant_catering_settings (restaurant_id, settings)
  values
    (primary_restaurant, '{"enabled":true,"notifyOwner":false,"heading":"Plan a QA event","description":"Synthetic staging-only catering content.","imageUrl":"","imageAlt":"","ctaLabel":"Request catering"}'::jsonb),
    (second_restaurant, '{"enabled":true,"notifyOwner":false,"heading":"Plan a second QA event","description":"Synthetic staging-only catering content.","imageUrl":"","imageAlt":"","ctaLabel":"Request catering"}'::jsonb)
  on conflict do nothing;

  if (select count(*) from public.restaurant_catering_settings where
      (restaurant_id = primary_restaurant and settings = '{"enabled":true,"notifyOwner":false,"heading":"Plan a QA event","description":"Synthetic staging-only catering content.","imageUrl":"","imageAlt":"","ctaLabel":"Request catering"}'::jsonb)
      or (restaurant_id = second_restaurant and settings = '{"enabled":true,"notifyOwner":false,"heading":"Plan a second QA event","description":"Synthetic staging-only catering content.","imageUrl":"","imageAlt":"","ctaLabel":"Request catering"}'::jsonb)) <> 2
  then raise exception 'Existing QA Catering settings differ from the reviewed notification-off fixtures; stopped without overwriting them.'; end if;
end;
$qa$;

commit;
