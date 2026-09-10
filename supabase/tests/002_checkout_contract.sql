-- STAGING CONTRACT TEST. Run only after the ordered Armando staging seed.
-- The outer transaction rolls back the generated order and counter change.

begin;

do $$
declare
  restaurant_uuid uuid;
  menu_uuid uuid;
  item_uuid uuid;
  chicken_option_uuid uuid;
  idempotency_uuid uuid := gen_random_uuid();
  availability jsonb;
  pickup_at_value text;
  request_payload jsonb;
  first_response jsonb;
  replay_response jsonb;
  base_price integer;
  expected_tax integer;
begin
  select id into strict restaurant_uuid
  from public.restaurants
  where slug = 'armandos' and is_active = true;

  select id into strict menu_uuid
  from public.menus
  where restaurant_id = restaurant_uuid and is_published = true;

  select id, price_cents into strict item_uuid, base_price
  from public.menu_items
  where restaurant_id = restaurant_uuid
    and source_system = 'doordash'
    and source_item_id = '198880505'
    and is_orderable = true;

  select option.id into strict chicken_option_uuid
  from public.modifier_options option
  join public.modifier_groups modifier_group
    on modifier_group.id = option.modifier_group_id
  where option.restaurant_id = restaurant_uuid
    and option.source_system = 'menu-man-test'
    and option.source_option_id = 'chicken'
    and option.is_active
    and modifier_group.is_active;

  availability := public.get_pickup_availability_v1('armandos', statement_timestamp());
  select slot ->> 'pickupAt'
  into pickup_at_value
  from jsonb_array_elements(availability #> '{scheduled,slots}') slot
  order by (slot ->> 'pickupAt')::timestamptz
  limit 1;

  if pickup_at_value is null then
    raise exception 'Staging fixture produced no scheduled pickup slots';
  end if;

  request_payload := jsonb_build_object(
    'menuId', menu_uuid,
    'items', jsonb_build_array(jsonb_build_object(
      'menuItemId', item_uuid,
      'quantity', 1,
      'modifierOptionIds', jsonb_build_array(chicken_option_uuid),
      'specialInstructions', null
    )),
    'customer', jsonb_build_object(
      'name', 'Checkout Contract Test',
      'phone', '555-0100',
      'email', null
    ),
    'pickup', jsonb_build_object(
      'mode', 'scheduled',
      'pickupAt', pickup_at_value
    ),
    'tipChoice', 'none',
    'orderNotes', null
  );

  first_response := public.create_order_v1(
    'armandos',
    idempotency_uuid::text,
    request_payload
  );

  expected_tax := round(base_price::numeric * 875 / 10000)::integer;

  if first_response ->> 'orderStatus' <> 'pending_payment'
    or first_response ->> 'paymentStatus' <> 'unpaid'
    or (first_response ->> 'subtotalCents')::integer <> base_price
    or (first_response ->> 'taxCents')::integer <> expected_tax
    or (first_response ->> 'tipCents')::integer <> 0
    or (first_response ->> 'totalCents')::integer <> base_price + expected_tax
    or (first_response ->> 'replayed')::boolean
  then
    raise exception 'Unexpected first checkout response: %', first_response;
  end if;

  replay_response := public.create_order_v1(
    'armandos',
    idempotency_uuid::text,
    request_payload
  );

  if replay_response ->> 'orderId' <> first_response ->> 'orderId'
    or replay_response ->> 'orderNumber' <> first_response ->> 'orderNumber'
    or not (replay_response ->> 'replayed')::boolean
  then
    raise exception 'Idempotent replay did not return the original order';
  end if;

  if (
    select count(*)
    from public.orders
    where restaurant_id = restaurant_uuid
      and idempotency_key = idempotency_uuid::text
  ) <> 1 then
    raise exception 'Idempotent checkout created more than one order';
  end if;

  if (
    select count(*)
    from public.order_items
    where order_id = (first_response ->> 'orderId')::uuid
  ) <> 1 then
    raise exception 'Checkout did not create exactly one item snapshot';
  end if;

  if (
    select count(*)
    from public.order_item_modifiers modifier_snapshot
    join public.order_items item_snapshot
      on item_snapshot.id = modifier_snapshot.order_item_id
    where item_snapshot.order_id = (first_response ->> 'orderId')::uuid
  ) <> 1 then
    raise exception 'Checkout did not create the selected modifier snapshot';
  end if;

  begin
    perform public.create_order_v1(
      'armandos',
      idempotency_uuid::text,
      jsonb_set(request_payload, '{items,0,quantity}', '2'::jsonb)
    );
    raise exception 'Expected an idempotency conflict';
  exception when others then
    if position('MM_IDEMPOTENCY_CONFLICT' in sqlerrm) = 0 then
      raise;
    end if;
  end;
end;
$$;

rollback;
