-- PREPARED ONLY: separate Production schema approval and verified backup required.
-- Apply directly to fullaiodvmilkdxyxnln only. Never replay Staging migrations.
\set ON_ERROR_STOP on
\getenv release_sslmode PGSSLMODE
\getenv release_rootcert PGSSLROOTCERT
\getenv release_appdata APPDATA
begin isolation level serializable read write;
set local lock_timeout='2s';
set local statement_timeout='30s';
select set_config('menu_man.release_host', :'HOST', true);
select set_config('menu_man.release_user', :'USER', true);
select set_config('menu_man.release_port', :'PORT', true);
select set_config('menu_man.release_project', :'production_project_ref', true);
select set_config('menu_man.release_sslmode', :'release_sslmode', true);
select set_config('menu_man.release_rootcert', :'release_rootcert', true);
select set_config('menu_man.release_appdata', :'release_appdata', true);
select set_config('menu_man.schema_approval', :'approve_public_schema', true);
select set_config('menu_man.backup_sha', :'production_backup_sha256', true);
do $guard$ begin
  if current_setting('menu_man.release_project') <> 'fullaiodvmilkdxyxnln'
    or current_setting('menu_man.release_host') <> 'db.fullaiodvmilkdxyxnln.supabase.co'
    or current_setting('menu_man.release_user') <> 'postgres'
    or current_setting('menu_man.release_port') <> '5432'
    or current_database() <> 'postgres' or current_user <> 'postgres'
    or current_setting('menu_man.release_sslmode') <> 'verify-full'
    or btrim(current_setting('menu_man.release_rootcert')) = ''
    or replace(lower(current_setting('menu_man.release_rootcert')),chr(92),'/') <>
       replace(lower(current_setting('menu_man.release_appdata')),chr(92),'/') || '/postgresql/root.crt'
    or not coalesce((select ssl from pg_stat_ssl where pid=pg_backend_pid()),false)
  then raise exception 'Exact Production identity and verified TLS required'; end if;
  if current_setting('menu_man.schema_approval') <> 'add-production-restaurant-indexability'
    or current_setting('menu_man.backup_sha') !~ '^[a-f0-9]{64}$'
  then raise exception 'Separate schema approval and verified backup SHA required'; end if;
  if to_regclass('public.restaurants') is null or to_regclass('public.menu_section_items') is null
  then raise exception 'Expected Production catalog absent'; end if;
  if (select array_agg(c.relname::text order by c.relname) from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relkind in ('r','p')) is distinct from array[
        'menu_item_modifier_groups','menu_item_modifier_option_overrides','menu_items',
        'menu_section_items','menu_sections','menus','modifier_groups','modifier_options',
        'order_item_modifiers','order_items','orders','restaurant_business_hours',
        'restaurant_order_counters','restaurant_ordering_settings','restaurants']
  then raise exception 'Production 15-table schema changed; stop for review'; end if;
  if exists(select 1 from information_schema.columns where table_schema='public'
      and table_name='restaurants' and column_name='is_indexable')
  then raise exception 'is_indexable already exists; inspect read-only before any retry'; end if;
  if not exists(select 1 from pg_constraint con where con.conrelid='public.menu_section_items'::regclass
      and con.contype='p' and pg_get_constraintdef(con.oid)='PRIMARY KEY (section_id, item_id)')
  then raise exception 'Production composite menu placement key missing'; end if;
  if (select count(*) from public.restaurants) <> 1
    or not exists(select 1 from public.restaurants where slug='armandos')
    or exists(select 1 from public.restaurants where lower(slug)='super-tacos')
  then raise exception 'Unexpected restaurant baseline; stop'; end if;
end $guard$;

alter table public.restaurants add column is_indexable boolean not null default true;

do $verify$ begin
  if (select count(*) from public.restaurants where slug='armandos' and is_indexable is true) <> 1
    or exists(select 1 from public.restaurants where is_indexable is not true)
  then raise exception 'Existing restaurant indexability changed; rollback'; end if;
end $verify$;
commit;
