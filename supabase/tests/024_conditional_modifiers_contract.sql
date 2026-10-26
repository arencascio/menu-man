-- Run only in a separately authorized disposable database with ON_ERROR_STOP.
-- after all migrations including 20261026075607. Never run against Production.
-- Synthetic tenant only; all catalog, order and counter changes roll back.
begin;

do $$
declare
  tenant uuid := gen_random_uuid();
  other_tenant uuid := gen_random_uuid();
  tenant_slug text := 'conditional-contract-' || gen_random_uuid()::text;
  menu uuid := gen_random_uuid();
  section uuid := gen_random_uuid();
  dish uuid := gen_random_uuid();
  root_group uuid := gen_random_uuid();
  optional_group uuid := gen_random_uuid();
  required_group uuid := gen_random_uuid();
  foreign_group uuid := gen_random_uuid();
  chips uuid := gen_random_uuid();
  carrots uuid := gen_random_uuid();
  drink uuid := gen_random_uuid();
  ranch uuid := gen_random_uuid();
  cola uuid := gen_random_uuid();
  foreign_option uuid := gen_random_uuid();
  slot text;
  request jsonb;
  candidate jsonb;
  choices jsonb;
  result jsonb;
  order_id_value uuid;
  order_count bigint;
  conditional_key text := gen_random_uuid()::text;
  conditional_request jsonb;
  conditional_order uuid;
begin
  insert into public.restaurants(id, name, slug, timezone) values
    (tenant, 'Conditional contract', tenant_slug, 'UTC'),
    (other_tenant, 'Other conditional contract', 'conditional-other-' || other_tenant::text, 'UTC');
  insert into public.restaurant_business_hours(restaurant_id, day_of_week, open_time, close_time)
    select tenant, day, '00:00'::time, '23:59'::time from generate_series(0,6) day;
  insert into public.restaurant_ordering_settings(restaurant_id, pickup_enabled, asap_enabled,
    scheduled_pickup_enabled, advance_order_days, tax_strategy, tax_rate_basis_points)
    values (tenant, true, true, true, 2, 'restaurant_percentage', 0);
  insert into public.menus(id, restaurant_id, name, is_published) values(menu, tenant, 'Contract', true);
  insert into public.menu_sections(id, menu_id, name) values(section, menu, 'Contract');
  insert into public.menu_items(id, restaurant_id, name, price_cents, is_orderable)
    values(dish, tenant, 'Dish', 1000, true);
  insert into public.menu_section_items(section_id, item_id) values(section, dish);
  insert into public.modifier_groups(id, restaurant_id, name) values
    (root_group, tenant, 'Side'), (optional_group, tenant, 'Ranch'),
    (required_group, tenant, 'Flavor'), (foreign_group, other_tenant, 'Other');
  insert into public.modifier_options(id, restaurant_id, modifier_group_id, name, default_price_adjustment_cents) values
    (chips, tenant, root_group, 'Chips', 0), (carrots, tenant, root_group, 'Carrots', 0),
    (drink, tenant, root_group, 'Drink', 200), (ranch, tenant, optional_group, 'Ranch', 50),
    (cola, tenant, required_group, 'Cola', 100), (foreign_option, other_tenant, foreign_group, 'Foreign', 900);
  insert into public.menu_item_modifier_groups(restaurant_id, menu_item_id, modifier_group_id, min_selections, max_selections)
    values(tenant, dish, root_group, 1, 1);
  insert into public.menu_item_modifier_groups(restaurant_id, menu_item_id, modifier_group_id,
    min_selections, max_selections, parent_modifier_group_id, parent_modifier_option_id) values
    (tenant, dish, optional_group, 0, 1, root_group, carrots),
    (tenant, dish, required_group, 1, 1, root_group, drink);
  select entry ->> 'pickupAt' into strict slot from jsonb_array_elements(
    public.get_pickup_availability_v1(tenant_slug, statement_timestamp()) #> '{scheduled,slots}') entry
    where (entry ->> 'pickupAt')::timestamptz > clock_timestamp() + interval '2 hours'
    order by (entry ->> 'pickupAt')::timestamptz limit 1;
  request := jsonb_build_object('menuId', menu, 'items', jsonb_build_array(jsonb_build_object(
    'menuItemId', dish, 'quantity', 2, 'modifierOptionIds', jsonb_build_array(chips), 'specialInstructions', null)),
    'customer', jsonb_build_object('name', 'Synthetic Guest', 'phone', '(951) 555-0100', 'email', 'conditional@example.invalid'),
    'pickup', jsonb_build_object('mode', 'scheduled', 'pickupAt', slot), 'tipChoice', 'none', 'orderNotes', null);

  -- Existing root choices, optional child omitted, and optional child selected.
  foreach choices in array array[jsonb_build_array(chips), jsonb_build_array(carrots), jsonb_build_array(carrots, ranch)] loop
    candidate := jsonb_set(request, '{items,0,modifierOptionIds}', choices);
    result := public.create_order_v1(tenant_slug, gen_random_uuid()::text, candidate);
    if (result ->> 'subtotalCents')::integer <> (case when choices ? ranch::text then 2100 else 2000 end) then
      raise exception 'Optional child pricing failed: %', result;
    end if;
  end loop;
  -- Required active child and canonical item-specific override (zero must be honored).
  result := public.create_order_v1(tenant_slug, gen_random_uuid()::text,
    jsonb_set(request, '{items,0,modifierOptionIds}', jsonb_build_array(drink, cola)));
  if (result ->> 'subtotalCents')::integer <> 2600 then raise exception 'Child upcharge failed'; end if;
  insert into public.menu_item_modifier_option_overrides(restaurant_id, menu_item_id, modifier_group_id,
    modifier_option_id, price_adjustment_cents) values(tenant, dish, required_group, cola, 0);
  candidate := jsonb_set(request, '{items,0,modifierOptionIds}', jsonb_build_array(drink, cola));
  -- Deliberately forged price fields cannot override canonical database pricing.
  candidate := jsonb_set(candidate, '{items,0,price_cents}', '1');
  conditional_request := candidate;
  result := public.create_order_v1(tenant_slug, conditional_key, conditional_request);
  if (result ->> 'subtotalCents')::integer <> 2400 then raise exception 'Canonical price override failed'; end if;
  order_id_value := (result ->> 'orderId')::uuid;
  conditional_order := order_id_value;
  if not exists (select 1 from public.order_items where order_id = order_id_value
      and quantity = 2 and unit_price_cents = 1200 and modifier_price_cents = 200)
    or (select count(*) from public.order_item_modifiers m join public.order_items i on i.id = m.order_item_id
      where i.order_id = order_id_value) <> 2 then
    raise exception 'Active child order snapshots failed';
  end if;

  -- Inactive, stale, wrong-parent, missing required child and cross-tenant IDs.
  select count(*) into order_count from public.orders where restaurant_id = tenant;
  foreach choices in array array[jsonb_build_array(chips,ranch), jsonb_build_array(chips,cola),
    jsonb_build_array(drink,ranch), jsonb_build_array(drink), jsonb_build_array(chips,foreign_option)] loop
    candidate := jsonb_set(request, '{items,0,modifierOptionIds}', choices);
    begin
      perform public.create_order_v1(tenant_slug, gen_random_uuid()::text, candidate);
      raise exception 'Expected inactive/invalid modifier rejection';
    exception when others then
      if sqlerrm not like 'MM_INVALID_MODIFIERS|%' then raise; end if;
    end;
  end loop;
  if (select count(*) from public.orders where restaurant_id = tenant) <> order_count then
    raise exception 'Rejected selections persisted an order';
  end if;
  -- Switching back to the root choice cannot carry a payable stale child.
  result := public.create_order_v1(tenant_slug, gen_random_uuid()::text, request);
  order_id_value := (result ->> 'orderId')::uuid;
  if (result ->> 'subtotalCents')::integer <> 2000
    or exists (select 1 from public.order_item_modifiers m join public.order_items i on i.id = m.order_item_id
      where i.order_id = order_id_value and m.modifier_option_id in (ranch, cola)) then
    raise exception 'Parent switch left payable child selections';
  end if;
  -- The public RPC remains service-only; helper/core functions are not public APIs.
  if not has_function_privilege('service_role','public.create_order_v1(text,text,jsonb)','EXECUTE')
    or has_function_privilege('anon','public.create_order_v1(text,text,jsonb)','EXECUTE')
    or has_function_privilege('authenticated','public.create_order_v1(text,text,jsonb)','EXECUTE')
    or has_function_privilege('service_role','public.create_order_core_v1(text,text,jsonb)','EXECUTE')
    or has_function_privilege('service_role','private.modifier_attachment_active_v1(uuid,uuid,uuid,jsonb)','EXECUTE') then
    raise exception 'Conditional checkout privileges changed';
  end if;
  -- Parent item override disabled: child cannot reactivate it.
  insert into public.menu_item_modifier_option_overrides(restaurant_id, menu_item_id, modifier_group_id,
    modifier_option_id, is_active) values(tenant, dish, root_group, drink, false);
  begin
    perform public.create_order_v1(tenant_slug, gen_random_uuid()::text,
      jsonb_set(request, '{items,0,modifierOptionIds}', jsonb_build_array(drink,cola)));
    raise exception 'Expected disabled-parent rejection';
  exception when others then
    if sqlerrm not like 'MM_INVALID_MODIFIERS|%' then raise; end if;
  end;
  -- A committed conditional order replays its original snapshot after availability changes.
  result := public.create_order_v1(tenant_slug, conditional_key, conditional_request);
  if not (result ->> 'replayed')::boolean or (result ->> 'orderId')::uuid <> conditional_order
    or (result ->> 'subtotalCents')::integer <> 2400 then
    raise exception 'Committed conditional order did not replay its original snapshot';
  end if;
  begin
    perform public.create_order_v1(tenant_slug, conditional_key,
      jsonb_set(conditional_request,'{items,0,modifierOptionIds}',jsonb_build_array(chips)));
    raise exception 'Expected conditional replay conflict';
  exception when others then
    if sqlerrm not like 'MM_IDEMPOTENCY_CONFLICT|%' then raise; end if;
  end;
  -- Relationship constraints reject cross-tenant parents and deeper nesting.
  begin
    insert into public.menu_item_modifier_groups(restaurant_id,menu_item_id,modifier_group_id,
      min_selections,max_selections,parent_modifier_group_id,parent_modifier_option_id)
    values(tenant,dish,optional_group,1,1,root_group,drink);
    raise exception 'Expected conflicting child attachment rejection';
  exception when unique_violation then null;
  end;
  begin
    update public.menu_item_modifier_groups set parent_modifier_option_id = cola
      where menu_item_id = dish and modifier_group_id = optional_group;
    raise exception 'Expected wrong-group parent option rejection';
  exception when foreign_key_violation then null;
  end;
  begin
    update public.menu_item_modifier_groups set parent_modifier_option_id = null
      where menu_item_id = dish and modifier_group_id = optional_group;
    raise exception 'Expected incomplete parent relationship rejection';
  exception when check_violation then null;
  end;
  begin
    update public.menu_item_modifier_groups set parent_modifier_group_id = foreign_group,
      parent_modifier_option_id = foreign_option where menu_item_id = dish and modifier_group_id = optional_group;
    raise exception 'Expected foreign-parent rejection';
  exception when others then
    if sqlerrm not like 'Conditional modifiers support%' and sqlstate <> '23503' then raise; end if;
  end;
  begin
    update public.menu_item_modifier_groups set parent_modifier_group_id = optional_group,
      parent_modifier_option_id = ranch where menu_item_id = dish and modifier_group_id = required_group;
    raise exception 'Expected depth rejection';
  exception when others then
    if sqlerrm not like 'Conditional modifiers support%' then raise; end if;
  end;
  begin
    update public.menu_item_modifier_groups set parent_modifier_group_id = root_group,
      parent_modifier_option_id = chips where menu_item_id = dish and modifier_group_id = root_group;
    raise exception 'Expected self-parent rejection';
  exception when others then
    if sqlerrm not like 'Conditional modifiers support%' and sqlstate <> '23514' then raise; end if;
  end;
end;
$$;
rollback;
