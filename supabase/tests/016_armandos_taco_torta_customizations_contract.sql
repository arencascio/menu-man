-- Read-only staging contract for Armando's provisional taco/torta customization batch 2.
do $$
declare
  tenant uuid;
  menu uuid;
  removal_group uuid;
  extras_group uuid;
  meat_group uuid;
begin
  select id into strict tenant from public.restaurants where slug='armandos' and is_active;
  select id into strict menu from public.menus where restaurant_id=tenant and name='Main Menu' and is_published;

  if (select count(*) from public.menu_items item join public.menu_section_items placement on placement.item_id=item.id join public.menu_sections section on section.id=placement.section_id where item.restaurant_id=tenant and item.source_system='doordash' and section.menu_id=menu and section.name in ('Street Tacos','Tacos','Tortas','Sopes','Tostadas')) <> 59 then
    raise exception 'Batch 2 must cover 59 planned placements';
  end if;
  if (select count(*) from public.menu_items item join public.menu_section_items placement on placement.item_id=item.id join public.menu_sections section on section.id=placement.section_id where item.restaurant_id=tenant and item.source_system='doordash' and section.menu_id=menu and section.name in ('Street Tacos','Tacos','Tortas','Sopes','Tostadas') and item.is_orderable) <> 57 then
    raise exception 'Batch 2 must retain 57 orderable items';
  end if;
  if (select count(*) from public.menu_items item join public.menu_section_items placement on placement.item_id=item.id join public.menu_sections section on section.id=placement.section_id where item.restaurant_id=tenant and item.source_system='doordash' and section.menu_id=menu and section.name='Street Tacos' and item.source_item_id in ('359794279','359796582') and not item.is_orderable and item.name in ('Special Packet #1 - 20 Mini Tacos','Special Packet #2 - 20 Mini Tacos with Rice and Beans')) <> 2 then
    raise exception 'The two held 20-taco party packs must remain unchanged and unavailable';
  end if;
  if (select count(*) from public.menu_items where restaurant_id=tenant and is_orderable) <> 307 then
    raise exception 'Whole menu must remain at 307 orderable items';
  end if;

  select id into strict removal_group from public.modifier_groups where restaurant_id=tenant and name='Remove ingredients' and source_system='menu-man-demo' and source_group_id='remove-ingredients' and is_active;
  select id into strict extras_group from public.modifier_groups where restaurant_id=tenant and name='Add extras' and is_active;
  select id into strict meat_group from public.modifier_groups where restaurant_id=tenant and name='Choose your meat' and source_system='menu-man-test' and source_group_id='choose-meat' and is_active;
  if (select count(*) from public.modifier_options where restaurant_id=tenant and modifier_group_id=removal_group and is_active) <> 14
     or exists(select 1 from public.modifier_options where restaurant_id=tenant and modifier_group_id=removal_group and is_active and (default_price_adjustment_cents<>0 or is_default)) then
    raise exception 'Removal choices must be active, non-default, and zero-price';
  end if;
  if (select count(*) from public.modifier_options where restaurant_id=tenant and modifier_group_id=extras_group and is_active) <> 3
     or not exists(select 1 from public.modifier_options where restaurant_id=tenant and modifier_group_id=extras_group and name='Guacamole' and is_active and default_price_adjustment_cents=150)
     or not exists(select 1 from public.modifier_options where restaurant_id=tenant and modifier_group_id=extras_group and name='Sour Cream' and is_active and default_price_adjustment_cents=75)
     or not exists(select 1 from public.modifier_options where restaurant_id=tenant and modifier_group_id=extras_group and name='Cheese' and is_active and default_price_adjustment_cents=100) then
    raise exception 'Existing Add extras prices must remain $1.50, $0.75, and $1.00';
  end if;

  if (select count(*) from public.menu_item_modifier_groups attachment join public.menu_items item on item.id=attachment.menu_item_id join public.menu_section_items placement on placement.item_id=item.id join public.menu_sections section on section.id=placement.section_id where attachment.restaurant_id=tenant and attachment.modifier_group_id=removal_group and attachment.is_active and attachment.min_selections=0 and attachment.max_selections=14 and item.source_system='doordash' and section.menu_id=menu and section.name in ('Street Tacos','Tacos','Tortas','Sopes','Tostadas')) <> 56 then
    raise exception 'Expected exactly 56 item-specific removal attachments';
  end if;
  if (select count(*) from public.menu_item_modifier_groups attachment join public.menu_items item on item.id=attachment.menu_item_id join public.menu_section_items placement on placement.item_id=item.id join public.menu_sections section on section.id=placement.section_id where attachment.restaurant_id=tenant and attachment.modifier_group_id=extras_group and attachment.is_active and attachment.min_selections=0 and attachment.max_selections=3 and item.source_system='doordash' and section.menu_id=menu and section.name in ('Street Tacos','Tacos','Tortas','Sopes','Tostadas')) <> 42 then
    raise exception 'Expected exactly 42 compatible paid extras attachments';
  end if;
  if (select count(*) from public.menu_item_modifier_groups attachment join public.menu_items item on item.id=attachment.menu_item_id where attachment.restaurant_id=tenant and item.source_system='doordash' and item.source_item_id='445069647' and attachment.modifier_group_id=meat_group and attachment.is_active and attachment.min_selections=1 and attachment.max_selections=1) <> 1
     or (select count(*) from public.modifier_options option where option.restaurant_id=tenant and option.modifier_group_id=meat_group and option.is_active) = 0 then
    raise exception 'Torta with Fries must retain its existing required meat choice and valid option path';
  end if;
  if exists(select 1 from public.menu_item_modifier_groups attachment join public.menu_items item on item.id=attachment.menu_item_id join public.menu_sections section on section.name in ('Street Tacos','Tacos','Tortas','Sopes','Tostadas') join public.menu_section_items placement on placement.section_id=section.id and placement.item_id=item.id join public.modifier_groups group_row on group_row.id=attachment.modifier_group_id where attachment.restaurant_id=tenant and attachment.is_active and item.source_system='doordash' and section.menu_id=menu and group_row.name='Choose your meat' and item.source_item_id<>'445069647') then
    raise exception 'A fixed-protein item received a meat selector';
  end if;
  if exists(select 1 from public.menu_item_modifier_groups attachment join public.menu_items item on item.id=attachment.menu_item_id join public.menu_sections section on section.name in ('Street Tacos','Tacos','Tortas','Sopes','Tostadas') join public.menu_section_items placement on placement.section_id=section.id and placement.item_id=item.id join public.modifier_groups group_row on group_row.id=attachment.modifier_group_id where attachment.restaurant_id=tenant and attachment.is_active and item.source_system='doordash' and section.menu_id=menu and group_row.name not in ('Remove ingredients','Add extras','Choose your meat')) then
    raise exception 'Unexpected active group attached in batch 2 sections';
  end if;

  if exists(
    select 1 from public.menu_item_modifier_groups attachment
    join public.menu_items item on item.id=attachment.menu_item_id and item.restaurant_id=tenant
    join public.modifier_groups group_row on group_row.id=attachment.modifier_group_id and group_row.restaurant_id=tenant and group_row.id=removal_group
    join public.modifier_options option on option.modifier_group_id=group_row.id and option.restaurant_id=tenant and option.is_active
    left join public.menu_item_modifier_option_overrides override on override.restaurant_id=tenant and override.menu_item_id=item.id and override.modifier_option_id=option.id
    join public.menu_section_items placement on placement.item_id=item.id
    join public.menu_sections section on section.id=placement.section_id
    where attachment.restaurant_id=tenant and attachment.is_active and item.source_system='doordash' and section.menu_id=menu and section.name in ('Street Tacos','Tacos','Tortas','Sopes','Tostadas')
      and coalesce(override.is_active,true)
      and not (
        (option.source_option_id='guacamole' and concat_ws(' ',item.name,item.description) ~* 'guacamole|avocado') or
        (option.source_option_id='pico' and concat_ws(' ',item.name,item.description) ~* 'pico|pic.{0,3}[[:space:]]*de gallo') or
        (option.source_option_id='cheese' and concat_ws(' ',item.name,item.description) ~* 'cheese') or
        (option.source_option_id='sour-cream' and concat_ws(' ',item.name,item.description) ~* 'sour[[:space:]]*cream') or
        (option.source_option_id='beans' and concat_ws(' ',item.name,item.description) ~* 'beans?') or
        (option.source_option_id='rice' and concat_ws(' ',item.name,item.description) ~* 'rice') or
        (option.source_option_id='onion' and concat_ws(' ',item.name,item.description) ~* 'onion') or
        (option.source_option_id='cilantro' and concat_ws(' ',item.name,item.description) ~* 'cilantro') or
        (option.source_option_id='fries' and concat_ws(' ',item.name,item.description) ~* 'fries') or
        (option.source_option_id='cabbage' and concat_ws(' ',item.name,item.description) ~* 'cabbage') or
        (option.source_option_id='lettuce' and concat_ws(' ',item.name,item.description) ~* 'lettuce') or
        (option.source_option_id='potatoes' and concat_ws(' ',item.name,item.description) ~* 'potato') or
        (option.source_option_id='bell-peppers' and concat_ws(' ',item.name,item.description) ~* 'bell peppers?|green peppers?') or
        (option.source_option_id='avocado' and concat_ws(' ',item.name,item.description) ~* 'avocado')
      )
  ) then raise exception 'An item exposes a removal for an ingredient absent from its copy'; end if;

  if exists(
    select 1 from public.menu_item_modifier_groups attachment
    join public.menu_items item on item.id=attachment.menu_item_id and item.restaurant_id=tenant
    join public.modifier_groups group_row on group_row.id=attachment.modifier_group_id and group_row.restaurant_id=tenant and group_row.id=extras_group
    join public.modifier_options option on option.modifier_group_id=group_row.id and option.restaurant_id=tenant and option.is_active
    left join public.menu_item_modifier_option_overrides override on override.restaurant_id=tenant and override.menu_item_id=item.id and override.modifier_option_id=option.id
    join public.menu_section_items placement on placement.item_id=item.id
    join public.menu_sections section on section.id=placement.section_id
    where attachment.restaurant_id=tenant and attachment.is_active and item.source_system='doordash' and section.menu_id=menu and section.name in ('Street Tacos','Tacos','Tortas','Sopes','Tostadas')
      and coalesce(override.is_active,true)
      and ((option.name='Guacamole' and concat_ws(' ',item.name,item.description) ~* 'guacamole|avocado')
        or (option.name='Sour Cream' and concat_ws(' ',item.name,item.description) ~* 'sour[[:space:]]*cream')
        or (option.name='Cheese' and concat_ws(' ',item.name,item.description) ~* 'cheese'))
  ) then raise exception 'An included paid extra is being offered as an ordinary extra'; end if;

  if exists(select 1 from public.menu_item_modifier_groups attachment join public.menu_items item on item.id=attachment.menu_item_id join public.modifier_groups group_row on group_row.id=attachment.modifier_group_id join public.menu_section_items placement on placement.item_id=item.id join public.menu_sections section on section.id=placement.section_id where attachment.restaurant_id=tenant and attachment.is_active and item.source_system='doordash' and section.menu_id=menu and section.name in ('Street Tacos','Tacos','Tortas','Sopes','Tostadas') and (attachment.min_selections<0 or attachment.max_selections<attachment.min_selections or (group_row.id in (removal_group,extras_group) and attachment.min_selections<>0))) then
    raise exception 'A customization attachment has invalid selection bounds';
  end if;
end;
$$;
