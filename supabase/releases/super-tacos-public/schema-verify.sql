-- PREPARED ONLY: read-only check after separately approved schema migration.
\set ON_ERROR_STOP on
\getenv release_sslmode PGSSLMODE
\getenv release_rootcert PGSSLROOTCERT
\getenv release_appdata APPDATA
begin isolation level serializable read only;
set local statement_timeout='30s';
select set_config('menu_man.release_host', :'HOST', true);
select set_config('menu_man.release_user', :'USER', true);
select set_config('menu_man.release_port', :'PORT', true);
select set_config('menu_man.release_project', :'production_project_ref', true);
select set_config('menu_man.release_sslmode', :'release_sslmode', true);
select set_config('menu_man.release_rootcert', :'release_rootcert', true);
select set_config('menu_man.release_appdata', :'release_appdata', true);
do $verify$ begin
  if current_setting('menu_man.release_project') <> 'fullaiodvmilkdxyxnln'
    or current_setting('menu_man.release_host') <> 'aws-0-us-west-2.pooler.supabase.com'
    or current_setting('menu_man.release_user') <> 'postgres.fullaiodvmilkdxyxnln'
    or current_setting('menu_man.release_port') <> '5432'
    or current_database() <> 'postgres' or current_user <> 'postgres'
    or current_setting('menu_man.release_sslmode') <> 'verify-full'
    or btrim(current_setting('menu_man.release_rootcert')) = ''
    or replace(lower(current_setting('menu_man.release_rootcert')),chr(92),'/') <>
       replace(lower(current_setting('menu_man.release_appdata')),chr(92),'/') || '/postgresql/root.crt'
  then raise exception 'Exact Production pooler identity and verified client TLS required'; end if;
  if not exists(select 1 from pg_attribute a join pg_class c on c.oid=a.attrelid
      join pg_namespace n on n.oid=c.relnamespace
      join pg_attrdef d on d.adrelid=c.oid and d.adnum=a.attnum
      where n.nspname='public' and c.relname='restaurants' and a.attname='is_indexable'
        and a.atttypid='boolean'::regtype and a.attnotnull and pg_get_expr(d.adbin,d.adrelid)='true')
  then raise exception 'Indexability column type/default/nullability mismatch'; end if;
  if (select array_agg(c.relname::text order by c.relname) from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relkind in ('r','p')) is distinct from array[
        'menu_item_modifier_groups','menu_item_modifier_option_overrides','menu_items',
        'menu_section_items','menu_sections','menus','modifier_groups','modifier_options',
        'order_item_modifiers','order_items','orders','restaurant_business_hours',
        'restaurant_order_counters','restaurant_ordering_settings','restaurants']
  then raise exception 'Production 15-table schema changed; stop for review'; end if;
  if (select count(*) from public.restaurants) <> 1
    or (select count(*) from public.restaurants where slug='armandos' and is_indexable is true) <> 1
    or exists(select 1 from public.restaurants where lower(slug)='super-tacos')
  then raise exception 'Armando baseline changed or demo tenant exists'; end if;
end $verify$;
select 'Production indexability migration verified; Armando remains indexable and Super Tacos absent';
rollback;
