-- Armando's provisional burrito customization batch 1. Tenant-owned staging data only; safe to replay.
begin;
select pg_catalog.set_config('menu_man.seed_environment','staging',true);
create temporary table armando_burrito_plan(source_item_id text primary key,item_name text not null,section_name text not null,expected_price_cents integer not null,removal_option_ids text[] not null,add_option_ids text[] not null) on commit drop;
insert into armando_burrito_plan values
  ('5333328467','Bacon and Sausage Burrito','Breakfast Burritos',1190,array['cheese','potatoes']::text[],array[]::text[]),
  ('1165791286','Chicken Breakfast Burrito','Breakfast Burritos',999,array['cheese','potatoes']::text[],array[]::text[]),
  ('198880674','Chorizo Burrito','Breakfast Burritos',1167,array['cheese']::text[],array[]::text[]),
  ('5772874081','Chorizo Burrito with Beans','Breakfast Burritos',1167,array['cheese','beans']::text[],array[]::text[]),
  ('1165788874','Chorizo Burrito with Potato','Breakfast Burritos',1199,array['cheese','potatoes']::text[],array[]::text[]),
  ('5333326965','Egg and Cheese Burrito','Breakfast Burritos',899,array['cheese']::text[],array[]::text[]),
  ('5334803698','Ham and Bacon Burrito','Breakfast Burritos',999,array['cheese','potatoes']::text[],array[]::text[]),
  ('198880676','Ham Burrito','Breakfast Burritos',1167,array['cheese','potatoes']::text[],array[]::text[]),
  ('5772977560','Ham, Egg, and Cheese Burrito','Breakfast Burritos',956,array['cheese']::text[],array[]::text[]),
  ('198880675','Machaca Burrito','Breakfast Burritos',1299,array['cheese','onion','bell-peppers']::text[],array[]::text[]),
  ('198880673','Original Breakfast Burrito','Breakfast Burritos',1199,array['cheese','potatoes']::text[],array[]::text[]),
  ('1165790039','Original Breakfast Burrito with Beans','Breakfast Burritos',1199,array['cheese','beans','potatoes']::text[],array[]::text[]),
  ('198880679','Sausage Burrito','Breakfast Burritos',1154,array['cheese','potatoes']::text[],array[]::text[]),
  ('5766331847','Sausage Burrito with Beans','Breakfast Burritos',1199,array['cheese','beans','potatoes']::text[],array[]::text[]),
  ('8476042131','Sausage, Chorizo, Egg, Cheese, and Potatoes Burrito','Breakfast Burritos',1199,array['cheese','potatoes']::text[],array[]::text[]),
  ('16994295879','Steak Breakfast Burrito with Beans','Breakfast Burritos',1299,array['cheese','beans']::text[],array[]::text[]),
  ('198880678','Steak Burrito','Breakfast Burritos',1299,array['cheese','potatoes']::text[],array[]::text[]),
  ('418346709','Super Breakfast Burrito','Breakfast Burritos',1300,array['cheese','potatoes']::text[],array[]::text[]),
  ('198880628','Adobada Burrito','Burritos',1399,array['guacamole','pico']::text[],array['sour-cream','cheese']::text[]),
  ('11825834217','Asada Burrito Combo','Burritos',1599,array['guacamole','pico','beans','rice']::text[],array['sour-cream','cheese']::text[]),
  ('759912295','Asada Burrito with Cheese','Burritos',1499,array['guacamole','pico','cheese']::text[],array['sour-cream']::text[]),
  ('2989351384','Asada Burrito with Cheese and Sour Cream','Burritos',1499,array['cheese','sour-cream']::text[],array['guacamole']::text[]),
  ('759912198','Asada Burrito with Sour Cream','Burritos',1456,array['guacamole','pico','sour-cream']::text[],array['cheese']::text[]),
  ('759911357','Asada Wet Burrito with Green Sauce','Burritos',1499,array['beans','rice']::text[],array['guacamole','sour-cream','cheese']::text[]),
  ('425682195','Asada Wet Burrito with Red Sauce','Burritos',1478,array['beans','rice']::text[],array['guacamole','sour-cream','cheese']::text[]),
  ('198880664','Beans and Cheese Burrito','Burritos',699,array['cheese']::text[],array['guacamole','sour-cream']::text[]),
  ('3343947796','Birria Burrito','Burritos',1299,array['beans','rice','onion','cilantro']::text[],array['guacamole','sour-cream','cheese']::text[]),
  ('198880663','Cabeza Burrito','Burritos',1399,array['onion','cilantro']::text[],array['guacamole','sour-cream','cheese']::text[]),
  ('198880632','California Burrito','Burritos',1599,array['guacamole','pico','cheese','sour-cream','fries']::text[],array[]::text[]),
  ('198880626','Carne Asada Burrito with guacamole and pico','Burritos',1499,array['guacamole','pico']::text[],array['sour-cream','cheese']::text[]),
  ('1169949037','Carne Asada Burrito with Rice and Beans Only','Burritos',1499,array['beans','rice']::text[],array['guacamole','sour-cream','cheese']::text[]),
  ('16994292882','Carne Asada Burrito with Cheese, Sour Cream, and Fries','Burritos',1499,array['cheese','sour-cream','fries']::text[],array['guacamole']::text[]),
  ('23721922361','Carne Asada Burrito with Guacamole, Pico, Cheese, Sour Cream, Rice, and Beans','Burritos',1699,array['guacamole','pico','cheese','sour-cream','beans','rice']::text[],array[]::text[]),
  ('198880629','Carnitas Burrito','Burritos',1399,array['guacamole','pico']::text[],array['sour-cream','cheese']::text[]),
  ('16994291329','Chicken Burrito with Beans and Rice','Burritos',1399,array['beans','rice']::text[],array['guacamole','sour-cream','cheese']::text[]),
  ('1145493274','Chicken California Burrito','Burritos',1476,array['guacamole','pico','cheese','sour-cream','fries']::text[],array[]::text[]),
  ('198880671','Chicken Chipotle','Burritos',1299,array['cheese','lettuce','avocado']::text[],array['sour-cream']::text[]),
  ('198880666','Chile Relleno Burrito','Burritos',1399,array['beans','rice']::text[],array['guacamole','sour-cream']::text[]),
  ('198880670','Chile Verde Burrito','Burritos',1324,array['beans','rice']::text[],array['guacamole','sour-cream','cheese']::text[]),
  ('198880659','Del Mar Burrito','Burritos',1356,array['sour-cream','rice','cabbage']::text[],array[]::text[]),
  ('22783650552','Diabla Burrito','Burritos',1450,array['pico','rice','avocado']::text[],array[]::text[]),
  ('198880635','Fish Burrito','Burritos',1276,array['pico','sour-cream','cabbage']::text[],array[]::text[]),
  ('198880667','Ground Beef Burrito','Burritos',1299,array['cheese','sour-cream','lettuce']::text[],array['guacamole']::text[]),
  ('198880672','Mixed Burrito','Burritos',1099,array['beans','onion','bell-peppers']::text[],array['guacamole','sour-cream','cheese']::text[]),
  ('198880627','Pollo Asado Burrito','Burritos',1399,array['guacamole','pico']::text[],array['sour-cream','cheese']::text[]),
  ('198880662','Shredded Beef Burrito','Burritos',1099,array['onion','bell-peppers']::text[],array['guacamole','sour-cream','cheese']::text[]),
  ('198880656','Shrimp Burrito','Burritos',1499,array['pico','sour-cream','rice','cabbage']::text[],array[]::text[]),
  ('2843786809','Supreme Burrito','Burritos',1399,array['sour-cream','beans','rice','onion','cilantro']::text[],array['guacamole']::text[]),
  ('17056986042','Surf and Turf Burrito','Burritos',1434,array['rice']::text[],array[]::text[]),
  ('198880668','Veggie Burrito','Burritos',899,array['rice']::text[],array['guacamole','sour-cream','cheese']::text[]),
  ('198880681','Surf and Turf Burrito','Burritos',1367,array['cheese','sour-cream','rice','avocado']::text[],array[]::text[]),
  ('24579992217','Adobada Wet Burrito with Red Sauce','Wet Burritos',1467,array['guacamole','pico','beans','rice']::text[],array['sour-cream','cheese']::text[]),
  ('30381328433','Cabeza Wet Burrito with Red Sauce','Wet Burritos',1500,array['beans','rice','onion','cilantro']::text[],array['guacamole','sour-cream','cheese']::text[]),
  ('24580195808','California Wet Burrito / Red Sauce / Guacamole / Pico / Cheese / Sour Cream / Fries / Only','Wet Burritos',1515,array['guacamole','pico','cheese','sour-cream','beans','rice','fries']::text[],array[]::text[]),
  ('9871951347','Carne Asada Wet Burrito with Green Sauce','Wet Burritos',1456,array['beans','rice']::text[],array['guacamole','sour-cream','cheese']::text[]),
  ('9872697488','Carne Asada Wet Burrito with Red and Green Sauce','Wet Burritos',1469,array['beans','rice']::text[],array['guacamole','sour-cream','cheese']::text[]),
  ('9872697486','Carne Asada Wet Burrito Red Sauce','Wet Burritos',1499,array['beans','rice']::text[],array['guacamole','sour-cream','cheese']::text[]),
  ('9871525714','Carnitas Wet Burrito with Red Sauce','Wet Burritos',1425,array['beans','rice']::text[],array['guacamole','sour-cream','cheese']::text[]),
  ('30381107207','Lengua Wet Burrito with Green Sauce','Wet Burritos',1500,array['beans','rice']::text[],array['guacamole','sour-cream','cheese']::text[]),
  ('30381246062','Lengua Wet Burrito with Red Sauce','Wet Burritos',1500,array['beans','rice']::text[],array['guacamole','sour-cream','cheese']::text[]);
do $$ declare r uuid; m uuid; add_group uuid; remove_group uuid; begin
 if current_setting('menu_man.seed_environment',true) is distinct from 'staging' then raise exception 'Armando customization seed is staging only'; end if;
 select id into strict r from public.restaurants where slug='armandos' and is_active;
 if r <> '3d87585a-ff4b-4ae1-bef6-4e1e559cb04f'::uuid then raise exception 'Wrong Armando staging tenant'; end if;
 select id into strict m from public.menus where restaurant_id=r and name='Main Menu' and is_published;
 if (select count(*) from armando_burrito_plan)<>60 or (select count(*) from armando_burrito_plan where section_name='Breakfast Burritos')<>18 or (select count(*) from armando_burrito_plan where section_name='Burritos')<>33 or (select count(*) from armando_burrito_plan where section_name='Wet Burritos')<>9 then raise exception 'Target plan counts mismatch'; end if;
 if exists(select 1 from armando_burrito_plan p left join public.menu_items i on i.restaurant_id=r and i.source_system='doordash' and i.source_item_id=p.source_item_id left join public.menu_section_items pl on pl.item_id=i.id left join public.menu_sections s on s.id=pl.section_id and s.menu_id=m where i.id is null or i.name<>p.item_name or i.price_cents<>p.expected_price_cents or not i.is_orderable or s.name is distinct from p.section_name group by p.source_item_id having count(i.id)<>1 or count(s.id)<>1) then raise exception 'Live item identity, section, price, or orderability mismatch'; end if;
 if (select count(*) from public.modifier_groups where restaurant_id=r and name='Add extras' and is_active)<>1 then raise exception 'Expected one Armando Add extras group'; end if;
 select id into strict add_group from public.modifier_groups where restaurant_id=r and name='Add extras' and is_active;
 if (select count(*) from public.modifier_options where restaurant_id=r and modifier_group_id=add_group and is_active)<>3 or not exists(select 1 from public.modifier_options where restaurant_id=r and modifier_group_id=add_group and name='Guacamole' and is_active and default_price_adjustment_cents=150) or not exists(select 1 from public.modifier_options where restaurant_id=r and modifier_group_id=add_group and name='Sour Cream' and is_active and default_price_adjustment_cents=75) or not exists(select 1 from public.modifier_options where restaurant_id=r and modifier_group_id=add_group and name='Cheese' and is_active and default_price_adjustment_cents=100) then raise exception 'Add extras choices/prices differ from approved staging options'; end if;
 if (select count(*) from public.modifier_groups where restaurant_id=r and name='Remove ingredients')>1 or exists(select 1 from public.modifier_groups where restaurant_id=r and name='Remove ingredients' and (source_system is distinct from 'menu-man-demo' or source_group_id is distinct from 'remove-ingredients')) then raise exception 'Remove ingredients group identity conflict'; end if;
end $$;
insert into public.modifier_groups(restaurant_id,name,description,source_system,source_group_id,is_active) values('3d87585a-ff4b-4ae1-bef6-4e1e559cb04f','Remove ingredients','Select included ingredients to leave out.','menu-man-demo','remove-ingredients',true) on conflict(restaurant_id,source_system,source_group_id) where source_system is not null and source_group_id is not null do update set name=excluded.name,description=excluded.description,is_active=true;
insert into public.modifier_options(restaurant_id,modifier_group_id,name,default_price_adjustment_cents,sort_order,source_system,source_option_id,is_default,is_active) select '3d87585a-ff4b-4ae1-bef6-4e1e559cb04f',g.id,v.name,v.price,v.sort_order,v.source_system,v.source_option_id,false,true from public.modifier_groups g cross join (values
  ('guacamole','No Guacamole',0,0,'menu-man-demo','guacamole',false,true),
  ('pico','No Pico de Gallo',0,1,'menu-man-demo','pico',false,true),
  ('cheese','No Cheese',0,2,'menu-man-demo','cheese',false,true),
  ('sour-cream','No Sour Cream',0,3,'menu-man-demo','sour-cream',false,true),
  ('beans','No Beans',0,4,'menu-man-demo','beans',false,true),
  ('rice','No Rice',0,5,'menu-man-demo','rice',false,true),
  ('onion','No Onion',0,6,'menu-man-demo','onion',false,true),
  ('cilantro','No Cilantro',0,7,'menu-man-demo','cilantro',false,true),
  ('fries','No Fries',0,8,'menu-man-demo','fries',false,true),
  ('cabbage','No Cabbage',0,9,'menu-man-demo','cabbage',false,true),
  ('lettuce','No Lettuce',0,10,'menu-man-demo','lettuce',false,true),
  ('potatoes','No Homestyle Potatoes',0,11,'menu-man-demo','potatoes',false,true),
  ('bell-peppers','No Bell Peppers',0,12,'menu-man-demo','bell-peppers',false,true),
  ('avocado','No Avocado',0,13,'menu-man-demo','avocado',false,true)
) v(option_id,name,price,sort_order,source_system,source_option_id,is_default,is_active) where g.restaurant_id='3d87585a-ff4b-4ae1-bef6-4e1e559cb04f' and g.source_system='menu-man-demo' and g.source_group_id='remove-ingredients' on conflict(modifier_group_id,source_system,source_option_id) where source_system is not null and source_option_id is not null do update set name=excluded.name,default_price_adjustment_cents=0,sort_order=excluded.sort_order,is_default=false,is_active=true;
do $$ declare r uuid:='3d87585a-ff4b-4ae1-bef6-4e1e559cb04f'; add_group uuid; remove_group uuid; begin
 select id into strict add_group from public.modifier_groups where restaurant_id=r and name='Add extras' and is_active;
 select id into strict remove_group from public.modifier_groups where restaurant_id=r and source_system='menu-man-demo' and source_group_id='remove-ingredients' and is_active;
 insert into public.menu_item_modifier_groups(restaurant_id,menu_item_id,modifier_group_id,min_selections,max_selections,sort_order,is_active) select r,i.id,remove_group,0,14,0,true from armando_burrito_plan p join public.menu_items i on i.restaurant_id=r and i.source_system='doordash' and i.source_item_id=p.source_item_id where cardinality(p.removal_option_ids)>0 on conflict(menu_item_id,modifier_group_id) do update set restaurant_id=excluded.restaurant_id,min_selections=0,max_selections=14,sort_order=0,is_active=true;
 insert into public.menu_item_modifier_groups(restaurant_id,menu_item_id,modifier_group_id,min_selections,max_selections,sort_order,is_active) select r,i.id,add_group,0,3,1,true from armando_burrito_plan p join public.menu_items i on i.restaurant_id=r and i.source_system='doordash' and i.source_item_id=p.source_item_id where cardinality(p.add_option_ids)>0 on conflict(menu_item_id,modifier_group_id) do update set restaurant_id=excluded.restaurant_id,min_selections=0,max_selections=3,sort_order=1,is_active=true;
 insert into public.menu_item_modifier_option_overrides(restaurant_id,menu_item_id,modifier_group_id,modifier_option_id,price_adjustment_cents,sort_order,is_active) select r,i.id,remove_group,o.id,null,null,(o.source_option_id=any(p.removal_option_ids)) from armando_burrito_plan p join public.menu_items i on i.restaurant_id=r and i.source_system='doordash' and i.source_item_id=p.source_item_id join public.menu_item_modifier_groups a on a.restaurant_id=r and a.menu_item_id=i.id and a.modifier_group_id=remove_group and a.is_active join public.modifier_options o on o.restaurant_id=r and o.modifier_group_id=remove_group on conflict(menu_item_id,modifier_option_id) do update set restaurant_id=excluded.restaurant_id,modifier_group_id=excluded.modifier_group_id,price_adjustment_cents=null,sort_order=null,is_active=excluded.is_active;
 insert into public.menu_item_modifier_option_overrides(restaurant_id,menu_item_id,modifier_group_id,modifier_option_id,price_adjustment_cents,sort_order,is_active) select r,i.id,add_group,o.id,null,null,(o.source_option_id=any(p.add_option_ids)) from armando_burrito_plan p join public.menu_items i on i.restaurant_id=r and i.source_system='doordash' and i.source_item_id=p.source_item_id join public.menu_item_modifier_groups a on a.restaurant_id=r and a.menu_item_id=i.id and a.modifier_group_id=add_group and a.is_active join public.modifier_options o on o.restaurant_id=r and o.modifier_group_id=add_group on conflict(menu_item_id,modifier_option_id) do update set restaurant_id=excluded.restaurant_id,modifier_group_id=excluded.modifier_group_id,price_adjustment_cents=null,sort_order=null,is_active=excluded.is_active;
 if exists(select 1 from armando_burrito_plan p join public.menu_items i on i.restaurant_id=r and i.source_system='doordash' and i.source_item_id=p.source_item_id join public.menu_item_modifier_groups a on a.restaurant_id=r and a.menu_item_id=i.id and a.is_active join public.modifier_groups g on g.restaurant_id=r and g.id=a.modifier_group_id where g.id not in(remove_group,add_group)) then raise exception 'Unexpected active group in target sections'; end if;
 if (select count(*) from public.menu_items i join armando_burrito_plan p on p.source_item_id=i.source_item_id where i.restaurant_id=r and i.source_system='doordash' and i.is_orderable and i.price_cents=p.expected_price_cents)<>60 then raise exception 'Target prices/orderability changed'; end if;
 if exists(select 1 from armando_burrito_plan p join public.menu_items i on i.restaurant_id=r and i.source_system='doordash' and i.source_item_id=p.source_item_id left join public.menu_item_modifier_groups a on a.restaurant_id=r and a.menu_item_id=i.id and a.is_active left join public.modifier_groups g on g.restaurant_id=r and g.id=a.modifier_group_id where (cardinality(p.removal_option_ids)>0 and (select count(*) from public.menu_item_modifier_groups x where x.restaurant_id=r and x.menu_item_id=i.id and x.modifier_group_id=remove_group and x.is_active)<>1) or (cardinality(p.add_option_ids)>0 and (select count(*) from public.menu_item_modifier_groups x where x.restaurant_id=r and x.menu_item_id=i.id and x.modifier_group_id=add_group and x.is_active)<>1) or (cardinality(p.add_option_ids)=0 and exists(select 1 from public.menu_item_modifier_groups x where x.restaurant_id=r and x.menu_item_id=i.id and x.modifier_group_id=add_group and x.is_active)) group by p.source_item_id,p.removal_option_ids,p.add_option_ids,i.id) then raise exception 'Target attachment assignment mismatch'; end if;
 if exists(select 1 from public.menu_item_modifier_groups a join public.menu_items i on i.id=a.menu_item_id and i.restaurant_id=a.restaurant_id join public.modifier_groups g on g.id=a.modifier_group_id and g.restaurant_id=a.restaurant_id where a.restaurant_id=r and a.is_active and i.source_system='doordash' and g.name in ('Remove ingredients','Add extras') and (a.min_selections<>0 or (g.name='Remove ingredients' and a.max_selections<>14) or (g.name='Add extras' and a.max_selections<>3))) then raise exception 'Customization groups must remain optional multi-select'; end if;
 if exists(select 1 from armando_burrito_plan p join public.menu_items i on i.restaurant_id=r and i.source_system='doordash' and i.source_item_id=p.source_item_id join public.menu_item_modifier_groups a on a.restaurant_id=r and a.menu_item_id=i.id and a.modifier_group_id=remove_group and a.is_active join public.modifier_options o on o.restaurant_id=r and o.modifier_group_id=remove_group left join public.menu_item_modifier_option_overrides v on v.restaurant_id=r and v.menu_item_id=i.id and v.modifier_option_id=o.id where coalesce(v.is_active,true) is distinct from (o.source_option_id=any(p.removal_option_ids))) then raise exception 'Removal choices do not match item ingredients'; end if;
 if exists(select 1 from armando_burrito_plan p join public.menu_items i on i.restaurant_id=r and i.source_system='doordash' and i.source_item_id=p.source_item_id join public.menu_item_modifier_groups a on a.restaurant_id=r and a.menu_item_id=i.id and a.modifier_group_id=add_group and a.is_active join public.modifier_options o on o.restaurant_id=r and o.modifier_group_id=add_group left join public.menu_item_modifier_option_overrides v on v.restaurant_id=r and v.menu_item_id=i.id and v.modifier_option_id=o.id where coalesce(v.is_active,true) is distinct from (o.source_option_id=any(p.add_option_ids))) then raise exception 'Add-on options do not match the plan'; end if;
 if exists(select 1 from public.modifier_options o where o.restaurant_id=r and o.modifier_group_id=remove_group and o.is_active and (o.default_price_adjustment_cents<>0 or o.is_default)) then raise exception 'Removal choices must remain zero-price and non-default'; end if;
 if (select count(*) from public.modifier_options where restaurant_id=r and modifier_group_id=remove_group and is_active)<>14 then raise exception 'Expected 14 removal options'; end if;
end $$;
select 'Armando burrito customization batch 1 applied' result, count(*) as target_items, count(*) filter(where cardinality(removal_option_ids)>0) as with_removals, count(*) filter(where cardinality(add_option_ids)>0) as with_add_ons from armando_burrito_plan;
commit;
