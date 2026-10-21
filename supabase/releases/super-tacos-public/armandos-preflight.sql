\set ON_ERROR_STOP on
-- Production Session Pooler only. Run through the trusted wrapper, which verifies
-- client TLS and validates this same psql execution connection.
\getenv release_sslmode PGSSLMODE
\getenv release_rootcert PGSSLROOTCERT
\getenv release_appdata APPDATA
begin isolation level serializable read only;
set local lock_timeout='2s';
set local statement_timeout='30s';
select set_config('menu_man.release_host', :'HOST', true);
select set_config('menu_man.release_user', :'USER', true);
select set_config('menu_man.release_port', :'PORT', true);
select set_config('menu_man.release_project', :'production_project_ref', true);
select set_config('menu_man.release_sslmode', :'release_sslmode', true);
select set_config('menu_man.release_rootcert', :'release_rootcert', true);
select set_config('menu_man.release_appdata', :'release_appdata', true);
do $$ begin
  if current_setting('menu_man.release_project') <> 'fullaiodvmilkdxyxnln'
    or current_setting('menu_man.release_host') <> 'aws-0-us-west-2.pooler.supabase.com'
    or current_setting('menu_man.release_user') <> 'postgres.fullaiodvmilkdxyxnln'
    or current_setting('menu_man.release_port') <> '5432'
    or current_database() <> 'postgres' or current_user <> 'postgres'
    or current_setting('menu_man.release_sslmode') <> 'verify-full'
    or btrim(current_setting('menu_man.release_rootcert')) = ''
    or replace(lower(current_setting('menu_man.release_rootcert')),chr(92),'/') <> replace(lower(current_setting('menu_man.release_appdata')),chr(92),'/') || '/postgresql/root.crt'
  then raise exception 'Exact Production pooler identity and verified client TLS required'; end if;
end $$;

select jsonb_build_object('slug',r.slug,'id',r.id,'active',r.is_active,'indexable',r.is_indexable,
  'publishedMenus',(select count(*) from public.menus where restaurant_id=r.id and is_published),
  'activeSections',(select count(*) from public.menu_sections s join public.menus m on m.id=s.menu_id where m.restaurant_id=r.id and m.is_published and s.is_active),
  'items',(select count(*) from public.menu_items where restaurant_id=r.id),
  'orderableItems',(select count(*) from public.menu_items where restaurant_id=r.id and is_orderable),
  'pickupEnabled',(select pickup_enabled from public.restaurant_ordering_settings where restaurant_id=r.id))
from public.restaurants r where r.slug='armandos';
rollback;
