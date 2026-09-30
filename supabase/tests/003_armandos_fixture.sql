-- STAGING FIXTURE TEST. The 309 placement count belongs only to the current
-- data/armandos.json fixture; it is not a schema invariant. The schema allows
-- one canonical item to be placed in multiple sections.

do $$
declare
  restaurant_uuid uuid;
  menu_uuid uuid;
begin
  select id into strict restaurant_uuid
  from public.restaurants
  where slug = 'armandos' and is_active = true;

  select id into strict menu_uuid
  from public.menus
  where restaurant_id = restaurant_uuid
    and name = 'Main Menu'
    and is_published = true;

  if (select count(*) from public.menu_sections where menu_id = menu_uuid) <> 26 then
    raise exception 'Armando fixture must contain 26 sections';
  end if;

  if (
    select count(*)
    from public.menu_items
    where restaurant_id = restaurant_uuid
      and source_system = 'doordash'
  ) <> 309 then
    raise exception 'Armando fixture must contain 309 sourced items';
  end if;

  if (
    select count(*)
    from public.menu_section_items placement
    join public.menu_sections section on section.id = placement.section_id
    where section.menu_id = menu_uuid
  ) <> 309 then
    raise exception 'Current Armando fixture must contain 309 placements';
  end if;

  if (
    select count(*)
    from public.restaurant_business_hours
    where restaurant_id = restaurant_uuid
      and not is_closed
  ) <> 7 then
    raise exception 'Armando staging fixture must contain seven open hour rows';
  end if;

  if not exists (
    select 1
    from public.restaurant_ordering_settings
    where restaurant_id = restaurant_uuid
      and pickup_enabled
      and asap_enabled
      and scheduled_pickup_enabled
      and pickup_lead_time_minutes = 15
      and pickup_cutoff_minutes_before_close = 15
      and pickup_slot_interval_minutes = 5
      and advance_order_days = 0
      and tax_strategy = 'restaurant_percentage'
      and tax_rate_basis_points = 875
  ) then
    raise exception 'Armando staging ordering settings do not match the fixture';
  end if;

  if (
    select count(*)
    from public.menu_items
    where restaurant_id = restaurant_uuid
      and is_orderable
  ) <> 307 then
    raise exception 'Armando demo orderability baseline must enable 307 items';
  end if;

  if exists (
    select 1 from public.menu_items
    where restaurant_id = restaurant_uuid
      and source_system = 'doordash'
      and source_item_id in ('359794279', '359796582')
      and is_orderable
  ) then
    raise exception 'Armando 20-taco party packs must remain unavailable';
  end if;

  if (
    select count(*)
    from public.menu_item_modifier_groups attachment
    join public.menu_items item on item.id = attachment.menu_item_id
    where attachment.restaurant_id = restaurant_uuid
      and attachment.is_active
      and item.source_system = 'doordash'
  ) <> 12 then
    raise exception 'Armando baseline must have exactly 12 active required-choice attachments';
  end if;

  if exists (
    select 1
    from public.menu_item_modifier_groups attachment
    join public.modifier_groups modifier_group on modifier_group.id = attachment.modifier_group_id
    where attachment.restaurant_id = restaurant_uuid
      and attachment.is_active
      and modifier_group.name = 'Add extras'
  ) then
    raise exception 'Armando Add extras must have no active item attachments in the orderability baseline';
  end if;
end;
$$;
