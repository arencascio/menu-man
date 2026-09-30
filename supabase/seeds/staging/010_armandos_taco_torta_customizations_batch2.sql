-- Armando's provisional taco/torta customization batch 2. Tenant-owned staging data only; safe to replay.
begin;
select pg_catalog.set_config('menu_man.seed_environment','staging',true);

create temporary table armando_taco_torta_plan (
  source_item_id text primary key,
  item_name text not null,
  section_name text not null,
  expected_price_cents integer not null,
  removal_option_ids text[] not null,
  add_option_ids text[] not null
) on commit drop;

insert into armando_taco_torta_plan values
  ('44177153503','5 Carnitas Street Tacos Special','Street Tacos',1199,array['onion','cilantro']::text[],array['guacamole','sour-cream','cheese']::text[]),
  ('769016784','10 Hard Shell Potato Tacos with Lettuce and Cheese','Street Tacos',2299,array['lettuce','cheese']::text[],array['guacamole','sour-cream']::text[]),
  ('198880534','Adobada Mini Taco','Street Tacos',350,array['onion','cilantro']::text[],array['guacamole','sour-cream','cheese']::text[]),
  ('198880535','Cabeza Mini Taco','Street Tacos',350,array['onion','cilantro']::text[],array['guacamole','sour-cream','cheese']::text[]),
  ('198880530','Carne Asada Mini Taco','Street Tacos',350,array['onion','cilantro']::text[],array['guacamole','sour-cream','cheese']::text[]),
  ('198880532','Carnitas Mini Taco','Street Tacos',350,array['onion','cilantro']::text[],array['guacamole','sour-cream','cheese']::text[]),
  ('198880536','Ceviche Tostada','Street Tacos',1025,array['onion','cilantro','avocado']::text[],array[]::text[]),
  ('198880533','Pollo Asado Mini Taco','Street Tacos',350,array['onion','cilantro']::text[],array['guacamole','sour-cream','cheese']::text[]),
  ('7995395228','5 Carne Asada Street Tacos Special','Street Tacos',1299,array['onion','cilantro']::text[],array['guacamole','sour-cream','cheese']::text[]),
  ('11651480977','3 Fish Tacos Special','Tacos',1256,array['cabbage']::text[],array[]::text[]),
  ('17056986048','3 Quesabirria Tacos with Consome (8oz)','Tacos',1067,array['cheese','onion','cilantro']::text[],array[]::text[]),
  ('198880593','Adobada Taco','Tacos',422,array['guacamole','onion','cilantro']::text[],array['sour-cream','cheese']::text[]),
  ('198880594','Beef Taco','Tacos',399,array['lettuce','cheese']::text[],array['guacamole','sour-cream']::text[]),
  ('8139021260','Birria Taco Salad','Tacos',1199,array['rice','sour-cream','avocado','cheese','lettuce','pico']::text[],array[]::text[]),
  ('198880597','Cabeza Taco','Tacos',424,array['onion','cilantro']::text[],array['guacamole','sour-cream','cheese']::text[]),
  ('198880589','Carne Asada Taco','Tacos',499,array['guacamole','pico','onion','cilantro']::text[],array['sour-cream','cheese']::text[]),
  ('198880609','Carne Asada Taco Salad','Tacos',967,array['avocado','sour-cream','cheese','pico','rice','lettuce']::text[],array[]::text[]),
  ('198880592','Carnitas Taco','Tacos',422,array['avocado','onion','cilantro']::text[],array['sour-cream','cheese']::text[]),
  ('8139021259','Carnitas Taco Salad','Tacos',1075,array['avocado','sour-cream','cheese','pico','rice','lettuce']::text[],array[]::text[]),
  ('564140620','Chicken Taco Salad','Tacos',1025,array['avocado','sour-cream','cheese','pico','rice','lettuce']::text[],array[]::text[]),
  ('564140375','Del Mar Taco Salad Shrimp and Crab Meat','Tacos',1099,array['sour-cream','cheese','rice','lettuce']::text[],array[]::text[]),
  ('198880595','Fish Taco','Tacos',387,array['cabbage','cilantro']::text[],array[]::text[]),
  ('198880603','Ground Beef Taco','Tacos',325,array['sour-cream','cheese','lettuce']::text[],array['guacamole']::text[]),
  ('198880590','Pollo Asado Taco','Tacos',422,array['guacamole','onion','cilantro']::text[],array['sour-cream','cheese']::text[]),
  ('198880605','Potato Taco','Tacos',245,array[]::text[],array[]::text[]),
  ('7176579097','Quesabirria Taco','Tacos',420,array['cheese','onion','cilantro']::text[],array[]::text[]),
  ('359798143','Shredded Chicken Taco','Tacos',299,array['cheese','lettuce']::text[],array['guacamole','sour-cream']::text[]),
  ('198880596','Shrimp Taco','Tacos',450,array['cabbage','cilantro']::text[],array[]::text[]),
  ('28128242562','Shrimp Taco Salad','Tacos',1399,array['cheese','pico','avocado']::text[],array[]::text[]),
  ('7172256177','Birria Taco','Tacos',415,array['onion','cilantro']::text[],array['guacamole','sour-cream','cheese']::text[]),
  ('198880604','Del Mar Taco','Tacos',415,array['rice','cabbage','pico','sour-cream']::text[],array[]::text[]),
  ('198880682','Shredded Chicken Taco','Tacos',345,array['lettuce','cheese']::text[],array['guacamole','sour-cream']::text[]),
  ('198880582','Adobada Torta','Tortas',1299,array['guacamole','pico','lettuce']::text[],array['sour-cream','cheese']::text[]),
  ('198880580','Asada Torta','Tortas',1276,array['guacamole','pico','lettuce']::text[],array['sour-cream','cheese']::text[]),
  ('198880586','Beef Torta','Tortas',999,array['guacamole','onion','bell-peppers','lettuce']::text[],array['sour-cream','cheese']::text[]),
  ('3736422304','Birria Torta','Tortas',1299,array['rice','beans','onion','cilantro']::text[],array['guacamole','sour-cream','cheese']::text[]),
  ('198880583','Carnitas Torta','Tortas',1299,array['guacamole','pico','lettuce']::text[],array['sour-cream','cheese']::text[]),
  ('198880584','Chorizo Torta','Tortas',1199,array['guacamole','pico','lettuce']::text[],array['sour-cream','cheese']::text[]),
  ('198880588','Ham Torta','Tortas',967,array['avocado','lettuce']::text[],array['sour-cream','cheese']::text[]),
  ('198880585','Machaca Torta','Tortas',1099,array['guacamole','bell-peppers','onion','lettuce']::text[],array['sour-cream','cheese']::text[]),
  ('198880581','Pollo Asado Torta','Tortas',1299,array['guacamole','pico','lettuce']::text[],array['sour-cream','cheese']::text[]),
  ('445069647','Torta with Fries','Tortas',1167,array['fries']::text[],array[]::text[]),
  ('198880540','Adobada Sope','Sopes',499,array['beans','lettuce','cheese']::text[],array['guacamole','sour-cream']::text[]),
  ('198880537','Asada Sope','Sopes',499,array['beans','lettuce','cheese']::text[],array['guacamole','sour-cream']::text[]),
  ('198880541','Beef Sope','Sopes',499,array['beans','lettuce','cheese','sour-cream']::text[],array['guacamole']::text[]),
  ('6416075485','Birria Sope','Sopes',499,array['beans','lettuce','cheese']::text[],array['guacamole','sour-cream']::text[]),
  ('564138398','Cabeza Sope','Sopes',499,array['beans','lettuce','cheese']::text[],array['guacamole','sour-cream']::text[]),
  ('198880542','Carnitas Sope','Sopes',499,array['beans','lettuce','cheese']::text[],array['guacamole','sour-cream']::text[]),
  ('198880539','Pollo Sope','Sopes',499,array['beans','lettuce','cheese']::text[],array['guacamole','sour-cream']::text[]),
  ('564138455','Veggie Sope','Sopes',410,array['beans','lettuce','cheese']::text[],array['guacamole','sour-cream']::text[]),
  ('198880574','Bean Tostada','Tostadas',567,array['beans','lettuce','cheese']::text[],array['guacamole','sour-cream']::text[]),
  ('198880573','Beef Tostada','Tostadas',600,array['beans','lettuce','cheese']::text[],array['guacamole','sour-cream']::text[]),
  ('198880570','Carne Asada Tostada','Tostadas',699,array['beans','lettuce','cheese']::text[],array['guacamole','sour-cream']::text[]),
  ('3827669440','Carnitas Tostada','Tostadas',699,array['beans','lettuce','cheese']::text[],array['guacamole','sour-cream']::text[]),
  ('198880572','Chicken Tostada','Tostadas',699,array['beans','lettuce','cheese']::text[],array['guacamole','sour-cream']::text[]),
  ('22783650559','Lengua Tostada','Tostadas',899,array['beans','lettuce','cheese']::text[],array['guacamole','sour-cream']::text[]),
  ('6929631873','Al Pastor Tostada','Tostadas',699,array['beans','lettuce','cheese']::text[],array['guacamole','sour-cream']::text[]);

do $$
declare
  tenant uuid;
  menu uuid;
  remove_group uuid;
  extras_group uuid;
  meat_group uuid;
begin
  if current_setting('menu_man.seed_environment',true) is distinct from 'staging' then
    raise exception 'Armando customization seed is staging only';
  end if;
  select id into strict tenant from public.restaurants where slug='armandos' and is_active;
  if tenant <> '3d87585a-ff4b-4ae1-bef6-4e1e559cb04f'::uuid then raise exception 'Wrong Armando staging tenant'; end if;
  select id into strict menu from public.menus where restaurant_id=tenant and name='Main Menu' and is_published;

  if (select count(*) from armando_taco_torta_plan) <> 57 then raise exception 'Plan must contain 57 orderable items'; end if;
  if exists(
    select 1 from armando_taco_torta_plan plan
    left join public.menu_items item on item.restaurant_id=tenant and item.source_system='doordash' and item.source_item_id=plan.source_item_id
    left join public.menu_section_items placement on placement.item_id=item.id
    left join public.menu_sections section on section.id=placement.section_id and section.menu_id=menu
    where item.id is null or item.name<>plan.item_name or item.price_cents<>plan.expected_price_cents or not item.is_orderable or section.name is distinct from plan.section_name
    group by plan.source_item_id having count(item.id)<>1 or count(section.id)<>1
  ) then raise exception 'Live item identity, section, price, or orderability mismatch'; end if;
  if (select count(*) from public.menu_items item join public.menu_section_items placement on placement.item_id=item.id join public.menu_sections section on section.id=placement.section_id where item.restaurant_id=tenant and item.source_system='doordash' and section.menu_id=menu and section.name in ('Street Tacos','Tacos','Tortas','Sopes','Tostadas')) <> 59 then
    raise exception 'Expected exactly 59 target placements';
  end if;
  if (select count(*) from public.menu_items item join public.menu_section_items placement on placement.item_id=item.id join public.menu_sections section on section.id=placement.section_id where item.restaurant_id=tenant and item.source_system='doordash' and section.menu_id=menu and section.name in ('Street Tacos','Tacos','Tortas','Sopes','Tostadas') and item.is_orderable) <> 57 then
    raise exception 'Expected 57 orderable items and two held party packs';
  end if;
  if (select count(*) from public.menu_items item join public.menu_section_items placement on placement.item_id=item.id join public.menu_sections section on section.id=placement.section_id where item.restaurant_id=tenant and item.source_system='doordash' and item.source_item_id in ('359794279','359796582') and item.name in ('Special Packet #1 - 20 Mini Tacos','Special Packet #2 - 20 Mini Tacos with Rice and Beans') and section.menu_id=menu and section.name='Street Tacos' and not item.is_orderable) <> 2 then
    raise exception 'Both 20-taco party packs must remain held';
  end if;
  if (select count(*) from public.modifier_groups where restaurant_id=tenant and name='Remove ingredients' and is_active) <> 1
     or (select count(*) from public.modifier_groups where restaurant_id=tenant and name='Add extras' and is_active) <> 1
     or (select count(*) from public.modifier_groups where restaurant_id=tenant and name='Choose your meat' and is_active) <> 1 then
    raise exception 'Expected existing Armando-owned groups';
  end if;
  select id into strict remove_group from public.modifier_groups where restaurant_id=tenant and name='Remove ingredients' and is_active;
  select id into strict extras_group from public.modifier_groups where restaurant_id=tenant and name='Add extras' and is_active;
  select id into strict meat_group from public.modifier_groups where restaurant_id=tenant and name='Choose your meat' and is_active;
  if (select count(*) from public.modifier_options where restaurant_id=tenant and modifier_group_id=remove_group and is_active) <> 14
     or exists(select 1 from public.modifier_options where restaurant_id=tenant and modifier_group_id=remove_group and is_active and (default_price_adjustment_cents<>0 or is_default)) then
    raise exception 'Removal options must remain zero-price and non-default';
  end if;
  if (select count(*) from public.modifier_options where restaurant_id=tenant and modifier_group_id=extras_group and is_active) <> 3
     or not exists(select 1 from public.modifier_options where restaurant_id=tenant and modifier_group_id=extras_group and name='Guacamole' and is_active and default_price_adjustment_cents=150)
     or not exists(select 1 from public.modifier_options where restaurant_id=tenant and modifier_group_id=extras_group and name='Sour Cream' and is_active and default_price_adjustment_cents=75)
     or not exists(select 1 from public.modifier_options where restaurant_id=tenant and modifier_group_id=extras_group and name='Cheese' and is_active and default_price_adjustment_cents=100) then
    raise exception 'Armando Add extras options/prices changed';
  end if;
  if not exists(select 1 from public.menu_items item join public.menu_section_items placement on placement.item_id=item.id join public.menu_sections section on section.id=placement.section_id join public.menu_item_modifier_groups attachment on attachment.menu_item_id=item.id join public.modifier_options option on option.restaurant_id=tenant and option.modifier_group_id=meat_group and option.is_active where item.restaurant_id=tenant and item.source_system='doordash' and item.source_item_id='445069647' and section.menu_id=menu and section.name='Tortas' and attachment.restaurant_id=tenant and attachment.modifier_group_id=meat_group and attachment.is_active and attachment.min_selections=1 and attachment.max_selections=1) then
    raise exception 'Torta with Fries existing required meat choice is missing';
  end if;
  if exists(select 1 from public.menu_item_modifier_groups attachment join public.menu_items item on item.id=attachment.menu_item_id where attachment.restaurant_id=tenant and item.source_system='doordash' and item.source_item_id='445069647' and attachment.is_active and attachment.modifier_group_id<>meat_group) then
    raise exception 'Unexpected prior active group on Torta with Fries';
  end if;
end $$;

do $$
declare tenant uuid:='3d87585a-ff4b-4ae1-bef6-4e1e559cb04f'; remove_group uuid; extras_group uuid;
begin
  select id into strict remove_group from public.modifier_groups where restaurant_id=tenant and name='Remove ingredients' and is_active;
  select id into strict extras_group from public.modifier_groups where restaurant_id=tenant and name='Add extras' and is_active;
  insert into public.menu_item_modifier_groups(restaurant_id,menu_item_id,modifier_group_id,min_selections,max_selections,sort_order,is_active)
  select tenant,item.id,remove_group,0,14,0,true from armando_taco_torta_plan plan join public.menu_items item on item.restaurant_id=tenant and item.source_system='doordash' and item.source_item_id=plan.source_item_id where cardinality(plan.removal_option_ids)>0
  on conflict(menu_item_id,modifier_group_id) do update set restaurant_id=excluded.restaurant_id,min_selections=0,max_selections=14,sort_order=0,is_active=true;
  insert into public.menu_item_modifier_groups(restaurant_id,menu_item_id,modifier_group_id,min_selections,max_selections,sort_order,is_active)
  select tenant,item.id,extras_group,0,3,1,true from armando_taco_torta_plan plan join public.menu_items item on item.restaurant_id=tenant and item.source_system='doordash' and item.source_item_id=plan.source_item_id where cardinality(plan.add_option_ids)>0
  on conflict(menu_item_id,modifier_group_id) do update set restaurant_id=excluded.restaurant_id,min_selections=0,max_selections=3,sort_order=1,is_active=true;
  insert into public.menu_item_modifier_option_overrides(restaurant_id,menu_item_id,modifier_group_id,modifier_option_id,price_adjustment_cents,sort_order,is_active)
  select tenant,item.id,remove_group,option.id,null,null,(option.source_option_id=any(plan.removal_option_ids)) from armando_taco_torta_plan plan join public.menu_items item on item.restaurant_id=tenant and item.source_system='doordash' and item.source_item_id=plan.source_item_id join public.menu_item_modifier_groups attachment on attachment.restaurant_id=tenant and attachment.menu_item_id=item.id and attachment.modifier_group_id=remove_group and attachment.is_active join public.modifier_options option on option.restaurant_id=tenant and option.modifier_group_id=remove_group
  on conflict(menu_item_id,modifier_option_id) do update set restaurant_id=excluded.restaurant_id,modifier_group_id=excluded.modifier_group_id,price_adjustment_cents=null,sort_order=null,is_active=excluded.is_active;
  insert into public.menu_item_modifier_option_overrides(restaurant_id,menu_item_id,modifier_group_id,modifier_option_id,price_adjustment_cents,sort_order,is_active)
  select tenant,item.id,extras_group,option.id,null,null,(option.source_option_id=any(plan.add_option_ids)) from armando_taco_torta_plan plan join public.menu_items item on item.restaurant_id=tenant and item.source_system='doordash' and item.source_item_id=plan.source_item_id join public.menu_item_modifier_groups attachment on attachment.restaurant_id=tenant and attachment.menu_item_id=item.id and attachment.modifier_group_id=extras_group and attachment.is_active join public.modifier_options option on option.restaurant_id=tenant and option.modifier_group_id=extras_group
  on conflict(menu_item_id,modifier_option_id) do update set restaurant_id=excluded.restaurant_id,modifier_group_id=excluded.modifier_group_id,price_adjustment_cents=null,sort_order=null,is_active=excluded.is_active;

  if exists(select 1 from armando_taco_torta_plan plan join public.menu_items item on item.restaurant_id=tenant and item.source_system='doordash' and item.source_item_id=plan.source_item_id join public.menu_item_modifier_groups attachment on attachment.restaurant_id=tenant and attachment.menu_item_id=item.id and attachment.is_active join public.modifier_groups grp on grp.id=attachment.modifier_group_id and grp.restaurant_id=tenant where grp.id not in(remove_group,extras_group) and not (item.source_item_id='445069647' and grp.name='Choose your meat')) then raise exception 'Unexpected active group in target sections'; end if;
  if exists(select 1 from armando_taco_torta_plan plan join public.menu_items item on item.restaurant_id=tenant and item.source_system='doordash' and item.source_item_id=plan.source_item_id left join public.menu_item_modifier_groups attachment on attachment.restaurant_id=tenant and attachment.menu_item_id=item.id and attachment.modifier_group_id=remove_group and attachment.is_active where cardinality(plan.removal_option_ids)>0 and attachment.menu_item_id is null) then raise exception 'Removal attachment missing'; end if;
  if exists(select 1 from armando_taco_torta_plan plan join public.menu_items item on item.restaurant_id=tenant and item.source_system='doordash' and item.source_item_id=plan.source_item_id left join public.menu_item_modifier_groups attachment on attachment.restaurant_id=tenant and attachment.menu_item_id=item.id and attachment.modifier_group_id=extras_group and attachment.is_active where cardinality(plan.add_option_ids)>0 and attachment.menu_item_id is null) then raise exception 'Extras attachment missing'; end if;
  if exists(select 1 from armando_taco_torta_plan plan join public.menu_items item on item.restaurant_id=tenant and item.source_system='doordash' and item.source_item_id=plan.source_item_id join public.menu_item_modifier_groups attachment on attachment.restaurant_id=tenant and attachment.menu_item_id=item.id and attachment.modifier_group_id=remove_group and attachment.is_active join public.modifier_options option on option.restaurant_id=tenant and option.modifier_group_id=remove_group left join public.menu_item_modifier_option_overrides override on override.restaurant_id=tenant and override.menu_item_id=item.id and override.modifier_option_id=option.id where coalesce(override.is_active,true) is distinct from (option.source_option_id=any(plan.removal_option_ids))) then raise exception 'Removal choices do not match item copy'; end if;
  if exists(select 1 from armando_taco_torta_plan plan join public.menu_items item on item.restaurant_id=tenant and item.source_system='doordash' and item.source_item_id=plan.source_item_id join public.menu_item_modifier_groups attachment on attachment.restaurant_id=tenant and attachment.menu_item_id=item.id and attachment.modifier_group_id=extras_group and attachment.is_active join public.modifier_options option on option.restaurant_id=tenant and option.modifier_group_id=extras_group left join public.menu_item_modifier_option_overrides override on override.restaurant_id=tenant and override.menu_item_id=item.id and override.modifier_option_id=option.id where coalesce(override.is_active,true) is distinct from (option.source_option_id=any(plan.add_option_ids))) then raise exception 'Add-on choices do not match item copy'; end if;
  if exists(select 1 from armando_taco_torta_plan plan join public.menu_items item on item.restaurant_id=tenant and item.source_system='doordash' and item.source_item_id=plan.source_item_id where item.is_orderable is distinct from true or item.price_cents<>plan.expected_price_cents) then raise exception 'Orderability or base price changed'; end if;
  if (select count(*) from armando_taco_torta_plan where cardinality(removal_option_ids)>0) <> 56
     or (select count(*) from armando_taco_torta_plan where cardinality(add_option_ids)>0) <> 42 then raise exception 'Customization plan counts differ'; end if;
  if (select count(*) from public.menu_item_modifier_groups attachment join armando_taco_torta_plan plan on true join public.menu_items item on item.id=attachment.menu_item_id and item.source_system='doordash' and item.source_item_id=plan.source_item_id where attachment.restaurant_id=tenant and attachment.modifier_group_id=remove_group and attachment.is_active) <> 56 then raise exception 'Unexpected removal attachment count'; end if;
  if (select count(*) from public.menu_item_modifier_groups attachment join armando_taco_torta_plan plan on true join public.menu_items item on item.id=attachment.menu_item_id and item.source_system='doordash' and item.source_item_id=plan.source_item_id where attachment.restaurant_id=tenant and attachment.modifier_group_id=extras_group and attachment.is_active) <> 42 then raise exception 'Unexpected extras attachment count'; end if;
  if (select count(*) from public.menu_items where restaurant_id=tenant and is_orderable) <> 307 then raise exception 'Whole-menu orderable count changed'; end if;
  if (select count(*) from public.menu_items item join public.menu_section_items placement on placement.item_id=item.id join public.menu_sections section on section.id=placement.section_id where item.restaurant_id=tenant and item.source_system='doordash' and item.source_item_id in ('359794279','359796582') and item.name in ('Special Packet #1 - 20 Mini Tacos','Special Packet #2 - 20 Mini Tacos with Rice and Beans') and section.menu_id=(select id from public.menus where restaurant_id=tenant and name='Main Menu' and is_published) and section.name='Street Tacos' and not item.is_orderable) <> 2 then raise exception 'Held party packs changed'; end if;
end $$;

select 'Armando taco and torta customization batch 2 applied' result, count(*) target_items, count(*) filter(where cardinality(removal_option_ids)>0) with_removals, count(*) filter(where cardinality(add_option_ids)>0) with_paid_extras from armando_taco_torta_plan;
commit;
