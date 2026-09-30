-- Armando's provisional fries, nachos, quesadillas, and sides batch 3. Staging tenant only; safe to replay.
begin;
select pg_catalog.set_config('menu_man.seed_environment','staging',true);

create temporary table armando_fries_sides_plan (
  source_item_id text primary key,
  item_name text not null,
  expected_price_cents integer not null,
  removal_option_ids text[] not null,
  add_option_ids text[] not null,
  required_group_id text
) on commit drop;

insert into armando_fries_sides_plan values
  ('421785797','Adobada Chips',1699,array['guacamole','cheese']::text[],array['sour-cream']::text[],null),
  ('10770317768','Adobada Fries with Sour Cream',1699,array['guacamole','cheese','sour-cream']::text[],array[]::text[],null),
  ('198880554','Adobada Quesadilla',1325,array['guacamole','pico','lettuce']::text[],array[]::text[],null),
  ('10608873268','Birria Fries',1465,array['beans','cheese','onion','cilantro']::text[],array['guacamole','sour-cream']::text[],null),
  ('10609047987','Birria Nachos',1475,array['cheese','onion','cilantro']::text[],array['guacamole','sour-cream']::text[],null),
  ('9813230337','Cabeza Quesadilla',1399,array['guacamole','pico','lettuce']::text[],array[]::text[],null),
  ('198880523','Carne Asada Chips',1899,array['guacamole','cheese']::text[],array['sour-cream']::text[],null),
  ('198880524','Carne Asada Fries',1899,array['guacamole','cheese']::text[],array['sour-cream']::text[],null),
  ('8570438359','Carne Asada Fries with Beans',1676,array['beans','guacamole','cheese']::text[],array['sour-cream']::text[],null),
  ('8286200667','Carne Asada Fries with Beans and Sour Cream – No Guacamole',1899,array['beans','cheese','sour-cream']::text[],array[]::text[],null),
  ('10891185528','Carne Asada Fries with Picó de Gallo',1899,array['guacamole','cheese','pico']::text[],array['sour-cream']::text[],null),
  ('759912715','Carne Asada Fries with Sour Cream',1999,array['guacamole','cheese','sour-cream']::text[],array[]::text[],null),
  ('8286730317','Carne Asada Fries with Sour Cream – No Guacamole',1878,array['cheese','sour-cream']::text[],array[]::text[],null),
  ('8287922962','Carne Asada Fries with Sour Cream, Rice, and Beans',1845,array['cheese','sour-cream','rice','beans']::text[],array['guacamole']::text[],null),
  ('5995006478','Carne Asada Nachos with Beans, Onion, and Cilantro',1624,array['beans','cheese','onion','cilantro']::text[],array['guacamole','sour-cream']::text[],null),
  ('1169941272','Carne Asada Nachos with Sour Cream',1799,array['guacamole','cheese','sour-cream']::text[],array[]::text[],null),
  ('198880556','Carne Asada Quesadilla',1399,array['guacamole','pico','lettuce']::text[],array[]::text[],null),
  ('5336575300','Carnitas Quesadilla',1399,array['guacamole','pico','lettuce']::text[],array[]::text[],null),
  ('198880551','Cheese Quesadilla',625,array[]::text[],array[]::text[],null),
  ('198880553','Chicken Quesadilla',1399,array['guacamole','pico','lettuce']::text[],array[]::text[],null),
  ('6917687049','Chile Verde Nachos',1399,array['guacamole','cheese','sour-cream']::text[],array[]::text[],null),
  ('198880559','Chips and Guacamole',799,array[]::text[],array[]::text[],null),
  ('32960992457','Chips and Guacamole No Cheese',699,array[]::text[],array[]::text[],null),
  ('198880561','Chips and Salsa',499,array[]::text[],array[]::text[],null),
  ('198880557','French Fries',325,array[]::text[],array[]::text[],null),
  ('198880562','Half-Order Carne Asada Chips',1699,array['guacamole','cheese']::text[],array['sour-cream']::text[],null),
  ('198880563','Half-Order Carne Asada Fries',1699,array['guacamole','cheese']::text[],array['sour-cream']::text[],null),
  ('759912532','Half-Order Carne Asada Fries with Sour Cream',1799,array['guacamole','cheese','sour-cream']::text[],array[]::text[],null),
  ('2222103720','Large Chicken Nachos',1689,array['guacamole','cheese']::text[],array['sour-cream']::text[],null),
  ('5347103892','Large Ground Beef Fries with Rice, Cheese, and Sour Cream',1525,array['rice','cheese','sour-cream']::text[],array['guacamole']::text[],null),
  ('27634029237','Large Veggie Fries',1199,array['guacamole','cheese','sour-cream','pico','lettuce']::text[],array[]::text[],null),
  ('5613241909','Quesabirria',1499,array['onion','cilantro']::text[],array[]::text[],null),
  ('44177153501','Shredded Beef Nachos Bell Peppers Onion',1599,array['guacamole','cheese','onion','bell-peppers']::text[],array['sour-cream']::text[],null),
  ('198880552','Shrimp Quesadilla',1378,array['cabbage','lettuce']::text[],array[]::text[],null),
  ('358347767','Small Surf and Turf Fries',1699,array['guacamole','cheese','sour-cream']::text[],array[]::text[],null),
  ('27631629582','Small Veggie Fries',999,array['guacamole','cheese','sour-cream','pico','lettuce']::text[],array[]::text[],null),
  ('759911924','Super Nachos',1999,array['beans','guacamole','cheese','sour-cream','pico']::text[],array[]::text[],null),
  ('5337571594','Super Rolled Tacos',1399,array['guacamole','cheese','sour-cream','pico','lettuce']::text[],array[]::text[],'rolled-taco-chicken-or-beef'),
  ('358347340','Surf and Turf Fries',1899,array['guacamole','cheese','sour-cream']::text[],array[]::text[],null),
  ('3871320158','Surf and Turf Quesadilla',1499,array['guacamole','sour-cream','pico']::text[],array[]::text[],null),
  ('4921379008','Trio Fries with Shrimp, Chicken, and Carne Asada',1999,array['guacamole','cheese','sour-cream']::text[],array[]::text[],null),
  ('9830707325','Two Chiles Rellenos A la Carte',999,array['guacamole','sour-cream','pico','lettuce']::text[],array[]::text[],null);

do $$
declare tenant uuid; menu uuid; remove_group uuid; extras_group uuid;
begin
  if current_setting('menu_man.seed_environment',true) is distinct from 'staging' then raise exception 'Armando customization seed is staging only'; end if;
  select id into strict tenant from public.restaurants where slug='armandos' and is_active;
  if tenant <> '3d87585a-ff4b-4ae1-bef6-4e1e559cb04f'::uuid then raise exception 'Wrong Armando staging tenant'; end if;
  select id into strict menu from public.menus where restaurant_id=tenant and name='Main Menu' and is_published;
  if (select count(*) from armando_fries_sides_plan)<>42 then raise exception 'Plan must contain exactly 42 placements'; end if;
  if exists(select 1 from armando_fries_sides_plan plan left join public.menu_items item on item.restaurant_id=tenant and item.source_system='doordash' and item.source_item_id=plan.source_item_id left join public.menu_section_items placement on placement.item_id=item.id left join public.menu_sections section on section.id=placement.section_id and section.menu_id=menu where item.id is null or item.name<>plan.item_name or item.price_cents<>plan.expected_price_cents or not item.is_orderable or section.name is distinct from 'Carne Asada Fries, Nachos, Quesadillas & Sides' group by plan.source_item_id having count(item.id)<>1 or count(section.id)<>1) then raise exception 'Live source identity, section, price, ownership, or orderability mismatch'; end if;
  if (select count(*) from public.menu_items item join public.menu_section_items placement on placement.item_id=item.id join public.menu_sections section on section.id=placement.section_id where item.restaurant_id=tenant and item.source_system='doordash' and section.menu_id=menu and section.name='Carne Asada Fries, Nachos, Quesadillas & Sides')<>42 then raise exception 'Live target section no longer has 42 placements'; end if;
  if exists(select 1 from public.menu_items item join public.menu_section_items placement on placement.item_id=item.id join public.menu_sections section on section.id=placement.section_id where item.restaurant_id=tenant and item.source_system='doordash' and section.menu_id=menu and section.name='Carne Asada Fries, Nachos, Quesadillas & Sides' and not exists(select 1 from armando_fries_sides_plan plan where plan.source_item_id=item.source_item_id)) then raise exception 'Unplanned source item appeared in target section'; end if;
  select id into strict remove_group from public.modifier_groups where restaurant_id=tenant and name='Remove ingredients' and source_system='menu-man-demo' and source_group_id='remove-ingredients' and is_active;
  select id into strict extras_group from public.modifier_groups where restaurant_id=tenant and name='Add extras' and is_active;
  if (select count(*) from public.modifier_groups where restaurant_id=tenant and name='Add extras' and is_active)<>1 then raise exception 'Expected one existing Armando Add extras group'; end if;
  if (select count(*) from public.modifier_options where restaurant_id=tenant and modifier_group_id=remove_group and is_active)<>14 or exists(select 1 from public.modifier_options where restaurant_id=tenant and modifier_group_id=remove_group and is_active and (default_price_adjustment_cents<>0 or is_default)) then raise exception 'Remove ingredients options must remain zero-price and non-default'; end if;
  if (select count(*) from public.modifier_options where restaurant_id=tenant and modifier_group_id=extras_group and is_active)<>3 or not exists(select 1 from public.modifier_options where restaurant_id=tenant and modifier_group_id=extras_group and name='Guacamole' and is_active and default_price_adjustment_cents=150) or not exists(select 1 from public.modifier_options where restaurant_id=tenant and modifier_group_id=extras_group and name='Sour Cream' and is_active and default_price_adjustment_cents=75) or not exists(select 1 from public.modifier_options where restaurant_id=tenant and modifier_group_id=extras_group and name='Cheese' and is_active and default_price_adjustment_cents=100) then raise exception 'Armando Add extras options/prices changed'; end if;
  if exists(select 1 from public.modifier_groups where restaurant_id=tenant and source_system='menu-man-demo' and source_group_id='rolled-taco-chicken-or-beef' and (name<>'Choose chicken or beef' or not is_active)) or (select count(*) from public.modifier_groups where restaurant_id=tenant and source_system='menu-man-demo' and source_group_id='rolled-taco-chicken-or-beef')>1 then raise exception 'Rolled taco choice group identity conflict'; end if;
  if exists(select 1 from public.menu_item_modifier_groups attachment join public.menu_items item on item.id=attachment.menu_item_id join public.modifier_groups group_row on group_row.id=attachment.modifier_group_id where attachment.restaurant_id=tenant and item.source_system='doordash' and exists(select 1 from armando_fries_sides_plan plan where plan.source_item_id=item.source_item_id) and attachment.is_active and group_row.name not in ('Remove ingredients','Add extras','Choose chicken or beef')) then raise exception 'Unexpected existing active modifier group on target item'; end if;
end $$;

insert into public.modifier_groups(restaurant_id,name,description,source_system,source_group_id,is_active)
values('3d87585a-ff4b-4ae1-bef6-4e1e559cb04f','Choose chicken or beef','Choose one filling for all four rolled tacos.','menu-man-demo','rolled-taco-chicken-or-beef',true)
on conflict(restaurant_id,source_system,source_group_id) where source_system is not null and source_group_id is not null
do update set name=excluded.name,description=excluded.description,is_active=true;

insert into public.modifier_options(restaurant_id,modifier_group_id,name,default_price_adjustment_cents,sort_order,source_system,source_option_id,is_default,is_active)
select '3d87585a-ff4b-4ae1-bef6-4e1e559cb04f',group_row.id,choice.name,0,choice.sort_order,'menu-man-demo',choice.option_id,false,true
from public.modifier_groups group_row cross join (values ('chicken','Chicken',0),('beef','Beef',1)) choice(option_id,name,sort_order)
where group_row.restaurant_id='3d87585a-ff4b-4ae1-bef6-4e1e559cb04f' and group_row.source_system='menu-man-demo' and group_row.source_group_id='rolled-taco-chicken-or-beef'
on conflict(modifier_group_id,source_system,source_option_id) where source_system is not null and source_option_id is not null
do update set name=excluded.name,default_price_adjustment_cents=0,sort_order=excluded.sort_order,is_default=false,is_active=true;

do $$
declare tenant uuid:='3d87585a-ff4b-4ae1-bef6-4e1e559cb04f'; remove_group uuid; extras_group uuid; rolled_group uuid; rolled_item uuid;
begin
  select id into strict remove_group from public.modifier_groups where restaurant_id=tenant and source_system='menu-man-demo' and source_group_id='remove-ingredients' and is_active;
  select id into strict extras_group from public.modifier_groups where restaurant_id=tenant and name='Add extras' and is_active;
  select id into strict rolled_group from public.modifier_groups where restaurant_id=tenant and source_system='menu-man-demo' and source_group_id='rolled-taco-chicken-or-beef' and is_active;
  select id into strict rolled_item from public.menu_items where restaurant_id=tenant and source_system='doordash' and source_item_id='5337571594' and name='Super Rolled Tacos' and is_orderable;

  insert into public.menu_item_modifier_groups(restaurant_id,menu_item_id,modifier_group_id,min_selections,max_selections,sort_order,is_active)
  select tenant,item.id,remove_group,0,14,0,true from armando_fries_sides_plan plan join public.menu_items item on item.restaurant_id=tenant and item.source_system='doordash' and item.source_item_id=plan.source_item_id where cardinality(plan.removal_option_ids)>0
  on conflict(menu_item_id,modifier_group_id) do update set restaurant_id=excluded.restaurant_id,min_selections=0,max_selections=14,sort_order=0,is_active=true;
  insert into public.menu_item_modifier_groups(restaurant_id,menu_item_id,modifier_group_id,min_selections,max_selections,sort_order,is_active)
  select tenant,item.id,extras_group,0,3,1,true from armando_fries_sides_plan plan join public.menu_items item on item.restaurant_id=tenant and item.source_system='doordash' and item.source_item_id=plan.source_item_id where cardinality(plan.add_option_ids)>0
  on conflict(menu_item_id,modifier_group_id) do update set restaurant_id=excluded.restaurant_id,min_selections=0,max_selections=3,sort_order=1,is_active=true;
  insert into public.menu_item_modifier_groups(restaurant_id,menu_item_id,modifier_group_id,min_selections,max_selections,sort_order,is_active)
  values(tenant,rolled_item,rolled_group,1,1,2,true)
  on conflict(menu_item_id,modifier_group_id) do update set restaurant_id=excluded.restaurant_id,min_selections=1,max_selections=1,sort_order=2,is_active=true;

  insert into public.menu_item_modifier_option_overrides(restaurant_id,menu_item_id,modifier_group_id,modifier_option_id,price_adjustment_cents,sort_order,is_active)
  select tenant,item.id,remove_group,option.id,null,null,(option.source_option_id=any(plan.removal_option_ids)) from armando_fries_sides_plan plan join public.menu_items item on item.restaurant_id=tenant and item.source_system='doordash' and item.source_item_id=plan.source_item_id join public.menu_item_modifier_groups attachment on attachment.restaurant_id=tenant and attachment.menu_item_id=item.id and attachment.modifier_group_id=remove_group and attachment.is_active join public.modifier_options option on option.restaurant_id=tenant and option.modifier_group_id=remove_group
  on conflict(menu_item_id,modifier_option_id) do update set restaurant_id=excluded.restaurant_id,modifier_group_id=excluded.modifier_group_id,price_adjustment_cents=null,sort_order=null,is_active=excluded.is_active;
  insert into public.menu_item_modifier_option_overrides(restaurant_id,menu_item_id,modifier_group_id,modifier_option_id,price_adjustment_cents,sort_order,is_active)
  select tenant,item.id,extras_group,option.id,null,null,(option.source_option_id=any(plan.add_option_ids)) from armando_fries_sides_plan plan join public.menu_items item on item.restaurant_id=tenant and item.source_system='doordash' and item.source_item_id=plan.source_item_id join public.menu_item_modifier_groups attachment on attachment.restaurant_id=tenant and attachment.menu_item_id=item.id and attachment.modifier_group_id=extras_group and attachment.is_active join public.modifier_options option on option.restaurant_id=tenant and option.modifier_group_id=extras_group
  on conflict(menu_item_id,modifier_option_id) do update set restaurant_id=excluded.restaurant_id,modifier_group_id=excluded.modifier_group_id,price_adjustment_cents=null,sort_order=null,is_active=excluded.is_active;

  if exists(select 1 from armando_fries_sides_plan plan join public.menu_items item on item.restaurant_id=tenant and item.source_system='doordash' and item.source_item_id=plan.source_item_id join public.menu_item_modifier_groups attachment on attachment.restaurant_id=tenant and attachment.menu_item_id=item.id and attachment.is_active join public.modifier_groups group_row on group_row.id=attachment.modifier_group_id and group_row.restaurant_id=tenant where group_row.id not in(remove_group,extras_group) and not(item.source_item_id='5337571594' and group_row.id=rolled_group)) then raise exception 'Unexpected active group attached in target section'; end if;
  if exists(select 1 from armando_fries_sides_plan plan join public.menu_items item on item.restaurant_id=tenant and item.source_system='doordash' and item.source_item_id=plan.source_item_id join public.menu_item_modifier_groups attachment on attachment.restaurant_id=tenant and attachment.menu_item_id=item.id and attachment.modifier_group_id=remove_group and attachment.is_active join public.modifier_options option on option.restaurant_id=tenant and option.modifier_group_id=remove_group left join public.menu_item_modifier_option_overrides override on override.restaurant_id=tenant and override.menu_item_id=item.id and override.modifier_option_id=option.id where coalesce(override.is_active,true) is distinct from(option.source_option_id=any(plan.removal_option_ids))) then raise exception 'Removal options do not match the item copy'; end if;
  if exists(select 1 from armando_fries_sides_plan plan join public.menu_items item on item.restaurant_id=tenant and item.source_system='doordash' and item.source_item_id=plan.source_item_id join public.menu_item_modifier_groups attachment on attachment.restaurant_id=tenant and attachment.menu_item_id=item.id and attachment.modifier_group_id=extras_group and attachment.is_active join public.modifier_options option on option.restaurant_id=tenant and option.modifier_group_id=extras_group left join public.menu_item_modifier_option_overrides override on override.restaurant_id=tenant and override.menu_item_id=item.id and override.modifier_option_id=option.id where coalesce(override.is_active,true) is distinct from(option.source_option_id=any(plan.add_option_ids))) then raise exception 'Paid extra options do not match the item plan'; end if;
  if exists(select 1 from armando_fries_sides_plan plan join public.menu_items item on item.restaurant_id=tenant and item.source_system='doordash' and item.source_item_id=plan.source_item_id where item.is_orderable is distinct from true or item.price_cents<>plan.expected_price_cents) then raise exception 'Target orderability or base prices changed'; end if;
  if exists(select 1 from armando_fries_sides_plan plan join public.menu_items item on item.restaurant_id=tenant and item.source_system='doordash' and item.source_item_id=plan.source_item_id join public.menu_item_modifier_groups attachment on attachment.restaurant_id=tenant and attachment.menu_item_id=item.id and attachment.modifier_group_id=remove_group and attachment.is_active where cardinality(plan.removal_option_ids)=0) then raise exception 'An intentionally base-only item received removals'; end if;
  if (select count(*) from armando_fries_sides_plan where cardinality(removal_option_ids)>0)<>37 or (select count(*) from armando_fries_sides_plan where cardinality(add_option_ids)>0)<>14 then raise exception 'Planned modifier totals changed'; end if;
  if (select count(*) from public.menu_item_modifier_groups attachment join armando_fries_sides_plan plan on true join public.menu_items item on item.id=attachment.menu_item_id and item.source_system='doordash' and item.source_item_id=plan.source_item_id where attachment.restaurant_id=tenant and attachment.modifier_group_id=remove_group and attachment.is_active)<>37 then raise exception 'Unexpected removal attachment count'; end if;
  if (select count(*) from public.menu_item_modifier_groups attachment join armando_fries_sides_plan plan on true join public.menu_items item on item.id=attachment.menu_item_id and item.source_system='doordash' and item.source_item_id=plan.source_item_id where attachment.restaurant_id=tenant and attachment.modifier_group_id=extras_group and attachment.is_active)<>14 then raise exception 'Unexpected extras attachment count'; end if;
  if (select count(*) from public.menu_item_modifier_groups where restaurant_id=tenant and menu_item_id=rolled_item and modifier_group_id=rolled_group and is_active and min_selections=1 and max_selections=1)<>1 or (select count(*) from public.modifier_options where restaurant_id=tenant and modifier_group_id=rolled_group and is_active and default_price_adjustment_cents=0 and not is_default)<>2 then raise exception 'Rolled taco required choice has no valid option path'; end if;
  if exists(select 1 from public.menu_items item join public.menu_item_modifier_groups attachment on attachment.menu_item_id=item.id and attachment.restaurant_id=item.restaurant_id and attachment.is_active and attachment.min_selections>0 where item.restaurant_id=tenant and item.is_orderable and not exists(select 1 from public.modifier_options option left join public.menu_item_modifier_option_overrides override on override.restaurant_id=tenant and override.menu_item_id=item.id and override.modifier_option_id=option.id where option.restaurant_id=tenant and option.modifier_group_id=attachment.modifier_group_id and option.is_active and coalesce(override.is_active,true))) then raise exception 'Orderable item has required group with no active option path'; end if;
  if (select count(*) from public.menu_items where restaurant_id=tenant and is_orderable)<>307 then raise exception 'Whole menu must remain at 307 orderable items'; end if;
  if (select count(*) from public.menu_items item join public.menu_section_items placement on placement.item_id=item.id join public.menu_sections section on section.id=placement.section_id where item.restaurant_id=tenant and item.source_system='doordash' and section.menu_id=(select id from public.menus where restaurant_id=tenant and name='Main Menu' and is_published) and section.name='Street Tacos' and item.source_item_id in ('359794279','359796582') and not item.is_orderable)<>2 then raise exception '20-taco holds must remain'; end if;
end $$;

select 'Armando fries, nachos, quesadillas, and sides batch 3 applied' result,count(*) target_items,count(*) filter(where cardinality(removal_option_ids)>0) with_removals,count(*) filter(where cardinality(add_option_ids)>0) with_paid_extras from armando_fries_sides_plan;
commit;
