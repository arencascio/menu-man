-- STAGING TEST DATA ONLY. Apply all migrations and import data/armandos.json
-- before this seed. This enables exactly two known Armando source items and is
-- not verified production modifier configuration.

begin;

do $$
declare
  restaurant_uuid uuid;
  tostadas_item_uuid uuid;
  sopes_item_uuid uuid;
  meat_group_uuid uuid;
  extras_group_uuid uuid;
  guacamole_option_uuid uuid;
begin
  select id into restaurant_uuid
  from public.restaurants
  where slug = 'armandos' and is_active = true;

  if restaurant_uuid is null then
    raise exception 'Active restaurant not found: armandos';
  end if;

  select id into tostadas_item_uuid
  from public.menu_items
  where restaurant_id = restaurant_uuid
    and source_system = 'doordash'
    and source_item_id = '198880505';

  select id into sopes_item_uuid
  from public.menu_items
  where restaurant_id = restaurant_uuid
    and source_system = 'doordash'
    and source_item_id = '1206365534';

  if tostadas_item_uuid is null or sopes_item_uuid is null then
    raise exception 'Expected Armando test items are missing; import data/armandos.json first';
  end if;

  insert into public.modifier_groups
    (restaurant_id, name, description, source_system, source_group_id, is_active)
  values
    (restaurant_uuid, 'Choose your meat', null, 'menu-man-test', 'choose-meat', true)
  on conflict (restaurant_id, source_system, source_group_id)
    where source_system is not null and source_group_id is not null
  do update set
    name = excluded.name,
    description = excluded.description,
    is_active = excluded.is_active
  returning id into meat_group_uuid;

  insert into public.modifier_groups
    (restaurant_id, name, description, source_system, source_group_id, is_active)
  values
    (restaurant_uuid, 'Add extras', 'Customize with optional extras.', 'menu-man-test', 'add-extras', true)
  on conflict (restaurant_id, source_system, source_group_id)
    where source_system is not null and source_group_id is not null
  do update set
    name = excluded.name,
    description = excluded.description,
    is_active = excluded.is_active
  returning id into extras_group_uuid;

  insert into public.modifier_options
    (restaurant_id, modifier_group_id, name, default_price_adjustment_cents, sort_order, source_system, source_option_id, is_default, is_active)
  values
    (restaurant_uuid, meat_group_uuid, 'Carne Asada', 0, 0, 'menu-man-test', 'carne-asada', false, true),
    (restaurant_uuid, meat_group_uuid, 'Chicken', 0, 1, 'menu-man-test', 'chicken', true, true),
    (restaurant_uuid, meat_group_uuid, 'Carnitas', 0, 2, 'menu-man-test', 'carnitas', false, true)
  on conflict (modifier_group_id, source_system, source_option_id)
    where source_system is not null and source_option_id is not null
  do update set
    name = excluded.name,
    default_price_adjustment_cents = excluded.default_price_adjustment_cents,
    sort_order = excluded.sort_order,
    is_default = excluded.is_default,
    is_active = excluded.is_active;

  insert into public.modifier_options
    (restaurant_id, modifier_group_id, name, default_price_adjustment_cents, sort_order, source_system, source_option_id, is_default, is_active)
  values
    (restaurant_uuid, extras_group_uuid, 'Guacamole', 150, 0, 'menu-man-test', 'guacamole', false, true),
    (restaurant_uuid, extras_group_uuid, 'Sour Cream', 75, 1, 'menu-man-test', 'sour-cream', false, true),
    (restaurant_uuid, extras_group_uuid, 'Cheese', 100, 2, 'menu-man-test', 'cheese', false, true)
  on conflict (modifier_group_id, source_system, source_option_id)
    where source_system is not null and source_option_id is not null
  do update set
    name = excluded.name,
    default_price_adjustment_cents = excluded.default_price_adjustment_cents,
    sort_order = excluded.sort_order,
    is_default = excluded.is_default,
    is_active = excluded.is_active;

  insert into public.menu_item_modifier_groups
    (restaurant_id, menu_item_id, modifier_group_id, min_selections, max_selections, sort_order, is_active)
  values
    (restaurant_uuid, tostadas_item_uuid, meat_group_uuid, 1, 1, 0, true),
    (restaurant_uuid, tostadas_item_uuid, extras_group_uuid, 0, 4, 1, true),
    (restaurant_uuid, sopes_item_uuid, meat_group_uuid, 1, 1, 0, true),
    (restaurant_uuid, sopes_item_uuid, extras_group_uuid, 0, 4, 1, true)
  on conflict (menu_item_id, modifier_group_id)
  do update set
    min_selections = excluded.min_selections,
    max_selections = excluded.max_selections,
    sort_order = excluded.sort_order,
    is_active = excluded.is_active;

  select id into guacamole_option_uuid
  from public.modifier_options
  where modifier_group_id = extras_group_uuid
    and source_system = 'menu-man-test'
    and source_option_id = 'guacamole';

  -- Exercise item-specific pricing: guacamole is +$2.00 on tostadas and falls
  -- back to its +$1.50 option default on the sopes combo.
  insert into public.menu_item_modifier_option_overrides
    (restaurant_id, menu_item_id, modifier_group_id, modifier_option_id, price_adjustment_cents, sort_order, is_active)
  values
    (restaurant_uuid, tostadas_item_uuid, extras_group_uuid, guacamole_option_uuid, 200, 0, true)
  on conflict (menu_item_id, modifier_option_id)
  do update set
    price_adjustment_cents = excluded.price_adjustment_cents,
    sort_order = excluded.sort_order,
    is_active = excluded.is_active;

  update public.menu_items
  set is_orderable = true
  where id in (tostadas_item_uuid, sopes_item_uuid);
end;
$$;

commit;

