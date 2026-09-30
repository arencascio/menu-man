-- Read-only staging verification for Armando's Combination Plates batch 4.
begin;
set transaction read only;
create temporary table expected_batch4(source_item_id text primary key,item_name text not null,price_cents integer not null) on commit drop;
insert into expected_batch4 values
    ('5337696094','#23. Two Shredded Chicken Tacos',1399),
    ('198880491','#1. Tostada and Taco',1097),
    ('198880495','#2. Two Beef Tacos',1393),
    ('198880497','#3. Two Cheese Enchiladas',1393),
    ('198880499','#4. Bean Tostada and Cheese Enchilada',1199),
    ('198880500','#5. Beef Taco and Cheese Enchilada',1399),
    ('198880503','#6. Cheese Enchilada and Beef Burrito',1199),
    ('198880504','#7. Two Beef Burritos',1299),
    ('198880505','#8. Two Tostadas – Choice of Meat',1076),
    ('198880507','#9. Two Pollo Asado Tacos',1399),
    ('198880508','#10. Two Chicken Enchiladas',1399),
    ('198880509','#11. Beef Taco and Beef Burrito',1399),
    ('198880510','#12. Carne Asada Plate',1625),
    ('198880511','#13. Machaca Plate',1399),
    ('198880512','#14. Chorizo Plate',1399),
    ('198880513','#15. Carnitas Plate',1376),
    ('198880514','#16. Two Carne Asada Tacos',1399),
    ('198880515','#17. Two Chiles Rellenos Plate',1399),
    ('198880518','#18. Two Fish Tacos',1299),
    ('198880519','#19. Pollo Asado Plate',1399),
    ('198880520','#20. Three Rolled Tacos',1090),
    ('7949242446','Adobada Plate with Rice and Beans',1399),
    ('376154181','Birria Combo',1476),
    ('376154282','Birria Bowl',1499),
    ('7995077785','Cabeza Plate with Rice and Beans',1499),
    ('198880521','Camarones a la Diabla',1699),
    ('6912796879','Two Chicken Enchiladas with Green Sauce',1367),
    ('10770381235','Chile Relleno and Cheese Enchilada Combo',1399),
    ('7949201301','Chile Verde Plate with Rice and Beans',1399),
    ('198880522','Enchiladas del Mar',1599),
    ('198880526','Flying Saucer',999),
    ('14833449100','Ranchera Plate',1799),
    ('5765626765','Two Chicken Enchiladas with Rice and Beans',1366),
    ('8880117979','Two-Enchilada Combo – Chicken and Cheese',1376),
    ('5732068679','Two Birria Tacos with Rice, Beans, and Consommé',1399),
    ('6416059090','Two Birria Sopes Combo',1199),
    ('1206365534','Two Sopes Combo – Choice of Meat',1199),
    ('198880695','#21. Super Rolled Tacos',999),
    ('198880697','#23. Two Shredded Chicken Tacos',1099),
    ('198880699','#24. Chicken Fajita Burrito',1199);

do $$
declare tenant uuid; menu uuid; removals uuid; extras uuid; meat uuid; tortilla uuid; rolled uuid;
        placements integer; unique_ids integer; orderable_items integer; removal_items integer; extra_items integer; base_only integer;
begin
  select id into strict tenant from public.restaurants where slug='armandos' and is_active;
  if tenant<>'3d87585a-ff4b-4ae1-bef6-4e1e559cb04f'::uuid then raise exception 'Wrong Armando staging tenant'; end if;
  select id into strict menu from public.menus where restaurant_id=tenant and name='Main Menu' and is_published;
  select id into strict removals from public.modifier_groups where restaurant_id=tenant and source_system='menu-man-demo' and source_group_id='remove-ingredients' and is_active;
  select id into strict extras from public.modifier_groups where restaurant_id=tenant and name='Add extras' and is_active;
  select id into strict meat from public.modifier_groups where restaurant_id=tenant and source_system='menu-man-test' and source_group_id='choose-meat' and is_active;
  select id into strict tortilla from public.modifier_groups where restaurant_id=tenant and name='Tortillas or Chips' and is_active;
  select id into strict rolled from public.modifier_groups where restaurant_id=tenant and source_system='menu-man-demo' and source_group_id='rolled-taco-chicken-or-beef' and is_active;

  if (select count(*) from expected_batch4)<>40 then raise exception 'Expected manifest must contain 40 items'; end if;
  if exists(select 1 from expected_batch4 e left join public.menu_items i on i.restaurant_id=tenant and i.source_system='doordash' and i.source_item_id=e.source_item_id left join public.menu_section_items p on p.item_id=i.id left join public.menu_sections s on s.id=p.section_id and s.menu_id=menu and s.name='Combination Plates' where i.id is null or i.name<>e.item_name or i.price_cents<>e.price_cents or i.is_orderable is distinct from true or s.id is null group by e.source_item_id having count(i.id)<>1 or count(s.id)<>1) then raise exception 'Item identity, name, price, placement, or orderability mismatch'; end if;
  select count(*),count(distinct i.source_item_id),count(*) filter(where i.is_orderable)
  into placements,unique_ids,orderable_items
  from public.menu_items i join public.menu_section_items p on p.item_id=i.id join public.menu_sections s on s.id=p.section_id
  where i.restaurant_id=tenant and i.source_system='doordash' and s.menu_id=menu and s.name='Combination Plates';
  if (placements,unique_ids,orderable_items) is distinct from (40,40,40) then raise exception 'Placement/identity/orderability counts are %, %, %',placements,unique_ids,orderable_items; end if;
  if exists(select 1 from public.menu_items i join public.menu_section_items p on p.item_id=i.id join public.menu_sections s on s.id=p.section_id where i.restaurant_id=tenant and i.source_system='doordash' and s.menu_id=menu and s.name='Combination Plates' and not exists(select 1 from expected_batch4 e where e.source_item_id=i.source_item_id)) then raise exception 'Unplanned item found in section'; end if;

  select count(*) filter(where exists(select 1 from public.menu_item_modifier_groups a where a.restaurant_id=tenant and a.menu_item_id=i.id and a.modifier_group_id=removals and a.is_active)),
         count(*) filter(where exists(select 1 from public.menu_item_modifier_groups a where a.restaurant_id=tenant and a.menu_item_id=i.id and a.modifier_group_id=extras and a.is_active)),
         count(*) filter(where not exists(select 1 from public.menu_item_modifier_groups a where a.restaurant_id=tenant and a.menu_item_id=i.id and a.modifier_group_id in(removals,extras) and a.is_active))
  into removal_items,extra_items,base_only
  from public.menu_items i join expected_batch4 e on e.source_item_id=i.source_item_id where i.restaurant_id=tenant and i.source_system='doordash';
  if (removal_items,extra_items,base_only) is distinct from (39,6,1) then raise exception 'Batch counts differ: removals %, paid extras %, base-only %',removal_items,extra_items,base_only; end if;
  if not exists(select 1 from public.menu_items where restaurant_id=tenant and source_system='doordash' and source_item_id='198880526') then raise exception 'Expected base-only Flying Saucer missing'; end if;

  if (select count(*) from public.modifier_options where restaurant_id=tenant and modifier_group_id=removals and is_active)<>14
     or exists(select 1 from public.modifier_options where restaurant_id=tenant and modifier_group_id=removals and is_active and (default_price_adjustment_cents<>0 or is_default)) then raise exception 'Removal options must remain zero-price and non-default'; end if;
  if (select count(*) from public.modifier_options where restaurant_id=tenant and modifier_group_id=extras and is_active)<>3
     or not exists(select 1 from public.modifier_options where restaurant_id=tenant and modifier_group_id=extras and source_option_id='guacamole' and is_active and default_price_adjustment_cents=150)
     or not exists(select 1 from public.modifier_options where restaurant_id=tenant and modifier_group_id=extras and source_option_id='sour-cream' and is_active and default_price_adjustment_cents=75)
     or not exists(select 1 from public.modifier_options where restaurant_id=tenant and modifier_group_id=extras and source_option_id='cheese' and is_active and default_price_adjustment_cents=100) then raise exception 'Armando paid extra prices changed'; end if;

  if exists(select 1 from public.menu_items i join expected_batch4 e on e.source_item_id=i.source_item_id join public.menu_item_modifier_groups a on a.restaurant_id=tenant and a.menu_item_id=i.id and a.modifier_group_id=removals and a.is_active join public.modifier_options o on o.restaurant_id=tenant and o.modifier_group_id=removals and o.is_active left join public.menu_item_modifier_option_overrides x on x.restaurant_id=tenant and x.menu_item_id=i.id and x.modifier_option_id=o.id where i.restaurant_id=tenant and i.source_system='doordash' and coalesce(x.is_active,true) and not ((o.source_option_id='guacamole' and concat_ws(' ',i.name,i.description)~*'guacamole|avocado') or (o.source_option_id='pico' and concat_ws(' ',i.name,i.description)~*'pico|pic.{0,3}[[:space:]]*de gallo') or (o.source_option_id='cheese' and concat_ws(' ',i.name,i.description)~*'cheese') or (o.source_option_id='sour-cream' and concat_ws(' ',i.name,i.description)~*'sour[[:space:]]*cream') or (o.source_option_id='beans' and concat_ws(' ',i.name,i.description)~*'beans?') or (o.source_option_id='rice' and concat_ws(' ',i.name,i.description)~*'rice') or (o.source_option_id='onion' and concat_ws(' ',i.name,i.description)~*'onion') or (o.source_option_id='cilantro' and concat_ws(' ',i.name,i.description)~*'cilantro') or (o.source_option_id='cabbage' and concat_ws(' ',i.name,i.description)~*'cabbage') or (o.source_option_id='lettuce' and concat_ws(' ',i.name,i.description)~*'lettuce') or (o.source_option_id='bell-peppers' and concat_ws(' ',i.name,i.description)~*'bell peppers?|green peppers?') or (o.source_option_id='avocado' and concat_ws(' ',i.name,i.description)~*'avocado'))) then raise exception 'A removal option does not occur in the item copy'; end if;
  if exists(select 1 from public.menu_items i join expected_batch4 e on e.source_item_id=i.source_item_id join public.menu_item_modifier_groups a on a.restaurant_id=tenant and a.menu_item_id=i.id and a.modifier_group_id=extras and a.is_active join public.modifier_options o on o.restaurant_id=tenant and o.modifier_group_id=extras and o.is_active left join public.menu_item_modifier_option_overrides x on x.restaurant_id=tenant and x.menu_item_id=i.id and x.modifier_option_id=o.id where i.restaurant_id=tenant and i.source_system='doordash' and coalesce(x.is_active,true) and ((o.source_option_id='guacamole' and concat_ws(' ',i.name,i.description)~*'guacamole|avocado') or (o.source_option_id='sour-cream' and concat_ws(' ',i.name,i.description)~*'sour[[:space:]]*cream') or (o.source_option_id='cheese' and concat_ws(' ',i.name,i.description)~*'cheese'))) then raise exception 'An included ingredient is exposed again as a paid extra'; end if;
  if exists(select 1 from public.menu_items i join expected_batch4 e on e.source_item_id=i.source_item_id join public.menu_item_modifier_groups a on a.restaurant_id=tenant and a.menu_item_id=i.id and a.modifier_group_id=extras and a.is_active join public.modifier_options o on o.restaurant_id=tenant and o.modifier_group_id=extras and o.is_active left join public.menu_item_modifier_option_overrides x on x.restaurant_id=tenant and x.menu_item_id=i.id and x.modifier_option_id=o.id where i.restaurant_id=tenant and i.source_system='doordash' and coalesce(x.price_adjustment_cents,o.default_price_adjustment_cents)<>o.default_price_adjustment_cents) then raise exception 'An item override changed the shared paid-extra price'; end if;
  if exists(select 1 from public.menu_items i join expected_batch4 e on e.source_item_id=i.source_item_id join public.menu_item_modifier_groups a on a.restaurant_id=tenant and a.menu_item_id=i.id and a.modifier_group_id=removals and a.is_active join public.modifier_options o on o.restaurant_id=tenant and o.modifier_group_id=removals and o.is_active left join public.menu_item_modifier_option_overrides x on x.restaurant_id=tenant and x.menu_item_id=i.id and x.modifier_option_id=o.id where i.restaurant_id=tenant and i.source_system='doordash' and coalesce(x.is_active,true) and ((concat_ws(' ',i.name,i.description)~*'no[[:space:]-]*guacamole' and o.source_option_id='guacamole') or (concat_ws(' ',i.name,i.description)~*'no[[:space:]-]*cheese' and o.source_option_id='cheese') or (concat_ws(' ',i.name,i.description)~*'no[[:space:]-]*sour[[:space:]-]*cream' and o.source_option_id='sour-cream') or (concat_ws(' ',i.name,i.description)~*'no[[:space:]-]*rice' and o.source_option_id='rice') or (concat_ws(' ',i.name,i.description)~*'no[[:space:]-]*beans?' and o.source_option_id='beans'))) then raise exception 'An explicit No-X item exposes that removal'; end if;

  if exists(select 1 from public.menu_items i join expected_batch4 e on e.source_item_id=i.source_item_id join public.menu_item_modifier_groups a on a.restaurant_id=tenant and a.menu_item_id=i.id and a.is_active join public.modifier_groups g on g.restaurant_id=tenant and g.id=a.modifier_group_id where i.restaurant_id=tenant and i.source_system='doordash' and g.name not in('Remove ingredients','Add extras','Choose your meat','Tortillas or Chips','Choose chicken or beef')) then raise exception 'Unexpected active modifier group in section'; end if;
  if exists(select 1 from public.menu_items i join expected_batch4 e on e.source_item_id=i.source_item_id join public.menu_item_modifier_groups a on a.menu_item_id=i.id and a.is_active join public.modifier_groups g on g.id=a.modifier_group_id where i.restaurant_id=tenant and (a.restaurant_id is distinct from tenant or g.restaurant_id is distinct from tenant)) then raise exception 'Cross-tenant attachment detected'; end if;

  -- Preserve the six previously required groups exactly; the new requirements are source-advertised choices only.
  if (select count(*) from public.menu_items i join public.menu_item_modifier_groups a on a.restaurant_id=tenant and a.menu_item_id=i.id and a.is_active and a.min_selections=1 and a.max_selections=1 join public.modifier_groups g on g.id=a.modifier_group_id and g.restaurant_id=tenant where i.restaurant_id=tenant and i.source_system='doordash' and ((i.source_item_id in('198880505','1206365534') and g.id=meat) or (i.source_item_id in('198880510','198880513','198880519','7995077785') and g.id=tortilla)))<>6 then raise exception 'One of the six existing required choice items changed'; end if;
  if (select count(*) from public.menu_item_modifier_groups a join public.menu_items i on i.id=a.menu_item_id where a.restaurant_id=tenant and i.restaurant_id=tenant and i.source_system='doordash' and i.source_item_id='198880699' and a.modifier_group_id=meat and a.is_active and a.min_selections=1 and a.max_selections=1)<>1
    or (select count(*) from public.modifier_options o left join public.menu_item_modifier_option_overrides x on x.restaurant_id=tenant and x.menu_item_id=(select id from public.menu_items where restaurant_id=tenant and source_system='doordash' and source_item_id='198880699') and x.modifier_option_id=o.id where o.restaurant_id=tenant and o.modifier_group_id=meat and o.is_active and coalesce(x.is_active,true))<>2
    or (select count(*) from public.modifier_options o join public.menu_item_modifier_option_overrides x on x.restaurant_id=tenant and x.menu_item_id=(select id from public.menu_items where restaurant_id=tenant and source_system='doordash' and source_item_id='198880699') and x.modifier_option_id=o.id and x.is_active where o.restaurant_id=tenant and o.modifier_group_id=meat and o.source_option_id in('chicken','carne-asada'))<>2 then raise exception 'Chicken fajita burrito does not have its restricted required meat choice'; end if;
  if (select count(*) from public.menu_item_modifier_groups a join public.menu_items i on i.id=a.menu_item_id where a.restaurant_id=tenant and i.restaurant_id=tenant and i.source_item_id='198880695' and a.modifier_group_id=rolled and a.is_active and a.min_selections=1 and a.max_selections=1)<>1
    or (select count(*) from public.modifier_options o left join public.menu_item_modifier_option_overrides x on x.restaurant_id=tenant and x.menu_item_id=(select id from public.menu_items where restaurant_id=tenant and source_system='doordash' and source_item_id='198880695') and x.modifier_option_id=o.id where o.restaurant_id=tenant and o.modifier_group_id=rolled and o.is_active and coalesce(x.is_active,true))<>2
    or (select count(*) from public.modifier_options o join public.menu_item_modifier_option_overrides x on x.restaurant_id=tenant and x.menu_item_id=(select id from public.menu_items where restaurant_id=tenant and source_system='doordash' and source_item_id='198880695') and x.modifier_option_id=o.id and x.is_active where o.restaurant_id=tenant and o.modifier_group_id=rolled and o.source_option_id in('chicken','beef'))<>2 then raise exception 'Super rolled tacos do not have the restricted required chicken/beef choice'; end if;
  if exists(select 1 from public.menu_items i join expected_batch4 e on e.source_item_id=i.source_item_id join public.menu_item_modifier_groups a on a.restaurant_id=tenant and a.menu_item_id=i.id and a.is_active join public.modifier_groups g on g.id=a.modifier_group_id where i.restaurant_id=tenant and g.name='Choose your meat' and i.source_item_id not in('198880505','1206365534','198880699')) then raise exception 'Fixed protein received a meat selector'; end if;
  if exists(select 1 from public.menu_items i join expected_batch4 e on e.source_item_id=i.source_item_id join public.menu_item_modifier_groups a on a.restaurant_id=tenant and a.menu_item_id=i.id and a.is_active join public.modifier_groups g on g.id=a.modifier_group_id where i.restaurant_id=tenant and g.id=rolled and i.source_item_id<>'198880695') then raise exception 'Chicken/beef choice leaked to another listing'; end if;

  if exists(select 1 from public.menu_items i join public.menu_item_modifier_groups a on a.restaurant_id=tenant and a.menu_item_id=i.id and a.is_active and a.min_selections>0 where i.restaurant_id=tenant and i.is_orderable and (a.max_selections<a.min_selections or (select count(*) from public.modifier_options o left join public.menu_item_modifier_option_overrides x on x.restaurant_id=tenant and x.menu_item_id=i.id and x.modifier_option_id=o.id where o.restaurant_id=tenant and o.modifier_group_id=a.modifier_group_id and o.is_active and coalesce(x.is_active,true))<a.min_selections)) then raise exception 'Required group has no valid active option path'; end if;
  if (select count(*) from public.menu_items where restaurant_id=tenant and is_orderable)<>307 then raise exception 'Whole menu orderability differs from 307'; end if;
  if (select count(*) from public.menu_items i join public.menu_section_items p on p.item_id=i.id join public.menu_sections s on s.id=p.section_id and s.menu_id=menu and s.name='Street Tacos' where i.restaurant_id=tenant and i.source_system='doordash' and i.source_item_id in('359794279','359796582') and not i.is_orderable)<>2 then raise exception 'Both twenty-taco party packs must remain held'; end if;
end $$;
rollback;

