// PREPARATION ONLY. Generates reviewable content DML; never connects to PostgreSQL.
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";

const before = JSON.parse(readFileSync("supabase/qa/super-tacos-installed-catalog-v1.json", "utf8"));
const after = JSON.parse(readFileSync("supabase/seeds/staging/super-tacos-demo.json", "utf8"));
if (after.contentVersion !== "sprint-c3" || before.items.length !== 30 || after.items.length !== 25
  || after.restaurant.id !== before.restaurantId || after.menuId !== before.menuId) throw new Error("Unexpected catalog contract.");
const q = (value) => `'${String(value).replaceAll("'", "''")}'`;
const digest = createHash("sha256").update(JSON.stringify(after)).digest("hex");
const totalItems = before.items.length + after.items.filter((item) => !before.items.some((old) => old.number === item.number)).length;
const tables = ["menu_items", "modifier_groups", "modifier_options", "menu_item_modifier_groups", "menu_item_modifier_option_overrides"];
const otherRows = tables.map((table) => `select jsonb_build_array('${table}',to_jsonb(t))::text row_record from public.${table} t where restaurant_id<>tenant`)
  .concat([
    "select jsonb_build_array('restaurants',to_jsonb(t))::text row_record from public.restaurants t where id<>tenant",
    "select jsonb_build_array('menu_sections',to_jsonb(t))::text row_record from public.menu_sections t join public.menus m on m.id=t.menu_id where m.restaurant_id<>tenant",
    "select jsonb_build_array('menu_section_items',to_jsonb(t))::text row_record from public.menu_section_items t join public.menu_sections s on s.id=t.section_id join public.menus m on m.id=s.menu_id where m.restaurant_id<>tenant",
  ]).join("\nunion all\n");
const checksum = `select md5(coalesce(string_agg(row_record,E'\\n' order by row_record),'')) from (${otherRows}) all_rows`;
const guard = `\n  if current_setting('menu_man.content_environment')<>'staging'
    or current_setting('menu_man.content_project')<>'jjvongzvtnzlvwdfcnjk'
    or not (current_setting('menu_man.content_host')='db.jjvongzvtnzlvwdfcnjk.supabase.co'
      or (current_setting('menu_man.content_host') ~ '^[a-z0-9-]+[.]pooler[.]supabase[.]com$'
        and current_setting('menu_man.content_user')='postgres.jjvongzvtnzlvwdfcnjk'))
    or current_database()<>'postgres'
    or not exists(select 1 from pg_stat_ssl where pid=pg_backend_pid() and ssl)
  then raise exception 'Exact Staging target and TLS required; no content changed.'; end if;`;
const settings = `select set_config('menu_man.content_environment', :'menu_man_environment', true) as ignored \\gset
select set_config('menu_man.content_project', :'menu_man_staging_project_ref', true) as ignored \\gset
select set_config('menu_man.content_host', :'HOST', true) as ignored \\gset
select set_config('menu_man.content_user', :'USER', true) as ignored \\gset
`;
const script = `-- PREPARED ONLY. Separate approval and verified fresh content backup required.
-- Content sync for installed 015 fixture; NEVER rerun 014/015. No schema or payment DML.
-- Catalog SHA256: ${digest}
\\set ON_ERROR_STOP on
\\encoding UTF8
begin;
set local lock_timeout='2s';
set local statement_timeout='30s';
${settings}select set_config('menu_man.content_approval', :'approve_super_tacos_content', true) as ignored \\gset
select set_config('menu_man.content_backup', :'backup_sha256', true) as ignored \\gset
do $sync$
#variable_conflict use_variable
declare
  tenant constant uuid := '20000000-0000-4000-8000-000000000001';
  menu constant uuid := '20000000-0000-4000-8000-000000000002';
  original constant jsonb := ${q(JSON.stringify(before))}::jsonb;
  revised constant jsonb := ${q(JSON.stringify(after))}::jsonb;
  item jsonb; grp jsonb; opt jsonb; section jsonb; retired jsonb;
  item_id uuid; group_id uuid; option_id uuid; section_id uuid; group_number integer; ordinal integer;
  other_before text; other_after text;
begin${guard}
  if current_setting('menu_man.content_approval')<>'sync-super-tacos-sprint-c3'
    or current_setting('menu_man.content_backup') !~ '^[a-f0-9]{64}$'
  then raise exception 'Explicit content-sync approval and verified backup SHA256 required.'; end if;
  perform pg_advisory_xact_lock(hashtextextended('public-demo:'||tenant::text,0));
  perform 1 from public.restaurants where id=tenant for update;
  perform 1 from public.menu_items where restaurant_id=tenant for update;
  perform 1 from public.modifier_groups where restaurant_id=tenant for update;
  perform 1 from public.modifier_options where restaurant_id=tenant for update;
  perform 1 from public.menu_item_modifier_groups where restaurant_id=tenant for update;
  if not exists(select 1 from public.restaurants where id=tenant and slug='super-tacos' and not is_indexable
      and logo_url='/img/super-tacos/logo.svg' and phone is null and address_line1 is null
      and city is null and state is null and postal_code is null and google_maps_url is null)
    or (select count(*) from public.menus where restaurant_id=tenant)<>1
    or not exists(select 1 from public.menus where id=menu and restaurant_id=tenant and is_published)
    or (select count(*) from public.menu_items where restaurant_id=tenant)<>30
    or (select count(*) from public.menu_sections where menu_id=menu)<>6
    or (select count(*) from public.menu_section_items p join public.menu_sections s on s.id=p.section_id where s.menu_id=menu)<>30
    or (select count(*) from public.modifier_groups where restaurant_id=tenant)<>4
    or (select count(*) from public.modifier_options where restaurant_id=tenant)<>10
    or (select count(*) from public.restaurant_business_hours where restaurant_id=tenant and not is_closed
      and open_time='09:00'::time and close_time='22:00'::time)<>7
    or exists(select 1 from public.menu_item_modifier_option_overrides where restaurant_id=tenant)
    or exists(select 1 from public.orders where restaurant_id=tenant and order_status not in ('completed','cancelled'))
    or exists(select 1 from public.restaurant_catering_settings where restaurant_id=tenant and (coalesce((settings->>'enabled')::boolean,false) or coalesce((settings->>'notifyOwner')::boolean,false)))
  then raise exception 'Expected installed 30-item demo with no active orders not found. Stop for review.'; end if;
  -- Verify every existing identity and authoritative price before applying any DML.
  for section in select value from jsonb_array_elements(original->'sections') loop
    section_id:=('20000000-0000-4000-8000-'||lpad(section->>'number',12,'0'))::uuid;
    if not exists(select 1 from public.menu_sections s where s.id=section_id and s.menu_id=menu
      and s.name=section->>'name' and s.description is not distinct from section->>'description'
      and s.sort_order=(section->>'sort')::int and s.is_active)
    then raise exception 'Section drift; no content changed.'; end if;
  end loop;
  for item in select value from jsonb_array_elements(original->'items') loop
    item_id:=('20000000-0000-4000-8000-'||lpad(((item->>'number')::int+200)::text,12,'0'))::uuid;
    section_id:=('20000000-0000-4000-8000-'||lpad(item->>'section',12,'0'))::uuid;
    if not exists(select 1 from public.menu_items i where i.id=item_id and i.restaurant_id=tenant
      and i.name=item->>'name' and i.description is not distinct from item->>'description'
      and i.price_cents=(item->>'price')::int and i.source_system='menu-man-staging' and i.source_item_id=item->>'key' and i.is_orderable
      and i.image_path is null and i.source_image_url is not distinct from
        case when item->>'image' is null then null else '/img/super-tacos/'||(item->>'image')||'.jpg' end)
      or not exists(select 1 from public.menu_section_items p where p.id=('20000000-0000-4000-8000-'||lpad(((item->>'number')::int+300)::text,12,'0'))::uuid
        and p.item_id=item_id and p.section_id=section_id and p.sort_order=(item->>'number')::int)
      or (select count(*) from public.menu_item_modifier_groups a where a.menu_item_id=item_id and a.restaurant_id=tenant)<>jsonb_array_length(item->'groups')
    then raise exception 'Installed item or attachment identity drift: %',item_id; end if;
    for grp in select g from jsonb_array_elements(original->'modifierGroups') g where item->'groups' @> jsonb_build_array((g->>'number')::int) loop
      if not exists(select 1 from public.menu_item_modifier_groups a where a.menu_item_id=item_id and a.restaurant_id=tenant
        and a.modifier_group_id=('20000000-0000-4000-8000-'||lpad(((grp->>'number')::int+500)::text,12,'0'))::uuid
        and a.min_selections=(grp->>'min')::int and a.max_selections=(grp->>'max')::int and a.is_active)
      then raise exception 'Installed modifier attachment drift: %',item_id; end if;
    end loop;
  end loop;
  for grp in select value from jsonb_array_elements(original->'modifierGroups') loop
    group_id:=('20000000-0000-4000-8000-'||lpad(((grp->>'number')::int+500)::text,12,'0'))::uuid;
    if not exists(select 1 from public.modifier_groups g where g.id=group_id and g.restaurant_id=tenant and g.name=grp->>'name' and g.is_active)
    then raise exception 'Installed group drift.'; end if;
    for opt in select value from jsonb_array_elements(grp->'options') loop
      if not exists(select 1 from public.modifier_options o where o.id=('20000000-0000-4000-8000-'||lpad(((opt->>'number')::int+600)::text,12,'0'))::uuid
        and o.restaurant_id=tenant and o.modifier_group_id=group_id and o.name=opt->>'name'
        and o.default_price_adjustment_cents=(opt->>'price')::int and o.is_active and o.is_default=coalesce((opt->>'default')::boolean,false))
      then raise exception 'Installed option pricing/default drift.'; end if;
    end loop;
  end loop;
  -- Reject globally colliding IDs, including placements in a different menu.
  if exists(select 1 from public.menu_items i join jsonb_array_elements(revised->'items') n
      on i.id=('20000000-0000-4000-8000-'||lpad(((n->>'number')::int+200)::text,12,'0'))::uuid where i.restaurant_id<>tenant)
    or exists(select 1 from public.modifier_groups g join jsonb_array_elements(revised->'modifierGroups') n
      on g.id=('20000000-0000-4000-8000-'||lpad(((n->>'number')::int+500)::text,12,'0'))::uuid where g.restaurant_id<>tenant)
    or exists(select 1 from public.modifier_options o join jsonb_array_elements(revised->'modifierGroups') g on true cross join lateral jsonb_array_elements(g->'options') n
      where o.id=('20000000-0000-4000-8000-'||lpad(((n->>'number')::int+600)::text,12,'0'))::uuid and o.restaurant_id<>tenant)
    or exists(select 1 from public.menu_section_items p join jsonb_array_elements(revised->'items') n
      on p.id=('20000000-0000-4000-8000-'||lpad(((n->>'number')::int+300)::text,12,'0'))::uuid
      where p.item_id<>('20000000-0000-4000-8000-'||lpad(((n->>'number')::int+200)::text,12,'0'))::uuid
        or p.section_id<>('20000000-0000-4000-8000-'||lpad(n->>'section',12,'0'))::uuid)
  then raise exception 'Reserved ID collision; no identity adopted.'; end if;
  other_before:=(${checksum});

  -- Retain retired rows, names, IDs and engagement history; remove only menu placements.
  for retired in select value from jsonb_array_elements(revised->'retiredItems') loop
    item_id:=('20000000-0000-4000-8000-'||lpad(((retired->>'number')::int+200)::text,12,'0'))::uuid;
    update public.menu_items set is_orderable=false,source_image_url=null,image_path=null where id=item_id and restaurant_id=tenant;
    update public.menu_item_modifier_groups set is_active=false where menu_item_id=item_id and restaurant_id=tenant;
    delete from public.menu_section_items p using public.menu_sections s where p.section_id=s.id and s.menu_id=menu and p.item_id=item_id;
  end loop;
  for section in select value from jsonb_array_elements(revised->'sections') loop
    section_id:=('20000000-0000-4000-8000-'||lpad(section->>'number',12,'0'))::uuid;
    update public.menu_sections set name=section->>'name',description=section->>'description'
      where id=section_id and menu_id=menu and sort_order=(section->>'sort')::int;
    if not found then raise exception 'Section identity or ordering drift.'; end if;
  end loop;
  for grp in select value from jsonb_array_elements(revised->'modifierGroups') loop
    group_id:=('20000000-0000-4000-8000-'||lpad(((grp->>'number')::int+500)::text,12,'0'))::uuid;
    insert into public.modifier_groups(id,restaurant_id,name,is_active) values(group_id,tenant,grp->>'name',true)
      on conflict(id) do update set name=excluded.name,is_active=true where modifier_groups.restaurant_id=tenant;
    ordinal:=0;
    for opt in select value from jsonb_array_elements(grp->'options') loop
      option_id:=('20000000-0000-4000-8000-'||lpad(((opt->>'number')::int+600)::text,12,'0'))::uuid;
      insert into public.modifier_options(id,restaurant_id,modifier_group_id,name,default_price_adjustment_cents,sort_order,is_active,is_default)
        values(option_id,tenant,group_id,opt->>'name',(opt->>'price')::int,ordinal,true,coalesce((opt->>'default')::boolean,false))
        on conflict(id) do update set name=excluded.name,default_price_adjustment_cents=excluded.default_price_adjustment_cents,
          sort_order=excluded.sort_order,is_active=true,is_default=excluded.is_default where modifier_options.restaurant_id=tenant and modifier_options.modifier_group_id=excluded.modifier_group_id;
      ordinal:=ordinal+1;
    end loop;
  end loop;
  for item in select value from jsonb_array_elements(revised->'items') loop
    item_id:=('20000000-0000-4000-8000-'||lpad(((item->>'number')::int+200)::text,12,'0'))::uuid;
    section_id:=('20000000-0000-4000-8000-'||lpad(item->>'section',12,'0'))::uuid;
    insert into public.menu_items(id,restaurant_id,name,description,price_cents,source_system,source_item_id,is_orderable,source_image_url,image_path)
      values(item_id,tenant,item->>'name',item->>'description',(item->>'price')::int,'menu-man-staging',item->>'key',true,item->>'imageUrl',null)
      on conflict(id) do update set name=excluded.name,description=excluded.description,price_cents=excluded.price_cents,
        is_orderable=true,source_image_url=excluded.source_image_url,image_path=null where menu_items.restaurant_id=tenant;
    insert into public.menu_section_items(id,section_id,item_id,sort_order)
      values(('20000000-0000-4000-8000-'||lpad(((item->>'number')::int+300)::text,12,'0'))::uuid,section_id,item_id,(item->>'number')::int)
      on conflict(id) do update set sort_order=excluded.sort_order where menu_section_items.section_id=section_id and menu_section_items.item_id=item_id;
    ordinal:=0;
    for group_number in select value::text::int from jsonb_array_elements(item->'groups') loop
      select g into grp from jsonb_array_elements(revised->'modifierGroups') g where (g->>'number')::int=group_number;
      group_id:=('20000000-0000-4000-8000-'||lpad((group_number+500)::text,12,'0'))::uuid;
      insert into public.menu_item_modifier_groups(restaurant_id,menu_item_id,modifier_group_id,min_selections,max_selections,sort_order,is_active)
        values(tenant,item_id,group_id,(grp->>'min')::int,(grp->>'max')::int,ordinal,true)
        on conflict(menu_item_id,modifier_group_id) do update set min_selections=excluded.min_selections,max_selections=excluded.max_selections,sort_order=excluded.sort_order,is_active=true
          where menu_item_modifier_groups.restaurant_id=tenant;
      ordinal:=ordinal+1;
    end loop;
  end loop;
  update public.restaurants set logo_url=revised->'restaurant'->>'logo_url',
    hero_image_url=revised->'restaurant'->>'hero_image_url',phone=revised->'restaurant'->>'phone',
    address_line1=revised->'restaurant'->>'address_line1',city=revised->'restaurant'->>'city',
    state=revised->'restaurant'->>'state',postal_code=revised->'restaurant'->>'postal_code'
    where id=tenant and slug='super-tacos';

  if (select count(*) from public.menu_items where restaurant_id=tenant)<>${totalItems}
    or (select count(*) from public.menu_items where restaurant_id=tenant and is_orderable)<>${after.items.length}
    or (select count(*) from public.menu_section_items p join public.menu_sections s on s.id=p.section_id where s.menu_id=menu)<>${after.items.length}
    or (select count(*) from public.modifier_groups where restaurant_id=tenant and is_active)<>9
    or (select count(*) from public.modifier_options where restaurant_id=tenant and is_active)<>35
  then raise exception 'Content postconditions failed; transaction rolled back.'; end if;
  for section in select value from jsonb_array_elements(revised->'sections') loop
    section_id:=('20000000-0000-4000-8000-'||lpad(section->>'number',12,'0'))::uuid;
    if not exists(select 1 from public.menu_sections s where s.id=section_id and s.menu_id=menu
      and s.name=section->>'name' and s.description is not distinct from section->>'description'
      and s.sort_order=(section->>'sort')::int and s.is_active)
    then raise exception 'Section postcondition failed.'; end if;
  end loop;
  for item in select value from jsonb_array_elements(revised->'items') loop
    item_id:=('20000000-0000-4000-8000-'||lpad(((item->>'number')::int+200)::text,12,'0'))::uuid;
    if not exists(select 1 from public.menu_items i where i.id=item_id and i.restaurant_id=tenant and i.is_orderable
      and i.name=item->>'name' and i.description is not distinct from item->>'description'
      and i.price_cents=(item->>'price')::int and i.source_item_id=item->>'key'
      and i.source_image_url is not distinct from item->>'imageUrl' and i.image_path is null)
      or not exists(select 1 from public.menu_section_items p where p.id=('20000000-0000-4000-8000-'||lpad(((item->>'number')::int+300)::text,12,'0'))::uuid
        and p.item_id=item_id and p.section_id=('20000000-0000-4000-8000-'||lpad(item->>'section',12,'0'))::uuid)
      or (select count(*) from public.menu_item_modifier_groups a where a.menu_item_id=item_id and a.restaurant_id=tenant and a.is_active)<>jsonb_array_length(item->'groups')
    then raise exception 'Canonical item postcondition failed: %',item_id; end if;
    for group_number in select value::text::int from jsonb_array_elements(item->'groups') loop
      select g into grp from jsonb_array_elements(revised->'modifierGroups') g where (g->>'number')::int=group_number;
      group_id:=('20000000-0000-4000-8000-'||lpad((group_number+500)::text,12,'0'))::uuid;
      if not exists(select 1 from public.menu_item_modifier_groups a where a.restaurant_id=tenant and a.menu_item_id=item_id
        and a.modifier_group_id=group_id and a.is_active and a.min_selections=(grp->>'min')::int and a.max_selections=(grp->>'max')::int)
      then raise exception 'Required modifier postcondition failed: %',item_id; end if;
    end loop;
  end loop;
  other_after:=(${checksum});
  if other_before is distinct from other_after then raise exception 'Other-tenant content changed; transaction rolled back.'; end if;
  if not exists(select 1 from public.restaurants where id=tenant and slug='super-tacos' and not is_indexable
    and logo_url=revised->'restaurant'->>'logo_url' and phone=revised->'restaurant'->>'phone'
    and address_line1=revised->'restaurant'->>'address_line1' and city=revised->'restaurant'->>'city'
    and state=revised->'restaurant'->>'state' and postal_code=revised->'restaurant'->>'postal_code'
    and google_maps_url is null)
  then raise exception 'Restaurant contact postcondition failed.'; end if;
  raise notice 'Super Tacos C.3 content verified; archived IDs and hearts preserved. Backup SHA256: %',current_setting('menu_man.content_backup');
end;
$sync$;
commit;
`;
writeFileSync("supabase/seeds/staging/016_super_tacos_content_c1.sql", script);
const backup = `-- Read-only tenant-content export, for the separately approved 016 sync.
\\set ON_ERROR_STOP on
\\encoding UTF8
begin read only;
${settings}do $backup$
begin${guard}
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
`;
writeFileSync("supabase/qa/super-tacos-content-backup.sql", backup);
const verify = `-- Read-only verification after a separately approved successful content sync.
\\set ON_ERROR_STOP on
\\encoding UTF8
begin read only;
${settings}do $verify$
declare
  tenant constant uuid := '20000000-0000-4000-8000-000000000001';
  menu constant uuid := '20000000-0000-4000-8000-000000000002';
  revised constant jsonb := ${q(JSON.stringify(after))}::jsonb;
  item jsonb; section jsonb; retired jsonb; grp jsonb;
  item_id uuid; section_id uuid; group_id uuid;
begin${guard}
  if (select count(*) from public.menu_items where restaurant_id=tenant)<>${totalItems}
    or (select count(*) from public.menu_items where restaurant_id=tenant and is_orderable)<>${after.items.length}
    or (select count(*) from public.menu_section_items p join public.menu_sections s on s.id=p.section_id where s.menu_id='20000000-0000-4000-8000-000000000002')<>${after.items.length}
    or (select count(*) from public.modifier_groups where restaurant_id=tenant and is_active)<>9
    or (select count(*) from public.modifier_options where restaurant_id=tenant and is_active)<>35
    or exists(select 1 from public.menu_items where restaurant_id=tenant and is_orderable and (image_path is not null or source_image_url is null or source_image_url not like '/img/super-tacos/approved/%'))
    or not exists(select 1 from public.restaurants where id=tenant and slug='super-tacos' and not is_indexable
      and logo_url='/img/super-tacos/approved/supertacologo.svg' and hero_image_url='/img/super-tacos/approved/carnitas-tacos.webp'
      and phone='(951) 555-0147' and address_line1='0000 Magnolia Avenue' and city='Riverside'
      and state='CA' and postal_code='92503' and google_maps_url is null)
  then raise exception 'C.3 content verification failed; stop for review.'; end if;
  for section in select value from jsonb_array_elements(revised->'sections') loop
    section_id:=('20000000-0000-4000-8000-'||lpad(section->>'number',12,'0'))::uuid;
    if not exists(select 1 from public.menu_sections s where s.id=section_id and s.menu_id=menu
      and s.name=section->>'name' and s.description is not distinct from section->>'description'
      and s.sort_order=(section->>'sort')::int and s.is_active)
    then raise exception 'Section content mismatch: %',section_id; end if;
  end loop;
  for item in select value from jsonb_array_elements(revised->'items') loop
    item_id:=('20000000-0000-4000-8000-'||lpad(((item->>'number')::int+200)::text,12,'0'))::uuid;
    section_id:=('20000000-0000-4000-8000-'||lpad(item->>'section',12,'0'))::uuid;
    if not exists(select 1 from public.menu_items i where i.id=item_id and i.restaurant_id=tenant
      and i.is_orderable and i.name=item->>'name' and i.description is not distinct from item->>'description'
      and i.price_cents=(item->>'price')::int and i.source_item_id=item->>'key'
      and i.source_image_url=item->>'imageUrl' and i.image_path is null)
      or not exists(select 1 from public.menu_section_items p where p.id=('20000000-0000-4000-8000-'||lpad(((item->>'number')::int+300)::text,12,'0'))::uuid
        and p.item_id=item_id and p.section_id=section_id)
      or (select count(*) from public.menu_item_modifier_groups a where a.restaurant_id=tenant and a.menu_item_id=item_id and a.is_active)<>jsonb_array_length(item->'groups')
    then raise exception 'Active item content mismatch: %',item_id; end if;
    for grp in select g from jsonb_array_elements(revised->'modifierGroups') g where item->'groups' @> jsonb_build_array((g->>'number')::int) loop
      group_id:=('20000000-0000-4000-8000-'||lpad(((grp->>'number')::int+500)::text,12,'0'))::uuid;
      if not exists(select 1 from public.menu_item_modifier_groups a where a.restaurant_id=tenant
        and a.menu_item_id=item_id and a.modifier_group_id=group_id and a.is_active
        and a.min_selections=(grp->>'min')::int and a.max_selections=(grp->>'max')::int)
      then raise exception 'Active modifier mismatch: %',item_id; end if;
    end loop;
  end loop;
  for retired in select value from jsonb_array_elements(revised->'retiredItems') loop
    item_id:=('20000000-0000-4000-8000-'||lpad(((retired->>'number')::int+200)::text,12,'0'))::uuid;
    if not exists(select 1 from public.menu_items i where i.id=item_id and i.restaurant_id=tenant and not i.is_orderable)
      or exists(select 1 from public.menu_section_items p join public.menu_sections s on s.id=p.section_id where s.menu_id=menu and p.item_id=item_id)
    then raise exception 'Retired item mismatch: %',item_id; end if;
  end loop;
end;
$verify$;
select jsonb_build_object('project_ref','jjvongzvtnzlvwdfcnjk','content_version','sprint-c3',
  'items',(select jsonb_agg(jsonb_build_object('id',id,'name',name,'price_cents',price_cents,'image',source_image_url) order by id) from public.menu_items where restaurant_id='20000000-0000-4000-8000-000000000001' and is_orderable),
  'required_choices',(select jsonb_agg(to_jsonb(a) order by menu_item_id,modifier_group_id) from public.menu_item_modifier_groups a where restaurant_id='20000000-0000-4000-8000-000000000001' and is_active and min_selections>0));
commit;
`;
writeFileSync("supabase/qa/super-tacos-content-verify.sql", verify);
const sha = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");
writeFileSync("supabase/qa/super-tacos-content-c1-manifest.json", JSON.stringify({
  version: "sprint-c3", projectRef: "jjvongzvtnzlvwdfcnjk", tenantId: before.restaurantId,
  files: Object.fromEntries([
    "supabase/seeds/staging/super-tacos-demo.json", "supabase/qa/super-tacos-installed-catalog-v1.json",
    "supabase/seeds/staging/016_super_tacos_content_c1.sql", "supabase/qa/super-tacos-content-backup.sql", "supabase/qa/super-tacos-content-verify.sql",
  ].map((file) => [file, sha(file)])),
}, null, 2) + "\n");
console.log("Prepared content sync and read-only backup SQL. Neither was executed.");
