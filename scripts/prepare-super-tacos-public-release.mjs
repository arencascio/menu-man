// PREPARATION ONLY. Generates a new-tenant-only Production content release.
// Never imports the Staging installer, operational records, or payment settings.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';

const root = new URL('../', import.meta.url);
const source = 'supabase/seeds/staging/super-tacos-demo.json';
const theme = 'src/lib/demo/theme.json';
const c = JSON.parse(readFileSync(new URL(source, root), 'utf8'));
const id = n => `20000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const q = value => value === null ? 'null' : typeof value === 'boolean' || typeof value === 'number' ? String(value) : `'${String(value).replaceAll("'", "''")}'`;
const hash = data => createHash('sha256').update(data).digest('hex');
const tenant = c.restaurant.id, menu = c.menuId;
assert.equal(tenant, id(1)); assert.equal(menu, id(2));
assert.equal(c.items.length, 25); assert.equal(c.sections.length, 6);
assert.equal(c.modifierGroups.length, 9);
assert.equal(c.modifierGroups.flatMap(g => g.options).length, 35);
for (const item of c.items) {
  assert.ok(existsSync(new URL(`public${item.imageUrl}`, root)), item.imageUrl);
  assert.ok(c.sections.some(s => s.number === item.section));
  for (const group of item.groups) assert.ok(c.modifierGroups.some(g => g.number === group));
}

const restaurant = {
  ...Object.fromEntries(['id','slug','name','tagline','description','logo_url','hero_image_url','phone','address_line1','city','state','postal_code','timezone','theme_preset'].map(k => [k,c.restaurant[k]])),
  currency: 'USD', is_active: true, is_indexable: false,
  theme_overrides: JSON.parse(readFileSync(new URL(theme, root), 'utf8')),
  primary_domain: null, pickup_url: null, doordash_url: null, google_maps_url: null,
  instagram_url: null, facebook_url: null, latitude: null, longitude: null,
};
const rows = {
  restaurants: [restaurant],
  menus: [{ id: menu, restaurant_id: tenant, name: 'Super Tacos Showcase Menu', is_published: true }],
  menu_sections: c.sections.map(s => ({ id:id(s.number),menu_id:menu,name:s.name,description:s.description,sort_order:s.sort,is_active:true })),
  menu_items: c.items.map(i => ({ id:id(200+i.number),restaurant_id:tenant,name:i.name,description:i.description,price_cents:i.price,source_system:'menu-man-public-showcase',source_item_id:i.key,is_orderable:false,image_url:i.imageUrl,source_image_url:i.imageUrl,image_path:null })),
  menu_section_items: c.items.map(i => ({ id:id(300+i.number),section_id:id(i.section),item_id:id(200+i.number),sort_order:i.number })),
  modifier_groups: c.modifierGroups.map(g => ({ id:id(500+g.number),restaurant_id:tenant,name:g.name,is_active:true })),
  modifier_options: c.modifierGroups.flatMap(g => g.options.map((o,n) => ({ id:id(600+o.number),restaurant_id:tenant,modifier_group_id:id(500+g.number),name:o.name,default_price_adjustment_cents:o.price,sort_order:n,is_active:true,is_default:o.default===true }))),
  menu_item_modifier_groups: c.items.flatMap(i => i.groups.map((number,n) => {
    const g = c.modifierGroups.find(g => g.number === number);
    return { restaurant_id:tenant,menu_item_id:id(200+i.number),modifier_group_id:id(500+number),min_selections:g.min,max_selections:g.max,sort_order:n,is_active:true };
  })),
  restaurant_business_hours: Array.from({length:7},(_,n) => ({ restaurant_id:tenant,day_of_week:n,open_time:'09:00:00',close_time:'22:00:00',is_closed:false,sort_order:0 })),
  restaurant_ordering_settings: [{ restaurant_id:tenant,pickup_enabled:false,asap_enabled:false,scheduled_pickup_enabled:false,tax_strategy:'provider',tax_rate_basis_points:null }],
  restaurant_notification_settings: [{ restaurant_id:tenant,customer_order_confirmation_email:false,customer_ready_for_pickup_email:false,customer_refund_confirmation_email:false,internal_new_paid_order_email:false,internal_payment_refund_exception_email:false,internal_email_recipient:null }],
};
for (const list of Object.values(rows)) {
  const ids = list.filter(r => r.id).map(r => r.id);
  assert.equal(new Set(ids).size, ids.length, 'Duplicate deterministic identity');
}
const scopes = Object.fromEntries(Object.keys(rows).map(table => [table,
  table==='restaurants' ? `id=${q(tenant)}::uuid` : table==='menu_sections' ? `menu_id=${q(menu)}::uuid` : table==='menu_section_items'
    ? `section_id in (select id from public.menu_sections where menu_id=${q(menu)}::uuid) or item_id in (select id from public.menu_items where restaurant_id=${q(tenant)}::uuid)`
    : `restaurant_id=${q(tenant)}::uuid`]));
const paymentTables = ['restaurant_payment_connections','payment_provider_references','payments','payment_attempts','refunds','orders'];
const digest = expression => `encode(sha256(convert_to(${expression},'UTF8')),'hex')`;
const fingerprint = (table, condition='true') => `(select ${digest(`coalesce(string_agg(${digest('to_jsonb(a)::text')},'' order by ${digest('to_jsonb(a)::text')}),'')`)} from public.${table} a where ${condition})`;
const otherContent = digest(`concat_ws('|',${Object.keys(rows).map(t => fingerprint(t,`not (${scopes[t]})`)).join(',')})`);
const payments = digest(`concat_ws('|',${paymentTables.map(t => fingerprint(t)).join(',')})`);
const connection = `\\set ON_ERROR_STOP on
-- Direct Production connection only. No pooler host is inferred or accepted.
-- Run via the read-only wrapper for preflight/verification with pinned trust.
\\getenv release_sslmode PGSSLMODE
\\getenv release_rootcert PGSSLROOTCERT
\\getenv release_appdata APPDATA
begin isolation level serializable TRANSACTION_MODE;
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
    or current_setting('menu_man.release_host') <> 'db.fullaiodvmilkdxyxnln.supabase.co'
    or current_setting('menu_man.release_user') <> 'postgres'
    or current_setting('menu_man.release_port') <> '5432'
    or current_database() <> 'postgres' or current_user <> 'postgres'
    or current_setting('menu_man.release_sslmode') <> 'verify-full'
    or btrim(current_setting('menu_man.release_rootcert')) = ''
    or replace(lower(current_setting('menu_man.release_rootcert')),chr(92),'/') <> replace(lower(current_setting('menu_man.release_appdata')),chr(92),'/') || '/postgresql/root.crt'
    or not coalesce((select ssl from pg_stat_ssl where pid=pg_backend_pid()),false)
  then raise exception 'Exact Production identity and verified TLS required'; end if;
end $$;
`;
const emptyGuard = `do $$ declare t text; collision boolean; v_entry record; v_column text; begin
  for v_entry in select key,value from jsonb_each($schema$${JSON.stringify(Object.fromEntries(Object.entries(rows).map(([t,list])=>[t,Object.keys(list[0])])))}$schema$::jsonb) loop
    for v_column in select value from jsonb_array_elements_text(v_entry.value) loop
      if not exists(select 1 from information_schema.columns col where col.table_schema='public' and col.table_name=v_entry.key and col.column_name=v_column)
      then raise exception 'Required column missing: %.%',v_entry.key,v_column; end if;
    end loop;
  end loop;
  if not exists(select 1 from pg_trigger where tgrelid='public.restaurants'::regclass and tgname='restaurants_initialize_notification_settings' and tgenabled='O')
  then raise exception 'Expected notification initialization trigger missing; review Production schema'; end if;
  if exists(select 1 from public.restaurants where lower(slug)='super-tacos' or id=${q(tenant)}::uuid)
  then raise exception 'Existing restaurant: stop; never adopt, overwrite or rerun'; end if;
  foreach t in array array['restaurants','menus','menu_sections','menu_items','menu_section_items','modifier_groups','modifier_options'] loop
    execute format('select exists(select 1 from public.%I where id::text like ''20000000-0000-4000-8000-%%'')',t) into collision;
    if collision then raise exception 'Reserved identity collision in %',t; end if;
  end loop;
end $$;
`;
const expected = JSON.stringify(rows);
const verify = `do $$ declare expected jsonb := $catalog$${expected}$catalog$::jsonb; entry record; wanted jsonb; found_row boolean; actual_count bigint; begin
  for entry in select key,value from jsonb_each(expected) loop
    for wanted in select value from jsonb_array_elements(entry.value) loop
      execute format('select exists(select 1 from public.%I a where to_jsonb(a) @> $1)',entry.key) into found_row using wanted;
      if not found_row then raise exception 'Content/identity mismatch in %',entry.key; end if;
    end loop;
    execute format('select count(*) from public.%I where %s',entry.key,($scopes$${JSON.stringify(scopes)}$scopes$::jsonb)->>entry.key) into actual_count;
    if actual_count <> jsonb_array_length(entry.value) then raise exception 'Unexpected scoped rows in %',entry.key; end if;
  end loop;
  if exists(select 1 from public.menu_item_modifier_option_overrides where restaurant_id=${q(tenant)}::uuid)
    or exists(select 1 from public.restaurant_payment_connections where restaurant_id=${q(tenant)}::uuid)
    or exists(select 1 from public.orders where restaurant_id=${q(tenant)}::uuid)
    or exists(select 1 from public.restaurant_catering_settings where restaurant_id=${q(tenant)}::uuid)
    or exists(select 1 from public.restaurant_delivery_providers where restaurant_id=${q(tenant)}::uuid)
  then raise exception 'Unexpected operational configuration or records'; end if;
end $$;
`;
const baselineSelect = `select jsonb_build_object('project','fullaiodvmilkdxyxnln','tenant',${q(tenant)},'capturedAt',now(),'otherContent',${otherContent},'paymentsAndOrders',${payments},'existingSuperTacos',false);\n`;
const compare = `do $$ begin
  if current_setting('menu_man.baseline_content') <> ${otherContent}
    or current_setting('menu_man.baseline_payments') <> ${payments}
  then raise exception 'Other-tenant content or payment/order fingerprint changed; rollback/stop'; end if;
end $$;
`;
const baselineInputs = `select set_config('menu_man.baseline_content', :'baseline_content_sha', true);
select set_config('menu_man.baseline_payments', :'baseline_payments_sha', true);
`;
let insert = '';
for (const [table,list] of Object.entries(rows)) {
  const columns = Object.keys(list[0]);
  if (table==='restaurant_notification_settings') {
    // Core schema automatically creates this row with email defaults. Disable
    // them only for the tenant created above in this same transaction.
    insert += `update public.restaurant_notification_settings set ${columns.filter(k=>k!=='restaurant_id').map(k=>`${k}=${q(list[0][k])}`).join(',')} where restaurant_id=${q(tenant)}::uuid;\n`;
    continue;
  }
  insert += `insert into public.${table} (${columns.join(',')}) values\n${list.map(row => `(${columns.map(k => q(typeof row[k]==='object' && row[k]!==null ? JSON.stringify(row[k]) : row[k])).join(',')})`).join(',\n')};\n`;
}
const sql = connection.replace('TRANSACTION_MODE','read write') + `
-- Separate future Production approval, verified database backup and fresh
-- read-only preflight are prerequisites. This package has no execution wrapper.
select set_config('menu_man.release_approval', :'approve_public_content', true);
select set_config('menu_man.backup_sha', :'production_backup_sha256', true);
select set_config('menu_man.baseline_at', :'baseline_captured_at', true);
do $$ begin
  if current_setting('menu_man.release_approval') <> 'publish-super-tacos-browse-only'
    or current_setting('menu_man.backup_sha') !~ '^[a-f0-9]{64}$'
    or current_setting('menu_man.baseline_at')::timestamptz < now()-interval '30 minutes'
    or current_setting('menu_man.baseline_at')::timestamptz > now()
  then raise exception 'Separate approval, verified backup SHA and fresh baseline required'; end if;
  perform pg_advisory_xact_lock(20000000, 300);
end $$;
` + emptyGuard + baselineInputs + compare + insert + verify + compare + 'commit;\n';
const artifacts = {
  'preflight.sql': connection.replace('TRANSACTION_MODE','read only') + emptyGuard + baselineSelect + 'rollback;\n',
  'content.sql': sql,
  'verify.sql': connection.replace('TRANSACTION_MODE','read only') + baselineInputs + verify + compare + `select 'Super Tacos browse-only content, noindex, 25 items, 6 sections, 9 groups, 35 options, disabled commerce and baseline fingerprints verified';\nrollback;\n`,
  'armandos-preflight.sql': connection.replace('TRANSACTION_MODE','read only') + `
select jsonb_build_object('slug',r.slug,'id',r.id,'active',r.is_active,'indexable',r.is_indexable,
  'publishedMenus',(select count(*) from public.menus where restaurant_id=r.id and is_published),
  'activeSections',(select count(*) from public.menu_sections s join public.menus m on m.id=s.menu_id where m.restaurant_id=r.id and m.is_published and s.is_active),
  'items',(select count(*) from public.menu_items where restaurant_id=r.id),
  'orderableItems',(select count(*) from public.menu_items where restaurant_id=r.id and is_orderable),
  'pickupEnabled',(select pickup_enabled from public.restaurant_ordering_settings where restaurant_id=r.id),
  'hasActivePaymentRoute',exists(select 1 from public.restaurant_payment_connections where restaurant_id=r.id and is_payment_route and connection_status='active'))
from public.restaurants r where r.slug='armandos';
rollback;
`,
};
const folder = 'supabase/releases/super-tacos-public';
mkdirSync(new URL(folder+'/',root),{recursive:true});
for (const [name,data] of Object.entries(artifacts)) writeFileSync(new URL(`${folder}/${name}`,root),data);
const assets = [...new Set([...c.items.map(i=>i.imageUrl),c.restaurant.logo_url,c.restaurant.hero_image_url])];
writeFileSync(new URL(`${folder}/manifest.json`,root),JSON.stringify({project:'fullaiodvmilkdxyxnln',tenant,menu,mode:'new-tenant-only-browse-only',counts:{items:25,sections:6,groups:9,options:35},sources:{[source]:hash(readFileSync(new URL(source,root))),[theme]:hash(readFileSync(new URL(theme,root))),'scripts/prepare-super-tacos-public-release.mjs':hash(readFileSync(new URL(import.meta.url)))},assets:Object.fromEntries(assets.map(path=>['public'+path,hash(readFileSync(new URL('public'+path,root)))])),artifacts:Object.fromEntries(Object.entries(artifacts).map(([name,data])=>[name,hash(data)]))},null,2)+'\n');
console.log('Prepared separate Production content package; no database connection or SQL execution.');
