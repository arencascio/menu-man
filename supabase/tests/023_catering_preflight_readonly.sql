-- PHASE A ONLY. Open the SQL editor for project jjvongzvtnzlvwdfcnjk
-- (Menu Man Staging) and verify the project identity in the dashboard first.
-- This file performs no migrations, fixture creation, RPC calls, or data writes.
-- Every required object/column must be present; catering collisions must be absent.
begin transaction read only;
set local statement_timeout = '15s';
set local lock_timeout = '2s';

select current_database() as database_name, current_user as inspection_role,
       current_setting('transaction_read_only') as transaction_read_only,
       current_setting('server_version_num') as server_version_num;

select role_name, exists(select 1 from pg_roles r where r.rolname = required.role_name) as present
from (values ('anon'), ('authenticated'), ('service_role')) required(role_name);

select version from supabase_migrations.schema_migrations order by version;

select object_name, to_regclass(object_name) is not null as present
from (values
  ('public.restaurants'), ('public.restaurant_capabilities'),
  ('public.restaurant_role_capability_defaults'), ('public.restaurant_memberships'),
  ('public.restaurant_membership_permission_overrides'),
  ('public.restaurant_notification_settings')
) required(object_name);

select table_name, column_name,
       exists (select 1 from information_schema.columns c
               where c.table_schema = 'public' and c.table_name = required.table_name
                 and c.column_name = required.column_name) as present
from (values
  ('restaurants', 'id'), ('restaurants', 'slug'), ('restaurants', 'is_active'), ('restaurants', 'timezone'),
  ('restaurant_capabilities', 'capability'), ('restaurant_capabilities', 'description'),
  ('restaurant_role_capability_defaults', 'role'), ('restaurant_role_capability_defaults', 'capability'), ('restaurant_role_capability_defaults', 'allowed'),
  ('restaurant_notification_settings', 'restaurant_id'), ('restaurant_notification_settings', 'internal_email_recipient')
) required(table_name, column_name);

select signature, to_regprocedure(signature) is not null as present
from (values
  ('private.require_restaurant_capability_v1(text,text)'),
  ('private.member_has_capability_v1(uuid,text,text)'),
  ('private.assert_team_assignment_v1(uuid,text,text,text,text[])'),
  ('extensions.gen_random_uuid()'), ('extensions.digest(text,text)'),
  ('pg_catalog.date_bin(interval,timestamp with time zone,timestamp with time zone)'),
  ('auth.uid()')
) required(signature);

select n.nspname as schema_name, p.proname as function_name,
       pg_get_function_identity_arguments(p.oid) as arguments,
       pg_get_userbyid(p.proowner) as owner, p.prosecdef as security_definer,
       array(select entry from unnest(coalesce(p.proconfig, '{}'::text[])) entry
             where split_part(entry, '=', 1) in ('search_path', 'lock_timeout', 'statement_timeout')) as safety_settings,
       md5(pg_get_functiondef(p.oid)) as definition_hash
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'private' and p.proname in
  ('require_restaurant_capability_v1', 'member_has_capability_v1', 'assert_team_assignment_v1');

-- Expect zero rows in both collision queries before this migration is applied.
select n.nspname as schema_name, c.relname as existing_catering_relation, c.relkind
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname in
  ('restaurant_catering_settings', 'catering_inquiries', 'catering_submission_windows');

select p.proname as existing_catering_function, pg_get_function_identity_arguments(p.oid) as arguments
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname in
  ('get_managed_catering_settings_v1', 'update_managed_catering_settings_v1',
   'submit_catering_inquiry_v1', 'complete_catering_notification_v1',
   'list_managed_catering_inquiries_v1', 'update_managed_catering_inquiry_v1');

select capability from public.restaurant_capabilities where capability = 'manage_catering';
select role, allowed from public.restaurant_role_capability_defaults where capability = 'manage_catering';

-- Identity/flags only: no customer records, order contents, settings, or contacts.
select slug, is_active, is_indexable from public.restaurants
where slug in ('armandos', 'super-tacos') order by slug;

rollback;
