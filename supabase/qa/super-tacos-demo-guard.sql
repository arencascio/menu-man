-- MANUAL STAGING ACTIVATION ONLY, AFTER SEPARATE APPROVAL.
-- Never include in automatic seeds/migrations. psql only; do not use SQL Editor.
\set ON_ERROR_STOP on
begin;
set local lock_timeout='2s';
set local statement_timeout='30s';
select set_config('menu_man.demo_environment', :'menu_man_environment', true);
select set_config('menu_man.demo_project', :'menu_man_staging_project_ref', true);
select set_config('menu_man.demo_host', :'HOST', true);
select set_config('menu_man.demo_user', :'USER', true);
select set_config('menu_man.demo_approval', :'approve_super_tacos_demo', true);
select set_config('menu_man.demo_merchant', :'square_merchant_id', true);
select set_config('menu_man.demo_location', :'square_location_id', true);
do $$
declare tenant constant uuid := '20000000-0000-4000-8000-000000000001';
begin
  if current_setting('menu_man.demo_environment') <> 'staging'
    or current_setting('menu_man.demo_project') <> 'jjvongzvtnzlvwdfcnjk'
    or current_setting('menu_man.demo_approval') <> 'activate-super-tacos-demo'
    or not (current_setting('menu_man.demo_host')='db.jjvongzvtnzlvwdfcnjk.supabase.co'
      or (current_setting('menu_man.demo_host') ~ '^[a-z0-9-]+[.]pooler[.]supabase[.]com$'
        and current_setting('menu_man.demo_user')='postgres.jjvongzvtnzlvwdfcnjk'))
    or btrim(current_setting('menu_man.demo_merchant'))=''
    or btrim(current_setting('menu_man.demo_location'))=''
  then raise exception 'Verified Staging connection and explicit demo activation approval are required.'; end if;
  if not exists(select 1 from public.restaurants where id=tenant and slug='super-tacos' and not is_indexable)
    or (select count(*) from public.menus where restaurant_id=tenant)<>1
    or not exists(select 1 from public.menus where id='20000000-0000-4000-8000-000000000002' and restaurant_id=tenant)
    or (select count(*) from public.menu_items where restaurant_id=tenant)<>12
    or (select count(*) from public.menu_sections where menu_id='20000000-0000-4000-8000-000000000002')<>4
    or exists(select 1 from public.menu_sections where menu_id='20000000-0000-4000-8000-000000000002' and id::text !~ '^20000000-0000-4000-8000-00000000010[1-4]$')
    or (select count(*) from public.menu_section_items p join public.menu_sections s on s.id=p.section_id where s.menu_id='20000000-0000-4000-8000-000000000002')<>12
    or exists(select 1 from public.menu_items where restaurant_id=tenant and id::text !~ '^20000000-0000-4000-8000-0000000002(0[1-9]|1[0-2])$')
    or exists(select 1 from public.orders where restaurant_id=tenant)
    or exists(select 1 from public.restaurant_payment_connections where restaurant_id=tenant)
    or exists(select 1 from public.modifier_groups where restaurant_id=tenant)
    or exists(select 1 from public.restaurant_business_hours where restaurant_id=tenant)
    or exists(select 1 from public.restaurant_catering_settings where restaurant_id=tenant and (coalesce((settings->>'enabled')::boolean,false) or coalesce((settings->>'notifyOwner')::boolean,false)))
    or not exists(select 1 from public.restaurant_ordering_settings where restaurant_id=tenant and not pickup_enabled)
  then raise exception 'Expected untouched browse-only Super Tacos fixture not found. Stop and review; nothing changed.'; end if;
  -- Never adopt colliding reserved IDs from another tenant/menu.
  if exists(select 1 from public.menu_items where id::text ~ '^20000000-0000-4000-8000-0000000002[0-9]{2}$' and restaurant_id<>tenant)
    or exists(select 1 from public.menu_sections where id::text ~ '^20000000-0000-4000-8000-00000000010[1-6]$' and menu_id<>'20000000-0000-4000-8000-000000000002')
    or exists(select 1 from public.modifier_groups where id::text ~ '^20000000-0000-4000-8000-00000000050[1-4]$')
    or exists(select 1 from public.modifier_options where id::text ~ '^20000000-0000-4000-8000-0000000006[0-9]{2}$')
    or exists(select 1 from public.menu_section_items where id::text ~ '^20000000-0000-4000-8000-0000000003[0-9]{2}$' and item_id::text !~ '^20000000-0000-4000-8000-0000000002[0-9]{2}$')
  then raise exception 'Reserved fixture identity collision; no data was adopted.'; end if;
  if exists(select 1 from public.payment_provider_references where provider_key='square' and environment='sandbox'
    and ((reference_kind='merchant' and external_id=current_setting('menu_man.demo_merchant'))
      or (reference_kind='location' and external_id=current_setting('menu_man.demo_location'))))
  then raise exception 'Use a dedicated Sandbox seller/location. Existing payment references must not be reassigned.'; end if;
end;
$$;
