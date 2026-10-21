// Generates a reviewable staging-only SQL file. Does not connect to a database.
import { readFileSync, writeFileSync } from 'node:fs';
const data = JSON.parse(readFileSync('supabase/seeds/staging/super-tacos-demo.json', 'utf8'));
if (data.contentVersion) throw new Error('The one-time 015 installer is frozen. Use the separately reviewed content-sync script for Sprint C.1.');
data.restaurant.theme_overrides = JSON.parse(readFileSync('src/lib/demo/theme.json', 'utf8'));
const id = n => `20000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const q = value => value == null ? 'null' : "'" + String(value).replaceAll("'", "''") + "'";
const tenant = q(data.restaurant.id);
const prefix = readFileSync('supabase/qa/super-tacos-demo-guard.sql', 'utf8');
let sql = prefix + '\n-- Generated from super-tacos-demo.json. Review JSON and generator together.\n';
sql += `do $$ begin if exists(select 1 from public.menu_section_items actual join (values ${data.items.map(item=>`(${q(id(300+item.number))}::uuid,${q(id(200+item.number))}::uuid,${q(id(item.section))}::uuid)`).join(',')}) expected(id,item_id,section_id) on actual.id=expected.id where actual.item_id<>expected.item_id or actual.section_id<>expected.section_id) then raise exception 'Unexpected placement identity; stop without adopting it.'; end if; end; $$;\n`;
const fields=['name','tagline','description','logo_url','hero_image_url','phone','address_line1','city','state','postal_code','timezone','theme_preset'];
sql += `update public.restaurants set ${fields.map(k=>`${k}=${q(data.restaurant[k])}`).join(',\n  ')}, theme_overrides=${q(JSON.stringify(data.restaurant.theme_overrides))}::jsonb, is_indexable=false where id=${tenant} and slug='super-tacos';\n`;
for (const section of data.sections) {
  sql += `insert into public.menu_sections (id,menu_id,name,description,sort_order,is_active) values (${q(id(section.number))},${q(data.menuId)},${q(section.name)},${q(section.description)},${section.sort},true) on conflict(id) do update set name=excluded.name,description=excluded.description,sort_order=excluded.sort_order,is_active=true;\n`;
}
for (const item of data.items) {
  sql += `insert into public.menu_items (id,restaurant_id,name,description,price_cents,source_system,source_item_id,is_orderable,source_image_url,image_path) values (${q(id(200+item.number))},${tenant},${q(item.name)},${q(item.description)},${item.price},'menu-man-staging',${q(item.key)},true,${q(item.image ? '/img/super-tacos/'+item.image+'.jpg' : null)},null) on conflict(id) do update set name=excluded.name,description=excluded.description,price_cents=excluded.price_cents,is_orderable=true,source_image_url=excluded.source_image_url,image_path=null;\n`;
  sql += `insert into public.menu_section_items (id,section_id,item_id,sort_order) values (${q(id(300+item.number))},${q(id(item.section))},${q(id(200+item.number))},${item.number}) on conflict(id) do update set section_id=excluded.section_id,sort_order=excluded.sort_order;\n`;
}
for (const group of data.modifierGroups) {
  sql += `insert into public.modifier_groups(id,restaurant_id,name,is_active) values (${q(id(500+group.number))},${tenant},${q(group.name)},true);\n`;
  for (const [sort,option] of group.options.entries()) {
    sql += `insert into public.modifier_options(id,restaurant_id,modifier_group_id,name,default_price_adjustment_cents,sort_order,is_active,is_default) values (${q(id(600+option.number))},${tenant},${q(id(500+group.number))},${q(option.name)},${option.price},${sort},true,${option.default===true});\n`;
  }
  for (const item of data.items.filter(i=>i.groups.includes(group.number))) {
    sql += `insert into public.menu_item_modifier_groups(restaurant_id,menu_item_id,modifier_group_id,min_selections,max_selections,sort_order,is_active) values (${tenant},${q(id(200+item.number))},${q(id(500+group.number))},${group.min},${group.max},${group.number},true);\n`;
  }
}
sql += `insert into public.restaurant_business_hours(restaurant_id,day_of_week,open_time,close_time,is_closed,sort_order) select ${tenant},day,'09:00'::time,'22:00'::time,false,0 from generate_series(0,6) day;\n`;
sql += `update public.restaurant_ordering_settings set pickup_enabled=true,asap_enabled=true,scheduled_pickup_enabled=true,pickup_lead_time_minutes=20,pickup_cutoff_minutes_before_close=20,pickup_slot_interval_minutes=15,advance_order_days=3,pickup_max_orders_per_interval=10,tax_strategy='restaurant_percentage',tax_rate_basis_points=825,customer_name_required=true,customer_email_required=false,customer_phone_required=false where restaurant_id=${tenant};\n`;
sql += `insert into public.restaurant_notification_settings(restaurant_id,customer_order_confirmation_email,customer_ready_for_pickup_email,customer_refund_confirmation_email,internal_new_paid_order_email,internal_payment_refund_exception_email,internal_email_recipient) values (${tenant},false,false,false,false,false,null) on conflict(restaurant_id) do update set customer_order_confirmation_email=false,customer_ready_for_pickup_email=false,customer_refund_confirmation_email=false,internal_new_paid_order_email=false,internal_payment_refund_exception_email=false,internal_email_recipient=null;\n`;
sql += `alter table public.restaurant_notification_settings add constraint super_tacos_demo_no_email check (restaurant_id<>${tenant} or (not customer_order_confirmation_email and not customer_ready_for_pickup_email and not customer_refund_confirmation_email and not internal_new_paid_order_email and not internal_payment_refund_exception_email and internal_email_recipient is null));\n`;
sql += `alter table public.restaurant_payment_connections add constraint super_tacos_demo_sandbox_only check (restaurant_id<>${tenant} or (provider_key='square' and environment='sandbox' and coalesce(provider_metadata->>'publicDemo','')='true'));\n`;
sql += `insert into public.restaurant_payment_connections(restaurant_id,provider_key,environment,connection_status,is_payment_route,credential_secret_ref,capabilities,provider_account_reference,provider_metadata,last_verified_at) values (${tenant},'square','sandbox','active',true,'vercel-env:SQUARE_DEMO_SANDBOX_ACCESS_TOKEN',array['accept_payments','refunds','manual_capture'],:'square_merchant_id',jsonb_build_object('publicDemo',true,'locationId',:'square_location_id','country','US','currency','USD'),now());\n`;
sql += `insert into public.payment_provider_references(connection_id,provider_key,environment,reference_kind,external_id,is_primary) select connection.id,'square','sandbox',reference.kind,reference.external_id,true from public.restaurant_payment_connections connection cross join lateral (values ('merchant',:'square_merchant_id'),('location',:'square_location_id')) reference(kind,external_id) where restaurant_id=${tenant};\n`;
sql += readFileSync('supabase/qa/super-tacos-demo-protection.sql','utf8');
sql += '\ncommit;\n';
writeFileSync('supabase/seeds/staging/015_super_tacos_demo.sql', sql);
console.log('Prepared staging-only SQL; not executed.');
