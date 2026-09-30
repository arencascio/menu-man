-- Armando's provisional Combination Plates customization batch 4. Tenant-owned staging data only; safe to replay.
begin;
select pg_catalog.set_config('menu_man.seed_environment','staging',true);

create temporary table armando_combination_plates_plan (
  source_item_id text primary key,
  item_name text not null,
  expected_price_cents integer not null,
  removal_option_ids text[] not null,
  add_option_ids text[] not null,
  required_group_name text,
  required_option_ids text[] not null
) on commit drop;

insert into armando_combination_plates_plan values
('5337696094','#23. Two Shredded Chicken Tacos',1399,array['cheese','lettuce','rice','beans']::text[],array['guacamole','sour-cream']::text[],null,array[]::text[]),
('198880491','#1. Tostada and Taco',1097,array['rice']::text[],array[]::text[],null,array[]::text[]),
('198880495','#2. Two Beef Tacos',1393,array['cheese','lettuce','rice','beans']::text[],array['guacamole','sour-cream']::text[],null,array[]::text[]),
('198880497','#3. Two Cheese Enchiladas',1393,array['lettuce','rice','beans']::text[],array[]::text[],null,array[]::text[]),
('198880499','#4. Bean Tostada and Cheese Enchilada',1199,array['lettuce','rice']::text[],array[]::text[],null,array[]::text[]),
('198880500','#5. Beef Taco and Cheese Enchilada',1399,array['rice','beans']::text[],array[]::text[],null,array[]::text[]),
('198880503','#6. Cheese Enchilada and Beef Burrito',1199,array['lettuce','rice','beans']::text[],array[]::text[],null,array[]::text[]),
('198880504','#7. Two Beef Burritos',1299,array['rice','beans']::text[],array[]::text[],null,array[]::text[]),
('198880505','#8. Two Tostadas – Choice of Meat',1076,array['cheese','lettuce','rice']::text[],array[]::text[],null,array[]::text[]),
('198880507','#9. Two Pollo Asado Tacos',1399,array['guacamole','onion','cilantro','rice','beans']::text[],array['sour-cream','cheese']::text[],null,array[]::text[]),
('198880508','#10. Two Chicken Enchiladas',1399,array['cheese','lettuce','rice','beans']::text[],array[]::text[],null,array[]::text[]),
('198880509','#11. Beef Taco and Beef Burrito',1399,array['rice','beans']::text[],array[]::text[],null,array[]::text[]),
('198880510','#12. Carne Asada Plate',1625,array['guacamole','pico','rice','beans']::text[],array[]::text[],null,array[]::text[]),
('198880511','#13. Machaca Plate',1399,array['rice','beans']::text[],array[]::text[],null,array[]::text[]),
('198880512','#14. Chorizo Plate',1399,array['rice','beans']::text[],array[]::text[],null,array[]::text[]),
('198880513','#15. Carnitas Plate',1376,array['guacamole','pico','lettuce','rice','beans']::text[],array[]::text[],null,array[]::text[]),
('198880514','#16. Two Carne Asada Tacos',1399,array['guacamole','onion','cilantro','rice','beans']::text[],array['sour-cream','cheese']::text[],null,array[]::text[]),
('198880515','#17. Two Chiles Rellenos Plate',1399,array['guacamole','sour-cream','pico','lettuce','rice','beans']::text[],array[]::text[],null,array[]::text[]),
('198880518','#18. Two Fish Tacos',1299,array['cabbage','cilantro','rice','beans']::text[],array[]::text[],null,array[]::text[]),
('198880519','#19. Pollo Asado Plate',1399,array['guacamole','pico','lettuce','rice','beans']::text[],array[]::text[],null,array[]::text[]),
('198880520','#20. Three Rolled Tacos',1090,array['guacamole','lettuce','rice','beans']::text[],array['sour-cream','cheese']::text[],null,array[]::text[]),
('7949242446','Adobada Plate with Rice and Beans',1399,array['guacamole','pico','lettuce','rice','beans']::text[],array[]::text[],null,array[]::text[]),
('376154181','Birria Combo',1476,array['onion','cilantro','rice','beans']::text[],array[]::text[],null,array[]::text[]),
('376154282','Birria Bowl',1499,array['onion','cilantro']::text[],array[]::text[],null,array[]::text[]),
('7995077785','Cabeza Plate with Rice and Beans',1499,array['guacamole','pico','lettuce','rice','beans']::text[],array[]::text[],null,array[]::text[]),
('198880521','Camarones a la Diabla',1699,array['avocado','rice','beans']::text[],array[]::text[],null,array[]::text[]),
('6912796879','Two Chicken Enchiladas with Green Sauce',1367,array['cheese','rice','beans']::text[],array[]::text[],null,array[]::text[]),
('10770381235','Chile Relleno and Cheese Enchilada Combo',1399,array['guacamole','sour-cream','lettuce','rice','beans']::text[],array[]::text[],null,array[]::text[]),
('7949201301','Chile Verde Plate with Rice and Beans',1399,array['rice','beans']::text[],array[]::text[],null,array[]::text[]),
('198880522','Enchiladas del Mar',1599,array['pico','sour-cream']::text[],array[]::text[],null,array[]::text[]),
('198880526','Flying Saucer',999,array[]::text[],array[]::text[],null,array[]::text[]),
('14833449100','Ranchera Plate',1799,array['avocado','lettuce','rice','beans']::text[],array[]::text[],null,array[]::text[]),
('5765626765','Two Chicken Enchiladas with Rice and Beans',1366,array['cheese','rice','beans']::text[],array[]::text[],null,array[]::text[]),
('8880117979','Two-Enchilada Combo – Chicken and Cheese',1376,array['rice','beans']::text[],array[]::text[],null,array[]::text[]),
('5732068679','Two Birria Tacos with Rice, Beans, and Consommé',1399,array['rice','beans']::text[],array[]::text[],null,array[]::text[]),
('6416059090','Two Birria Sopes Combo',1199,array['rice','beans']::text[],array[]::text[],null,array[]::text[]),
('1206365534','Two Sopes Combo – Choice of Meat',1199,array['rice','beans']::text[],array[]::text[],null,array[]::text[]),
('198880695','#21. Super Rolled Tacos',999,array['guacamole','cheese','sour-cream','pico','lettuce']::text[],array[]::text[],'Choose chicken or beef',array['chicken','beef']::text[]),
('198880697','#23. Two Shredded Chicken Tacos',1099,array['cheese','lettuce','rice','beans']::text[],array['guacamole','sour-cream']::text[],null,array[]::text[]),
('198880699','#24. Chicken Fajita Burrito',1199,array['rice','avocado','onion','bell-peppers']::text[],array[]::text[],'Choose your meat',array['chicken','carne-asada']::text[]);

do $$
declare tenant uuid; menu uuid; remove_group uuid; extras_group uuid; meat_group uuid; tortilla_group uuid; rolled_group uuid;
begin
  if current_setting('menu_man.seed_environment',true) is distinct from 'staging' then raise exception 'Armando batch 4 is staging only'; end if;
  select id into strict tenant from public.restaurants where slug='armandos' and is_active;
  if tenant<>'3d87585a-ff4b-4ae1-bef6-4e1e559cb04f'::uuid then raise exception 'Wrong Armando staging tenant'; end if;
  select id into strict menu from public.menus where restaurant_id=tenant and name='Main Menu' and is_published;
  if (select count(*) from armando_combination_plates_plan)<>40 then raise exception 'Plan must contain exactly 40 source items'; end if;
  if exists(select 1 from armando_combination_plates_plan plan left join public.menu_items item on item.restaurant_id=tenant and item.source_system='doordash' and item.source_item_id=plan.source_item_id left join public.menu_section_items placement on placement.item_id=item.id left join public.menu_sections section on section.id=placement.section_id and section.menu_id=menu and section.name='Combination Plates' where item.id is null or item.name<>plan.item_name or item.price_cents<>plan.expected_price_cents or item.is_orderable is distinct from true or section.id is null group by plan.source_item_id having count(item.id)<>1 or count(section.id)<>1) then raise exception 'Live item ID, ownership, name, price, placement, or orderability mismatch'; end if;
  if (select count(*) from public.menu_items item join public.menu_section_items p on p.item_id=item.id join public.menu_sections s on s.id=p.section_id where item.restaurant_id=tenant and item.source_system='doordash' and s.menu_id=menu and s.name='Combination Plates')<>40 then raise exception 'Combination Plates no longer has exactly 40 placements'; end if;
  if exists(select 1 from public.menu_items item join public.menu_section_items p on p.item_id=item.id join public.menu_sections s on s.id=p.section_id where item.restaurant_id=tenant and item.source_system='doordash' and s.menu_id=menu and s.name='Combination Plates' and not exists(select 1 from armando_combination_plates_plan plan where plan.source_item_id=item.source_item_id)) then raise exception 'Unplanned Combination Plates item found'; end if;

  select id into strict remove_group from public.modifier_groups where restaurant_id=tenant and source_system='menu-man-demo' and source_group_id='remove-ingredients' and name='Remove ingredients' and is_active;
  select id into strict extras_group from public.modifier_groups where restaurant_id=tenant and name='Add extras' and is_active;
  select id into strict meat_group from public.modifier_groups where restaurant_id=tenant and source_system='menu-man-test' and source_group_id='choose-meat' and name='Choose your meat' and is_active;
  select id into strict tortilla_group from public.modifier_groups where restaurant_id=tenant and name='Tortillas or Chips' and is_active;
  select id into strict rolled_group from public.modifier_groups where restaurant_id=tenant and source_system='menu-man-demo' and source_group_id='rolled-taco-chicken-or-beef' and name='Choose chicken or beef' and is_active;
  if (select count(*) from public.modifier_options where restaurant_id=tenant and modifier_group_id=remove_group and is_active)<>14 or exists(select 1 from public.modifier_options where restaurant_id=tenant and modifier_group_id=remove_group and is_active and (default_price_adjustment_cents<>0 or is_default)) then raise exception 'Remove ingredients options changed'; end if;
  if (select count(*) from public.modifier_options where restaurant_id=tenant and modifier_group_id=extras_group and is_active)<>3 or not exists(select 1 from public.modifier_options where restaurant_id=tenant and modifier_group_id=extras_group and source_option_id='guacamole' and is_active and default_price_adjustment_cents=150) or not exists(select 1 from public.modifier_options where restaurant_id=tenant and modifier_group_id=extras_group and source_option_id='sour-cream' and is_active and default_price_adjustment_cents=75) or not exists(select 1 from public.modifier_options where restaurant_id=tenant and modifier_group_id=extras_group and source_option_id='cheese' and is_active and default_price_adjustment_cents=100) then raise exception 'Add extras options/prices changed'; end if;
  if (select count(*) from public.modifier_options where restaurant_id=tenant and modifier_group_id=meat_group and is_active)<>4 or not exists(select 1 from public.modifier_options where restaurant_id=tenant and modifier_group_id=meat_group and source_option_id='chicken' and is_active and default_price_adjustment_cents=0) or not exists(select 1 from public.modifier_options where restaurant_id=tenant and modifier_group_id=meat_group and source_option_id='carne-asada' and is_active and default_price_adjustment_cents=0) then raise exception 'Choose your meat options changed'; end if;
  if (select count(*) from public.modifier_options where restaurant_id=tenant and modifier_group_id=tortilla_group and is_active)<>2 or (select count(*) from public.modifier_options where restaurant_id=tenant and modifier_group_id=rolled_group and is_active and default_price_adjustment_cents=0)<>2 then raise exception 'Tenant choice groups changed'; end if;

  if not exists(select 1 from public.menu_items i join public.menu_item_modifier_groups a on a.restaurant_id=tenant and a.menu_item_id=i.id and a.modifier_group_id=meat_group and a.is_active and a.min_selections=1 and a.max_selections=1 where i.restaurant_id=tenant and i.source_system='doordash' and i.source_item_id='198880505')
     or not exists(select 1 from public.menu_items i join public.menu_item_modifier_groups a on a.restaurant_id=tenant and a.menu_item_id=i.id and a.modifier_group_id=meat_group and a.is_active and a.min_selections=1 and a.max_selections=1 where i.restaurant_id=tenant and i.source_system='doordash' and i.source_item_id='1206365534')
     or not exists(select 1 from public.menu_items i join public.menu_item_modifier_groups a on a.restaurant_id=tenant and a.menu_item_id=i.id and a.modifier_group_id=tortilla_group and a.is_active and a.min_selections=1 and a.max_selections=1 where i.restaurant_id=tenant and i.source_system='doordash' and i.source_item_id in('198880510','198880513','198880519','7995077785') group by a.modifier_group_id having count(*)=4) then raise exception 'Existing required baseline groups were not preserved'; end if;
  if exists(select 1 from public.menu_items item join public.menu_section_items p on p.item_id=item.id join public.menu_sections s on s.id=p.section_id and s.menu_id=menu and s.name='Combination Plates' join public.menu_item_modifier_groups a on a.restaurant_id=tenant and a.menu_item_id=item.id and a.is_active join public.modifier_groups g on g.id=a.modifier_group_id where item.restaurant_id=tenant and g.name not in('Remove ingredients','Add extras','Choose your meat','Tortillas or Chips','Choose chicken or beef')) then raise exception 'Unexpected active group in Combination Plates'; end if;
end $$;

insert into public.menu_item_modifier_groups(restaurant_id,menu_item_id,modifier_group_id,min_selections,max_selections,sort_order,is_active)
select r.id,item.id,g.id,0,14,0,true
from armando_combination_plates_plan plan
join public.restaurants r on r.slug='armandos'
join public.menu_items item on item.restaurant_id=r.id and item.source_system='doordash' and item.source_item_id=plan.source_item_id
join public.modifier_groups g on g.restaurant_id=r.id and g.source_system='menu-man-demo' and g.source_group_id='remove-ingredients'
where cardinality(plan.removal_option_ids)>0
on conflict(menu_item_id,modifier_group_id) do update set min_selections=0,max_selections=14,sort_order=0,is_active=true;

insert into public.menu_item_modifier_groups(restaurant_id,menu_item_id,modifier_group_id,min_selections,max_selections,sort_order,is_active)
select r.id,item.id,g.id,0,3,1,true
from armando_combination_plates_plan plan join public.restaurants r on r.slug='armandos'
join public.menu_items item on item.restaurant_id=r.id and item.source_system='doordash' and item.source_item_id=plan.source_item_id
join public.modifier_groups g on g.restaurant_id=r.id and g.name='Add extras' and g.is_active
where cardinality(plan.add_option_ids)>0
on conflict(menu_item_id,modifier_group_id) do update set min_selections=0,max_selections=3,sort_order=1,is_active=true;

insert into public.menu_item_modifier_groups(restaurant_id,menu_item_id,modifier_group_id,min_selections,max_selections,sort_order,is_active)
select r.id,item.id,g.id,1,1,2,true
from armando_combination_plates_plan plan join public.restaurants r on r.slug='armandos'
join public.menu_items item on item.restaurant_id=r.id and item.source_system='doordash' and item.source_item_id=plan.source_item_id
join public.modifier_groups g on g.restaurant_id=r.id and g.name=plan.required_group_name and g.is_active
where plan.required_group_name is not null
on conflict(menu_item_id,modifier_group_id) do update set min_selections=1,max_selections=1,sort_order=2,is_active=true;

do $$
declare tenant uuid:='3d87585a-ff4b-4ae1-bef6-4e1e559cb04f'; remove_group uuid; extras_group uuid; meat_group uuid; rolled_group uuid;
begin
  select id into strict remove_group from public.modifier_groups where restaurant_id=tenant and source_system='menu-man-demo' and source_group_id='remove-ingredients';
  select id into strict extras_group from public.modifier_groups where restaurant_id=tenant and name='Add extras' and is_active;
  select id into strict meat_group from public.modifier_groups where restaurant_id=tenant and source_system='menu-man-test' and source_group_id='choose-meat';
  select id into strict rolled_group from public.modifier_groups where restaurant_id=tenant and source_system='menu-man-demo' and source_group_id='rolled-taco-chicken-or-beef';

  insert into public.menu_item_modifier_option_overrides(restaurant_id,menu_item_id,modifier_group_id,modifier_option_id,price_adjustment_cents,sort_order,is_active)
  select tenant,item.id,remove_group,o.id,null,null,(o.source_option_id=any(plan.removal_option_ids))
  from armando_combination_plates_plan plan join public.menu_items item on item.restaurant_id=tenant and item.source_system='doordash' and item.source_item_id=plan.source_item_id
  join public.menu_item_modifier_groups a on a.restaurant_id=tenant and a.menu_item_id=item.id and a.modifier_group_id=remove_group and a.is_active
  join public.modifier_options o on o.restaurant_id=tenant and o.modifier_group_id=remove_group
  where cardinality(plan.removal_option_ids)>0
  on conflict(menu_item_id,modifier_option_id) do update set modifier_group_id=excluded.modifier_group_id,price_adjustment_cents=null,sort_order=null,is_active=excluded.is_active;

  insert into public.menu_item_modifier_option_overrides(restaurant_id,menu_item_id,modifier_group_id,modifier_option_id,price_adjustment_cents,sort_order,is_active)
  select tenant,item.id,extras_group,o.id,null,null,(o.source_option_id=any(plan.add_option_ids))
  from armando_combination_plates_plan plan join public.menu_items item on item.restaurant_id=tenant and item.source_system='doordash' and item.source_item_id=plan.source_item_id
  join public.menu_item_modifier_groups a on a.restaurant_id=tenant and a.menu_item_id=item.id and a.modifier_group_id=extras_group and a.is_active
  join public.modifier_options o on o.restaurant_id=tenant and o.modifier_group_id=extras_group
  where cardinality(plan.add_option_ids)>0
  on conflict(menu_item_id,modifier_option_id) do update set modifier_group_id=excluded.modifier_group_id,price_adjustment_cents=null,sort_order=null,is_active=excluded.is_active;

  insert into public.menu_item_modifier_option_overrides(restaurant_id,menu_item_id,modifier_group_id,modifier_option_id,price_adjustment_cents,sort_order,is_active)
  select tenant,item.id,g.id,o.id,null,null,(o.source_option_id=any(plan.required_option_ids))
  from armando_combination_plates_plan plan join public.menu_items item on item.restaurant_id=tenant and item.source_system='doordash' and item.source_item_id=plan.source_item_id
  join public.modifier_groups g on g.restaurant_id=tenant and g.name=plan.required_group_name
  join public.modifier_options o on o.restaurant_id=tenant and o.modifier_group_id=g.id
  where plan.required_group_name is not null
  on conflict(menu_item_id,modifier_option_id) do update set modifier_group_id=excluded.modifier_group_id,price_adjustment_cents=null,sort_order=null,is_active=excluded.is_active;

  if exists(select 1 from armando_combination_plates_plan p join public.menu_items i on i.restaurant_id=tenant and i.source_system='doordash' and i.source_item_id=p.source_item_id join public.menu_item_modifier_groups a on a.restaurant_id=tenant and a.menu_item_id=i.id and a.is_active join public.modifier_groups g on g.restaurant_id=tenant and g.id=a.modifier_group_id where g.name not in('Remove ingredients','Add extras','Choose your meat','Tortillas or Chips','Choose chicken or beef')) then raise exception 'Unexpected modifier group attached'; end if;
  if exists(select 1 from armando_combination_plates_plan p join public.menu_items i on i.restaurant_id=tenant and i.source_system='doordash' and i.source_item_id=p.source_item_id join public.menu_item_modifier_groups a on a.restaurant_id=tenant and a.menu_item_id=i.id and a.modifier_group_id=remove_group and a.is_active join public.modifier_options o on o.restaurant_id=tenant and o.modifier_group_id=remove_group left join public.menu_item_modifier_option_overrides x on x.restaurant_id=tenant and x.menu_item_id=i.id and x.modifier_option_id=o.id where coalesce(x.is_active,true) is distinct from(o.source_option_id=any(p.removal_option_ids))) then raise exception 'Removal options differ from item plan'; end if;
  if exists(select 1 from armando_combination_plates_plan p join public.menu_items i on i.restaurant_id=tenant and i.source_system='doordash' and i.source_item_id=p.source_item_id join public.menu_item_modifier_groups a on a.restaurant_id=tenant and a.menu_item_id=i.id and a.modifier_group_id=extras_group and a.is_active join public.modifier_options o on o.restaurant_id=tenant and o.modifier_group_id=extras_group left join public.menu_item_modifier_option_overrides x on x.restaurant_id=tenant and x.menu_item_id=i.id and x.modifier_option_id=o.id where coalesce(x.is_active,true) is distinct from(o.source_option_id=any(p.add_option_ids))) then raise exception 'Paid extras differ from item plan'; end if;
  if exists(select 1 from armando_combination_plates_plan p join public.menu_items i on i.restaurant_id=tenant and i.source_system='doordash' and i.source_item_id=p.source_item_id where i.name<>p.item_name or i.price_cents<>p.expected_price_cents or not i.is_orderable) then raise exception 'Base item identity, price, or orderability changed'; end if;
  if (select count(*) from armando_combination_plates_plan where cardinality(removal_option_ids)>0)<>39 or (select count(*) from armando_combination_plates_plan where cardinality(add_option_ids)>0)<>6 or (select count(*) from armando_combination_plates_plan where cardinality(removal_option_ids)=0 and cardinality(add_option_ids)=0 and required_group_name is null)<>1 then raise exception 'Planned batch counts changed'; end if;
  if (select count(*) from public.menu_item_modifier_groups a join armando_combination_plates_plan p on cardinality(p.removal_option_ids)>0 join public.menu_items i on i.id=a.menu_item_id and i.source_item_id=p.source_item_id where a.restaurant_id=tenant and a.modifier_group_id=remove_group and a.is_active)<>39 then raise exception 'Removal attachment count mismatch'; end if;
  if (select count(*) from public.menu_item_modifier_groups a join armando_combination_plates_plan p on cardinality(p.add_option_ids)>0 join public.menu_items i on i.id=a.menu_item_id and i.source_item_id=p.source_item_id where a.restaurant_id=tenant and a.modifier_group_id=extras_group and a.is_active)<>6 then raise exception 'Extras attachment count mismatch'; end if;
  if exists(select 1 from armando_combination_plates_plan p join public.menu_items i on i.restaurant_id=tenant and i.source_system='doordash' and i.source_item_id=p.source_item_id join public.menu_item_modifier_groups a on a.restaurant_id=tenant and a.menu_item_id=i.id and a.is_active join public.modifier_groups g on g.id=a.modifier_group_id where g.name='Choose your meat' and p.source_item_id not in('198880505','1206365534','198880699')) then raise exception 'Fixed protein received meat choice'; end if;
  if exists(select 1 from armando_combination_plates_plan p join public.menu_items i on i.restaurant_id=tenant and i.source_system='doordash' and i.source_item_id=p.source_item_id join public.menu_item_modifier_groups a on a.restaurant_id=tenant and a.menu_item_id=i.id and a.is_active join public.modifier_groups g on g.id=a.modifier_group_id where g.source_group_id='rolled-taco-chicken-or-beef' and p.source_item_id<>'198880695') then raise exception 'Rolled taco choice leaked to another item'; end if;
  if (select count(*) from public.menu_item_modifier_groups a join public.menu_items i on i.id=a.menu_item_id where a.restaurant_id=tenant and a.menu_item_id=(select id from public.menu_items where restaurant_id=tenant and source_system='doordash' and source_item_id='198880699') and a.modifier_group_id=meat_group and a.is_active and a.min_selections=1 and a.max_selections=1)<>1
   or (select count(*) from public.modifier_options o left join public.menu_item_modifier_option_overrides x on x.restaurant_id=tenant and x.menu_item_id=(select id from public.menu_items where restaurant_id=tenant and source_system='doordash' and source_item_id='198880699') and x.modifier_option_id=o.id where o.restaurant_id=tenant and o.modifier_group_id=meat_group and o.is_active and coalesce(x.is_active,true))<>2 then raise exception 'Fajita burrito choice path invalid'; end if;
  if (select count(*) from public.menu_item_modifier_groups a where a.restaurant_id=tenant and a.menu_item_id=(select id from public.menu_items where restaurant_id=tenant and source_system='doordash' and source_item_id='198880695') and a.modifier_group_id=rolled_group and a.is_active and a.min_selections=1 and a.max_selections=1)<>1
   or (select count(*) from public.modifier_options o left join public.menu_item_modifier_option_overrides x on x.restaurant_id=tenant and x.menu_item_id=(select id from public.menu_items where restaurant_id=tenant and source_system='doordash' and source_item_id='198880695') and x.modifier_option_id=o.id where o.restaurant_id=tenant and o.modifier_group_id=rolled_group and o.is_active and coalesce(x.is_active,true))<>2 then raise exception 'Super rolled taco choice path invalid'; end if;
  if exists(select 1 from public.menu_items i join public.menu_item_modifier_groups a on a.restaurant_id=tenant and a.menu_item_id=i.id and a.is_active and a.min_selections>0 where i.restaurant_id=tenant and i.is_orderable and not exists(select 1 from public.modifier_options o left join public.menu_item_modifier_option_overrides x on x.restaurant_id=tenant and x.menu_item_id=i.id and x.modifier_option_id=o.id where o.restaurant_id=tenant and o.modifier_group_id=a.modifier_group_id and o.is_active and coalesce(x.is_active,true))) then raise exception 'An orderable item has an invalid required path'; end if;
  if (select count(*) from public.menu_items where restaurant_id=tenant and is_orderable)<>307 then raise exception 'Whole menu must remain at 307 orderable'; end if;
  if (select count(*) from public.menu_items i join public.menu_section_items p on p.item_id=i.id join public.menu_sections s on s.id=p.section_id where i.restaurant_id=tenant and i.source_system='doordash' and s.menu_id=(select id from public.menus where restaurant_id=tenant and name='Main Menu' and is_published) and s.name='Street Tacos' and i.source_item_id in('359794279','359796582') and not i.is_orderable)<>2 then raise exception 'Both held party packs must remain held'; end if;
end $$;

select 'Armando Combination Plates batch 4 applied' result,count(*) placements,count(*) filter(where cardinality(removal_option_ids)>0) removals,count(*) filter(where cardinality(add_option_ids)>0) paid_extras,count(*) filter(where required_group_name is not null) new_required_choices from armando_combination_plates_plan;
commit;

