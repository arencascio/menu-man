-- Read-only staging contract for Armando's provisional burrito customization batch.
do $$
declare
  restaurant_uuid uuid;
  menu_uuid uuid;
  removal_group_uuid uuid;
  extras_group_uuid uuid;
begin
  select id into strict restaurant_uuid
  from public.restaurants
  where slug = 'armandos' and is_active;

  select id into strict menu_uuid
  from public.menus
  where restaurant_id = restaurant_uuid
    and name = 'Main Menu'
    and is_published;

  if (select count(*)
      from public.menu_items item
      join public.menu_section_items placement on placement.item_id = item.id
      join public.menu_sections section on section.id = placement.section_id
      where item.restaurant_id = restaurant_uuid
        and item.source_system = 'doordash'
        and section.menu_id = menu_uuid
        and section.name in ('Breakfast Burritos', 'Burritos', 'Wet Burritos')) <> 60 then
    raise exception 'Armando batch 1 must cover exactly 60 target placements';
  end if;

  if (select count(*)
      from public.menu_items item
      join public.menu_section_items placement on placement.item_id = item.id
      join public.menu_sections section on section.id = placement.section_id
      where item.restaurant_id = restaurant_uuid
        and item.source_system = 'doordash'
        and section.menu_id = menu_uuid
        and section.name in ('Breakfast Burritos', 'Burritos', 'Wet Burritos')
        and item.is_orderable) <> 60 then
    raise exception 'Every target item must remain orderable';
  end if;

  select id into strict removal_group_uuid
  from public.modifier_groups
  where restaurant_id = restaurant_uuid
    and name = 'Remove ingredients'
    and source_system = 'menu-man-demo'
    and source_group_id = 'remove-ingredients'
    and is_active;

  if (select count(*) from public.modifier_options
      where restaurant_id = restaurant_uuid
        and modifier_group_id = removal_group_uuid
        and is_active) <> 14
     or exists(select 1 from public.modifier_options
       where restaurant_id = restaurant_uuid
         and modifier_group_id = removal_group_uuid
         and is_active
         and (default_price_adjustment_cents <> 0 or is_default)) then
    raise exception 'Removal options must be fourteen active zero-price non-default choices';
  end if;

  if (select count(*)
      from public.menu_item_modifier_groups attachment
      join public.menu_items item on item.id = attachment.menu_item_id
      join public.menu_sections section on section.name in ('Breakfast Burritos', 'Burritos', 'Wet Burritos')
      join public.menu_section_items placement on placement.section_id = section.id and placement.item_id = item.id
      where attachment.restaurant_id = restaurant_uuid
        and attachment.modifier_group_id = removal_group_uuid
        and attachment.is_active
        and item.source_system = 'doordash'
        and section.menu_id = menu_uuid
        and attachment.min_selections = 0
        and attachment.max_selections = 14) <> 60 then
    raise exception 'Each target item must have its optional removal group';
  end if;

  if (select count(*) from public.menu_item_modifier_groups
      where restaurant_id = restaurant_uuid
        and modifier_group_id = removal_group_uuid
        and is_active) <> 60 then
    raise exception 'Removal group must not be attached outside the target batch';
  end if;

  select id into strict extras_group_uuid
  from public.modifier_groups
  where restaurant_id = restaurant_uuid
    and name = 'Add extras'
    and is_active;

  if (select count(*) from public.modifier_options
      where restaurant_id = restaurant_uuid and modifier_group_id = extras_group_uuid and is_active) <> 3
     or not exists(select 1 from public.modifier_options
       where restaurant_id = restaurant_uuid and modifier_group_id = extras_group_uuid
         and name = 'Guacamole' and is_active and default_price_adjustment_cents = 150)
     or not exists(select 1 from public.modifier_options
       where restaurant_id = restaurant_uuid and modifier_group_id = extras_group_uuid
         and name = 'Sour Cream' and is_active and default_price_adjustment_cents = 75)
     or not exists(select 1 from public.modifier_options
       where restaurant_id = restaurant_uuid and modifier_group_id = extras_group_uuid
         and name = 'Cheese' and is_active and default_price_adjustment_cents = 100) then
    raise exception 'Armando Add extras prices must remain $1.50, $0.75, and $1.00';
  end if;

  if (select count(*)
      from public.menu_item_modifier_groups attachment
      join public.menu_items item on item.id = attachment.menu_item_id
      join public.menu_sections section on section.name in ('Burritos', 'Wet Burritos')
      join public.menu_section_items placement on placement.section_id = section.id and placement.item_id = item.id
      where attachment.restaurant_id = restaurant_uuid
        and attachment.modifier_group_id = extras_group_uuid
        and attachment.is_active
        and item.source_system = 'doordash'
        and section.menu_id = menu_uuid
        and attachment.min_selections = 0
        and attachment.max_selections = 3) <> 32 then
    raise exception 'Armando Add extras must attach only to the 32 planned compatible items';
  end if;

  if (select count(*) from public.menu_item_modifier_groups
      where restaurant_id = restaurant_uuid
        and modifier_group_id = extras_group_uuid
        and is_active) <> 32 then
    raise exception 'Add extras must not be attached outside the target batch';
  end if;

  if exists(select 1
    from public.menu_item_modifier_groups attachment
    join public.menu_items item on item.id = attachment.menu_item_id
    join public.modifier_groups modifier_group on modifier_group.id = attachment.modifier_group_id
    join public.modifier_options modifier_option on modifier_option.modifier_group_id = modifier_group.id
    left join public.menu_item_modifier_option_overrides option_override
      on option_override.restaurant_id = restaurant_uuid
      and option_override.menu_item_id = item.id
      and option_override.modifier_option_id = modifier_option.id
    join public.menu_section_items placement on placement.item_id = item.id
    join public.menu_sections section on section.id = placement.section_id
    where attachment.restaurant_id = restaurant_uuid
      and attachment.modifier_group_id = extras_group_uuid
      and attachment.is_active
      and modifier_group.restaurant_id = restaurant_uuid
      and modifier_option.restaurant_id = restaurant_uuid
      and modifier_option.is_active
      and coalesce(option_override.is_active, true)
      and section.menu_id = menu_uuid
      and section.name in ('Burritos', 'Wet Burritos')
      and ((modifier_option.name = 'Guacamole' and concat_ws(' ', item.name, item.description) ~* 'guacamole|avocado')
        or (modifier_option.name = 'Sour Cream' and concat_ws(' ', item.name, item.description) ~* 'sour[[:space:]]*cream')
        or (modifier_option.name = 'Cheese' and concat_ws(' ', item.name, item.description) ~* 'cheese|cheddar|chille?[[:space:]]+relleno'))) then
    raise exception 'An included ingredient is incorrectly offered as a paid extra';
  end if;

  if exists(select 1
    from public.menu_item_modifier_groups attachment
    join public.menu_items item on item.id = attachment.menu_item_id
    join public.modifier_groups modifier_group on modifier_group.id = attachment.modifier_group_id
    join public.menu_section_items placement on placement.item_id = item.id
    join public.menu_sections section on section.id = placement.section_id
    where attachment.restaurant_id = restaurant_uuid
      and item.restaurant_id = restaurant_uuid
      and item.source_system = 'doordash'
      and attachment.is_active
      and section.menu_id = menu_uuid
      and section.name in ('Breakfast Burritos', 'Burritos', 'Wet Burritos')
      and modifier_group.name not in ('Remove ingredients', 'Add extras')) then
    raise exception 'No meat or sauce choice should be added to these fixed-protein items';
  end if;

  if exists(select 1
    from public.menu_item_modifier_groups attachment
    join public.menu_items item on item.id = attachment.menu_item_id
    join public.modifier_groups modifier_group on modifier_group.id = attachment.modifier_group_id
    join public.menu_sections section on section.name in ('Breakfast Burritos', 'Burritos', 'Wet Burritos')
    join public.menu_section_items placement on placement.section_id = section.id and placement.item_id = item.id
    where attachment.restaurant_id = restaurant_uuid
      and attachment.is_active
      and section.menu_id <> menu_uuid
      and modifier_group.name in ('Remove ingredients', 'Add extras')) then
    raise exception 'Customization attachments must stay inside Armando Main Menu';
  end if;
end;
$$;
