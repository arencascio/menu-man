-- Armando's approved mechanical description repairs only. Staging tenant; safe to replay.
begin;
select pg_catalog.set_config('menu_man.seed_environment','staging',true);

create temporary table armando_copy_cleanup_plan (
  source_item_id text primary key,
  item_name text not null,
  section_name text not null,
  expected_price_cents integer not null,
  original_description text not null,
  corrected_description text not null
) on commit drop;

insert into armando_copy_cleanup_plan values
  ('16994295879','Steak Breakfast Burrito with Beans','Breakfast Burritos',1299,'Grilled steak, scrambled scrambled eggs, refried beans, and shredded cheddar cheese wrapped in a soft flour tortilla.','Grilled steak, scrambled eggs, refried beans, and shredded cheddar cheese wrapped in a soft flour tortilla.'),
  ('2843786809','Supreme Burrito','Burritos',1399,'Grilled steak, a chille relleno, sour cream, rice, refried beans, onion, and cilantro wrapped in a soft flour tortilla.','Grilled steak, a chile relleno, sour cream, rice, refried beans, onion, and cilantro wrapped in a soft flour tortilla.'),
  ('198880534','Adobada Mini Taco','Street Tacos',350,'Fried slow-cooked pork on a soft corn torilla topped with fresh chopped onions and cilantro.','Fried slow-cooked pork on a soft corn tortilla topped with fresh chopped onions and cilantro.'),
  ('198880597','Cabeza Taco','Tacos',424,'Tender beef head on a soft corn torilla topped with fresh chopped onion and cilantro.','Tender beef head on a soft corn tortilla topped with fresh chopped onion and cilantro.'),
  ('198880589','Carne Asada Taco','Tacos',499,'Grilled steak on a soft corn torilla topped with guacamole, picó de gallo, onion, and cilantro.','Grilled steak on a soft corn tortilla topped with guacamole, picó de gallo, onion, and cilantro.'),
  ('5772977560','Ham, Egg, and Cheese Burrito','Breakfast Burritos',956,'Breakfast ham, scrambled eggs, and  cheddar cheese wrapped in a soft flour tortilla.','Breakfast ham, scrambled eggs, and cheddar cheese wrapped in a soft flour tortilla.'),
  ('198880632','California Burrito','Burritos',1599,'Grilled steak, guacamole, picó de gallo, sour cream, cheese, and french fries  wrapped in a soft flour tortilla.','Grilled steak, guacamole, picó de gallo, sour cream, cheese, and french fries wrapped in a soft flour tortilla.'),
  ('198880533','Pollo Asado Mini Taco','Street Tacos',350,'Grilled chicken on a soft corn tortilla with topped with fresh chopped onions and cilantro.','Grilled chicken on a soft corn tortilla topped with fresh chopped onions and cilantro.');

do $$
declare tenant uuid; menu uuid;
begin
  if current_setting('menu_man.seed_environment',true) is distinct from 'staging' then
    raise exception 'Armando copy cleanup is staging only';
  end if;
  select id into strict tenant from public.restaurants where slug='armandos' and is_active;
  if tenant is distinct from '3d87585a-ff4b-4ae1-bef6-4e1e559cb04f'::uuid then
    raise exception 'Wrong Armando staging tenant';
  end if;
  select id into strict menu from public.menus where restaurant_id=tenant and name='Main Menu' and is_published;
  if (select count(*) from armando_copy_cleanup_plan)<>8 then
    raise exception 'Copy cleanup plan must contain exactly eight items';
  end if;
  if exists(
    select 1
    from armando_copy_cleanup_plan plan
    left join public.menu_items item on item.restaurant_id=tenant
      and item.source_system='doordash' and item.source_item_id=plan.source_item_id
    left join public.menu_section_items placement on placement.item_id=item.id
    left join public.menu_sections section on section.id=placement.section_id and section.menu_id=menu
    where item.id is null or item.name is distinct from plan.item_name
      or item.price_cents is distinct from plan.expected_price_cents
      or item.is_orderable is distinct from true
      or (item.description is distinct from plan.original_description
        and item.description is distinct from plan.corrected_description)
      or section.name is distinct from plan.section_name
    group by plan.source_item_id
    having count(item.id)<>1 or count(section.id)<>1
  ) then
    raise exception 'Source identity, section, price, orderability, or expected description mismatch';
  end if;
end $$;

-- Capture current restaurant data so the postcondition can prove only the eight
-- planned description fields changed. These snapshots are transaction-local.
create temporary table armando_menu_items_before on commit drop as
select item.id,item.source_item_id,item.description,to_jsonb(item) row_json
from public.menu_items item
where item.restaurant_id='3d87585a-ff4b-4ae1-bef6-4e1e559cb04f'::uuid
  and item.source_system='doordash';

create temporary table armando_placements_before on commit drop as
select placement.item_id,placement.section_id,placement.sort_order
from public.menu_section_items placement
join public.menu_items item on item.id=placement.item_id
join public.menu_sections section on section.id=placement.section_id
join public.menus menu on menu.id=section.menu_id
where item.restaurant_id='3d87585a-ff4b-4ae1-bef6-4e1e559cb04f'::uuid
  and item.source_system='doordash' and menu.restaurant_id=item.restaurant_id;

create temporary table armando_modifier_groups_before on commit drop as
select * from public.modifier_groups
where restaurant_id='3d87585a-ff4b-4ae1-bef6-4e1e559cb04f'::uuid;
create temporary table armando_modifier_options_before on commit drop as
select * from public.modifier_options
where restaurant_id='3d87585a-ff4b-4ae1-bef6-4e1e559cb04f'::uuid;
create temporary table armando_item_modifier_groups_before on commit drop as
select * from public.menu_item_modifier_groups
where restaurant_id='3d87585a-ff4b-4ae1-bef6-4e1e559cb04f'::uuid;
create temporary table armando_modifier_overrides_before on commit drop as
select * from public.menu_item_modifier_option_overrides
where restaurant_id='3d87585a-ff4b-4ae1-bef6-4e1e559cb04f'::uuid;

update public.menu_items item
set description=plan.corrected_description
from armando_copy_cleanup_plan plan
where item.restaurant_id='3d87585a-ff4b-4ae1-bef6-4e1e559cb04f'::uuid
  and item.source_system='doordash'
  and item.source_item_id=plan.source_item_id
  and item.description=plan.original_description;

do $$
declare tenant uuid:='3d87585a-ff4b-4ae1-bef6-4e1e559cb04f'; menu uuid;
begin
  select id into strict menu from public.menus where restaurant_id=tenant and name='Main Menu' and is_published;

  if (select count(*) from armando_copy_cleanup_plan plan
      join public.menu_items item on item.restaurant_id=tenant and item.source_system='doordash'
        and item.source_item_id=plan.source_item_id and item.name=plan.item_name
        and item.price_cents=plan.expected_price_cents and item.description=plan.corrected_description
      join public.menu_section_items placement on placement.item_id=item.id
      join public.menu_sections section on section.id=placement.section_id
        and section.menu_id=menu and section.name=plan.section_name)<>8 then
    raise exception 'Not all eight source items resolve to the corrected text';
  end if;

  if exists(
    select 1 from armando_menu_items_before before
    full join (
      select * from public.menu_items
      where restaurant_id=tenant and source_system='doordash'
    ) item on item.id=before.id
    left join armando_copy_cleanup_plan plan on plan.source_item_id=before.source_item_id
    where before.id is null or item.id is null
      -- updated_at is audit metadata; some staging schemas maintain it on any
      -- row update. All other menu-item fields remain part of this comparison.
      or (before.row_json-'description'-'updated_at')
        is distinct from (to_jsonb(item)-'description'-'updated_at')
      or item.description is distinct from coalesce(plan.corrected_description,before.description)
  ) then
    raise exception 'Menu item fields changed outside the eight approved descriptions';
  end if;

  if exists(select item_id,section_id,sort_order from public.menu_section_items
      where item_id in(select id from public.menu_items where restaurant_id=tenant and source_system='doordash')
      except select item_id,section_id,sort_order from armando_placements_before)
    or exists(select item_id,section_id,sort_order from armando_placements_before
      except select item_id,section_id,sort_order from public.menu_section_items
      where item_id in(select id from public.menu_items where restaurant_id=tenant and source_system='doordash')) then
    raise exception 'Menu section placements changed';
  end if;

  if exists(select * from public.modifier_groups where restaurant_id=tenant
      except select * from armando_modifier_groups_before)
    or exists(select * from armando_modifier_groups_before
      except select * from public.modifier_groups where restaurant_id=tenant)
    or exists(select * from public.modifier_options where restaurant_id=tenant
      except select * from armando_modifier_options_before)
    or exists(select * from armando_modifier_options_before
      except select * from public.modifier_options where restaurant_id=tenant)
    or exists(select * from public.menu_item_modifier_groups where restaurant_id=tenant
      except select * from armando_item_modifier_groups_before)
    or exists(select * from armando_item_modifier_groups_before
      except select * from public.menu_item_modifier_groups where restaurant_id=tenant)
    or exists(select * from public.menu_item_modifier_option_overrides where restaurant_id=tenant
      except select * from armando_modifier_overrides_before)
    or exists(select * from armando_modifier_overrides_before
      except select * from public.menu_item_modifier_option_overrides where restaurant_id=tenant) then
    raise exception 'Restaurant modifier configuration changed';
  end if;

  if (select count(*) from public.menu_items where restaurant_id=tenant and is_orderable)<>307 then
    raise exception 'Whole-menu orderability differs from 307';
  end if;
  if (select count(*) from public.menu_items item
      join public.menu_section_items placement on placement.item_id=item.id
      join public.menu_sections section on section.id=placement.section_id and section.menu_id=menu
      where item.restaurant_id=tenant and item.source_system='doordash'
        and section.name='Street Tacos' and item.source_item_id in('359794279','359796582')
        and item.is_orderable is false)<>2 then
    raise exception 'Both 20-taco packs must remain held';
  end if;
end $$;

select 'Armando safe copy cleanup applied/verified' result,count(*) corrected_items
from armando_copy_cleanup_plan plan
join public.menu_items item on item.restaurant_id='3d87585a-ff4b-4ae1-bef6-4e1e559cb04f'::uuid
  and item.source_system='doordash' and item.source_item_id=plan.source_item_id
  and item.description=plan.corrected_description;
commit;
