-- Fix PL/pgSQL variable/column ambiguity in create_order_v1 for already-migrated environments.
-- The function behavior is otherwise identical to the authoritative checkout v1 definition.

begin;

create or replace function public.create_order_v1(
  p_restaurant_slug text,
  p_idempotency_key text,
  p_request jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  restaurant_record record;
  settings_record record;
  menu_uuid uuid;
  existing_order record;
  v_request_fingerprint text;
  pickup_availability jsonb;
  pickup_mode_value text;
  pickup_at_value timestamptz;
  tip_choice_value text;
  tip_basis_points_value integer;
  subtotal_value bigint := 0;
  tax_value bigint;
  tip_value bigint;
  total_value bigint;
  order_uuid uuid := gen_random_uuid();
  order_number_value bigint;
  line_entry record;
  item_record record;
  group_record record;
  modifier_record record;
  selected_count integer;
  valid_selected_count integer;
  modifier_total bigint;
  unit_total bigint;
  line_total bigint;
  order_item_uuid uuid;
  validated_items jsonb := '[]'::jsonb;
begin
  if p_idempotency_key is null
    or p_idempotency_key !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  then
    raise exception using message = 'MM_INVALID_REQUEST|A valid Idempotency-Key UUID is required.';
  end if;

  select id, currency, timezone
  into restaurant_record
  from public.restaurants
  where slug = p_restaurant_slug
    and is_active = true;

  if not found then
    raise exception using message = 'MM_RESTAURANT_NOT_FOUND|Restaurant not found.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(restaurant_record.id::text || ':' || lower(p_idempotency_key), 0)
  );

  v_request_fingerprint := pg_catalog.encode(
    pg_catalog.sha256(pg_catalog.convert_to(p_request::text, 'UTF8')),
    'hex'
  );

  select o.id, o.request_fingerprint
  into existing_order
  from public.orders o
  where o.restaurant_id = restaurant_record.id
    and o.idempotency_key = lower(p_idempotency_key);

  if found then
    if existing_order.request_fingerprint <> v_request_fingerprint then
      raise exception using message = 'MM_IDEMPOTENCY_CONFLICT|This idempotency key was already used for a different request.';
    end if;
    return public.menu_man_order_response_v1(existing_order.id, true);
  end if;

  select *
  into settings_record
  from public.restaurant_ordering_settings
  where restaurant_id = restaurant_record.id;

  if not found then
    raise exception using message = 'MM_ORDERING_DISABLED|Pickup ordering is not configured.';
  end if;

  if not settings_record.pickup_enabled then
    raise exception using message = 'MM_ORDERING_DISABLED|Pickup ordering is not enabled.';
  end if;

  if restaurant_record.currency is null
    or upper(restaurant_record.currency) !~ '^[A-Z]{3}$'
  then
    raise exception using message = 'MM_ORDERING_DISABLED|The restaurant currency is not configured.';
  end if;

  if settings_record.tax_strategy <> 'restaurant_percentage'
    or settings_record.tax_rate_basis_points is null
  then
    raise exception using message = 'MM_TAX_NOT_CONFIGURED|Server-side percentage tax must be configured before checkout.';
  end if;

  begin
    menu_uuid := (p_request ->> 'menuId')::uuid;
  exception when others then
    raise exception using message = 'MM_INVALID_REQUEST|A valid menu ID is required.';
  end;

  if not exists (
    select 1 from public.menus
    where id = menu_uuid
      and restaurant_id = restaurant_record.id
      and is_published = true
  ) then
    raise exception using message = 'MM_MENU_UNAVAILABLE|The selected menu is not available.';
  end if;

  if jsonb_typeof(p_request -> 'items') <> 'array'
    or jsonb_array_length(p_request -> 'items') < 1
    or jsonb_array_length(p_request -> 'items') > 50
  then
    raise exception using message = 'MM_INVALID_REQUEST|An order must contain between 1 and 50 lines.';
  end if;

  pickup_mode_value := p_request #>> '{pickup,mode}';
  pickup_availability := public.get_pickup_availability_v1(p_restaurant_slug, statement_timestamp());

  if pickup_mode_value = 'asap' then
    if not coalesce((pickup_availability #>> '{asap,available}')::boolean, false) then
      raise exception using message = 'MM_PICKUP_UNAVAILABLE|ASAP pickup is not currently available.';
    end if;
    pickup_at_value := (pickup_availability #>> '{asap,estimatedPickupAt}')::timestamptz;
  elsif pickup_mode_value = 'scheduled' then
    begin
      pickup_at_value := (p_request #>> '{pickup,pickupAt}')::timestamptz;
    exception when others then
      raise exception using message = 'MM_INVALID_REQUEST|A valid scheduled pickup time is required.';
    end;
    if not exists (
      select 1
      from jsonb_array_elements(pickup_availability #> '{scheduled,slots}') slot
      where (slot ->> 'pickupAt')::timestamptz = pickup_at_value
    ) then
      raise exception using message = 'MM_PICKUP_UNAVAILABLE|The selected pickup time is no longer available.';
    end if;
  else
    raise exception using message = 'MM_INVALID_REQUEST|Pickup mode must be asap or scheduled.';
  end if;

  for line_entry in
    select value as line, ordinality::integer - 1 as line_index
    from jsonb_array_elements(p_request -> 'items') with ordinality
  loop
    begin
      select id, name, price_cents, is_orderable
      into item_record
      from public.menu_items
      where id = (line_entry.line ->> 'menuItemId')::uuid
        and restaurant_id = restaurant_record.id;
    exception when others then
      raise exception using message = 'MM_INVALID_REQUEST|A cart line contains an invalid item ID.';
    end;

    if not found then
      raise exception using message = 'MM_ITEM_NOT_ORDERABLE|A cart item is unavailable for ordering.';
    end if;

    if not item_record.is_orderable then
      raise exception using message = 'MM_ITEM_NOT_ORDERABLE|A cart item is unavailable for ordering.';
    end if;

    if not exists (
      select 1
      from public.menu_section_items placement
      join public.menu_sections section on section.id = placement.section_id
      where placement.item_id = item_record.id
        and section.menu_id = menu_uuid
        and section.is_active = true
    ) then
      raise exception using message = 'MM_ITEM_NOT_ON_MENU|A cart item does not belong to the selected menu.';
    end if;

    if (line_entry.line ->> 'quantity')::integer < 1
      or (line_entry.line ->> 'quantity')::integer > 99
    then
      raise exception using message = 'MM_INVALID_REQUEST|Item quantity must be between 1 and 99.';
    end if;

    if jsonb_typeof(line_entry.line -> 'modifierOptionIds') <> 'array'
      or jsonb_array_length(line_entry.line -> 'modifierOptionIds') > 50
    then
      raise exception using message = 'MM_INVALID_REQUEST|Modifier selections are invalid.';
    end if;

    select count(distinct selected.value), count(*)
    into valid_selected_count, selected_count
    from jsonb_array_elements_text(line_entry.line -> 'modifierOptionIds') selected(value);

    if valid_selected_count <> selected_count then
      raise exception using message = 'MM_INVALID_MODIFIERS|Duplicate modifier selections are not allowed.';
    end if;

    select count(*)
    into valid_selected_count
    from jsonb_array_elements_text(line_entry.line -> 'modifierOptionIds') selected(value)
    join public.modifier_options option on option.id = selected.value::uuid
    join public.modifier_groups modifier_group
      on modifier_group.id = option.modifier_group_id
      and modifier_group.restaurant_id = restaurant_record.id
      and modifier_group.is_active = true
    join public.menu_item_modifier_groups attachment
      on attachment.restaurant_id = restaurant_record.id
      and attachment.menu_item_id = item_record.id
      and attachment.modifier_group_id = option.modifier_group_id
      and attachment.is_active = true
    left join public.menu_item_modifier_option_overrides option_override
      on option_override.restaurant_id = restaurant_record.id
      and option_override.menu_item_id = item_record.id
      and option_override.modifier_option_id = option.id
    where option.restaurant_id = restaurant_record.id
      and option.is_active = true
      and coalesce(option_override.is_active, true);

    if valid_selected_count <> selected_count then
      raise exception using message = 'MM_INVALID_MODIFIERS|A selected modifier is inactive, unknown, or unavailable for this item.';
    end if;

    for group_record in
      select attachment.modifier_group_id, attachment.min_selections, attachment.max_selections
      from public.menu_item_modifier_groups attachment
      join public.modifier_groups modifier_group
        on modifier_group.id = attachment.modifier_group_id
        and modifier_group.restaurant_id = restaurant_record.id
        and modifier_group.is_active = true
      where attachment.restaurant_id = restaurant_record.id
        and attachment.menu_item_id = item_record.id
        and attachment.is_active = true
    loop
      select count(*)
      into selected_count
      from jsonb_array_elements_text(line_entry.line -> 'modifierOptionIds') selected(value)
      join public.modifier_options option on option.id = selected.value::uuid
      where option.modifier_group_id = group_record.modifier_group_id;

      if selected_count < group_record.min_selections
        or selected_count > group_record.max_selections
      then
        raise exception using message = 'MM_INVALID_MODIFIERS|Modifier selections do not satisfy an item group minimum or maximum.';
      end if;
    end loop;

    select coalesce(sum(
      coalesce(option_override.price_adjustment_cents, option.default_price_adjustment_cents, 0)
    ), 0)
    into modifier_total
    from jsonb_array_elements_text(line_entry.line -> 'modifierOptionIds') selected(value)
    join public.modifier_options option on option.id = selected.value::uuid
    left join public.menu_item_modifier_option_overrides option_override
      on option_override.restaurant_id = restaurant_record.id
      and option_override.menu_item_id = item_record.id
      and option_override.modifier_option_id = option.id;

    unit_total := item_record.price_cents::bigint + modifier_total;
    line_total := unit_total * (line_entry.line ->> 'quantity')::integer;
    subtotal_value := subtotal_value + line_total;

    if unit_total > 2147483647 or line_total > 2147483647 or subtotal_value > 2147483647 then
      raise exception using message = 'MM_TOTAL_TOO_LARGE|The order total exceeds the supported limit.';
    end if;

    validated_items := validated_items || jsonb_build_array(jsonb_build_object(
      'menuItemId', item_record.id,
      'itemName', item_record.name,
      'basePriceCents', item_record.price_cents,
      'modifierPriceCents', modifier_total,
      'unitPriceCents', unit_total,
      'quantity', (line_entry.line ->> 'quantity')::integer,
      'lineTotalCents', line_total,
      'specialInstructions', line_entry.line ->> 'specialInstructions',
      'sortOrder', line_entry.line_index,
      'modifiers', coalesce((
        select jsonb_agg(jsonb_build_object(
          'modifierGroupId', modifier_group.id,
          'modifierGroupName', modifier_group.name,
          'modifierOptionId', option.id,
          'modifierOptionName', option.name,
          'priceAdjustmentCents', coalesce(option_override.price_adjustment_cents, option.default_price_adjustment_cents, 0),
          'sortOrder', attachment.sort_order * 10000
            + coalesce(option_override.sort_order, option.sort_order)
        ))
        from jsonb_array_elements_text(line_entry.line -> 'modifierOptionIds') selected(value)
        join public.modifier_options option on option.id = selected.value::uuid
        join public.modifier_groups modifier_group on modifier_group.id = option.modifier_group_id
        join public.menu_item_modifier_groups attachment
          on attachment.menu_item_id = item_record.id
          and attachment.modifier_group_id = option.modifier_group_id
        left join public.menu_item_modifier_option_overrides option_override
          on option_override.menu_item_id = item_record.id
          and option_override.modifier_option_id = option.id
      ), '[]'::jsonb)
    ));
  end loop;

  tip_choice_value := p_request ->> 'tipChoice';
  tip_basis_points_value := case tip_choice_value
    when 'none' then 0
    when '10_percent' then 1000
    when '15_percent' then 1500
    when '20_percent' then 2000
    else null
  end;

  if tip_basis_points_value is null then
    raise exception using message = 'MM_INVALID_REQUEST|Tip choice is invalid.';
  end if;

  tax_value := round(
    subtotal_value::numeric * settings_record.tax_rate_basis_points::numeric / 10000
  )::bigint;
  tip_value := round(
    subtotal_value::numeric * tip_basis_points_value::numeric / 10000
  )::bigint;
  total_value := subtotal_value + tax_value + tip_value;

  if total_value > 2147483647 then
    raise exception using message = 'MM_TOTAL_TOO_LARGE|The order total exceeds the supported limit.';
  end if;

  insert into public.restaurant_order_counters (restaurant_id, last_order_number)
  values (restaurant_record.id, 1001)
  on conflict (restaurant_id) do update
  set last_order_number = public.restaurant_order_counters.last_order_number + 1
  returning last_order_number into order_number_value;

  insert into public.orders (
    id,
    restaurant_id,
    menu_id,
    order_number,
    idempotency_key,
    request_fingerprint,
    order_status,
    payment_status,
    customer_name,
    customer_phone,
    customer_email,
    special_instructions,
    pickup_mode,
    pickup_at,
    pickup_timezone,
    currency,
    subtotal_cents,
    tax_strategy,
    tax_rate_basis_points,
    tax_cents,
    tip_basis_points,
    tip_cents,
    total_cents
  ) values (
    order_uuid,
    restaurant_record.id,
    menu_uuid,
    order_number_value,
    lower(p_idempotency_key),
    v_request_fingerprint,
    'pending_payment',
    'unpaid',
    p_request #>> '{customer,name}',
    p_request #>> '{customer,phone}',
    p_request #>> '{customer,email}',
    p_request ->> 'orderNotes',
    pickup_mode_value,
    pickup_at_value,
    restaurant_record.timezone,
    upper(restaurant_record.currency),
    subtotal_value::integer,
    settings_record.tax_strategy,
    settings_record.tax_rate_basis_points,
    tax_value::integer,
    tip_basis_points_value,
    tip_value::integer,
    total_value::integer
  );

  for line_entry in
    select value as line
    from jsonb_array_elements(validated_items)
    order by (value ->> 'sortOrder')::integer
  loop
    order_item_uuid := gen_random_uuid();
    insert into public.order_items (
      id,
      restaurant_id,
      order_id,
      menu_item_id,
      sort_order,
      item_name,
      base_price_cents,
      modifier_price_cents,
      unit_price_cents,
      quantity,
      line_total_cents,
      special_instructions
    ) values (
      order_item_uuid,
      restaurant_record.id,
      order_uuid,
      (line_entry.line ->> 'menuItemId')::uuid,
      (line_entry.line ->> 'sortOrder')::integer,
      line_entry.line ->> 'itemName',
      (line_entry.line ->> 'basePriceCents')::integer,
      (line_entry.line ->> 'modifierPriceCents')::integer,
      (line_entry.line ->> 'unitPriceCents')::integer,
      (line_entry.line ->> 'quantity')::integer,
      (line_entry.line ->> 'lineTotalCents')::integer,
      line_entry.line ->> 'specialInstructions'
    );

    for modifier_record in
      select value as modifier
      from jsonb_array_elements(line_entry.line -> 'modifiers')
      order by (value ->> 'sortOrder')::integer
    loop
      insert into public.order_item_modifiers (
        restaurant_id,
        order_item_id,
        modifier_group_id,
        modifier_option_id,
        sort_order,
        modifier_group_name,
        modifier_option_name,
        price_adjustment_cents
      ) values (
        restaurant_record.id,
        order_item_uuid,
        (modifier_record.modifier ->> 'modifierGroupId')::uuid,
        (modifier_record.modifier ->> 'modifierOptionId')::uuid,
        (modifier_record.modifier ->> 'sortOrder')::integer,
        modifier_record.modifier ->> 'modifierGroupName',
        modifier_record.modifier ->> 'modifierOptionName',
        (modifier_record.modifier ->> 'priceAdjustmentCents')::integer
      );
    end loop;
  end loop;

  return public.menu_man_order_response_v1(order_uuid, false);
end;
$$;

commit;

