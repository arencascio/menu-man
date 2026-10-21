-- Read-only tenant-content export, for the separately approved 016 sync.
\set ON_ERROR_STOP on
\encoding UTF8
begin read only;
select set_config('menu_man.content_environment', :'menu_man_environment', true) as ignored \gset
select set_config('menu_man.content_project', :'menu_man_staging_project_ref', true) as ignored \gset
select set_config('menu_man.content_host', :'HOST', true) as ignored \gset
select set_config('menu_man.content_user', :'USER', true) as ignored \gset
do $backup$
begin
  if current_setting('menu_man.content_environment')<>'staging'
    or current_setting('menu_man.content_project')<>'jjvongzvtnzlvwdfcnjk'
    or not (current_setting('menu_man.content_host')='db.jjvongzvtnzlvwdfcnjk.supabase.co'
      or (current_setting('menu_man.content_host') ~ '^[a-z0-9-]+[.]pooler[.]supabase[.]com$'
        and current_setting('menu_man.content_user')='postgres.jjvongzvtnzlvwdfcnjk'))
    or current_database()<>'postgres'
    or not exists(select 1 from pg_stat_ssl where pid=pg_backend_pid() and ssl)
  then raise exception 'Exact Staging target and TLS required; no content changed.'; end if;
end;
$backup$;
select jsonb_build_object('format','super-tacos-content-backup-v1','project_ref','jjvongzvtnzlvwdfcnjk',
  'tenant_id','20000000-0000-4000-8000-000000000001','menu_id','20000000-0000-4000-8000-000000000002','exported_at',now(),
  'restaurant',(select to_jsonb(r) from public.restaurants r where id='20000000-0000-4000-8000-000000000001'),
  'items',(select jsonb_agg(i order by id) from public.menu_items i where restaurant_id='20000000-0000-4000-8000-000000000001'),
  'sections',(select jsonb_agg(s order by id) from public.menu_sections s where menu_id='20000000-0000-4000-8000-000000000002'),
  'placements',(select jsonb_agg(p order by p.id) from public.menu_section_items p join public.menu_sections s on s.id=p.section_id where s.menu_id='20000000-0000-4000-8000-000000000002'),
  'groups',(select jsonb_agg(g order by id) from public.modifier_groups g where restaurant_id='20000000-0000-4000-8000-000000000001'),
  'options',(select jsonb_agg(o order by id) from public.modifier_options o where restaurant_id='20000000-0000-4000-8000-000000000001'),
  'attachments',(select jsonb_agg(a order by menu_item_id,modifier_group_id) from public.menu_item_modifier_groups a where restaurant_id='20000000-0000-4000-8000-000000000001'),
  'overrides',coalesce((select jsonb_agg(o order by menu_item_id,modifier_group_id,modifier_option_id) from public.menu_item_modifier_option_overrides o where restaurant_id='20000000-0000-4000-8000-000000000001'),'[]'::jsonb));
commit;
