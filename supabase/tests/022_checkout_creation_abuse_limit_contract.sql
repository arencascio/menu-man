-- Run with ON_ERROR_STOP after 202610010002. All fixture changes roll back.
begin;

do $$
declare
  restaurant_uuid uuid;
  other_restaurant_uuid uuid;
  menu_uuid uuid;
  item_uuid uuid;
  option_uuid uuid;
  pickup_at_value text;
  request_payload jsonb;
  result jsonb;
  replay_result jsonb;
  first_key text := gen_random_uuid()::text;
  second_key text := gen_random_uuid()::text;
  rejected_key text := gen_random_uuid()::text;
  rollover_key text := gen_random_uuid()::text;
  local_key text := gen_random_uuid()::text;
  invalid_key text := gen_random_uuid()::text;
  first_order uuid;
  audit_source_hash text := encode(gen_random_bytes(32), 'hex');
  current_window timestamptz;
  order_counter bigint;
  reservation_count bigint;
  payment_count bigint;
  session_count bigint;
begin
  select id into strict restaurant_uuid from public.restaurants
    where slug = 'armandos' and is_active;
  select id into strict other_restaurant_uuid from public.restaurants
    where slug = 'test-kitchen';
  select id into strict menu_uuid from public.menus
    where restaurant_id = restaurant_uuid and is_published;
  select id into strict item_uuid from public.menu_items
    where restaurant_id = restaurant_uuid and source_system = 'doordash'
      and source_item_id = '198880505' and is_orderable;
  select id into strict option_uuid from public.modifier_options
    where restaurant_id = restaurant_uuid and source_system = 'menu-man-test'
      and source_option_id = 'chicken' and is_active;

  update public.restaurant_ordering_settings
    set advance_order_days = 1, pickup_max_orders_per_interval = 1000
    where restaurant_id = restaurant_uuid;
  select slot ->> 'pickupAt' into strict pickup_at_value
    from jsonb_array_elements(public.get_pickup_availability_v1(
      'armandos', statement_timestamp()) #> '{scheduled,slots}') slot
    where (slot ->> 'pickupAt')::timestamptz >= clock_timestamp() + interval '2 hours'
    order by (slot ->> 'pickupAt')::timestamptz limit 1;
  request_payload := jsonb_build_object(
    'menuId', menu_uuid,
    'items', jsonb_build_array(jsonb_build_object(
      'menuItemId', item_uuid, 'quantity', 1,
      'modifierOptionIds', jsonb_build_array(option_uuid),
      'specialInstructions', null)),
    'customer', jsonb_build_object('name', 'CHECKOUT LIMIT CONTRACT',
      'phone', '(951) 555-0100', 'email', 'checkout-limit@example.invalid'),
    'pickup', jsonb_build_object('mode', 'scheduled', 'pickupAt', pickup_at_value),
    'tipChoice', 'none', 'orderNotes', null);
  current_window := date_bin('10 minutes'::interval,
    clock_timestamp(), '2000-01-01 00:00:00+00'::timestamptz);

  -- Another restaurant's saturated window must not block this one.
  insert into public.checkout_creation_windows
    (restaurant_id, source_hash, window_start, creation_count)
    values (other_restaurant_uuid, audit_source_hash, current_window, 120);
  result := public.create_order_with_abuse_limit_v1(
    'armandos', first_key, request_payload, audit_source_hash);
  first_order := (result ->> 'orderId')::uuid;
  if (result ->> 'replayed')::boolean is true
    or (select creation_count from public.checkout_creation_windows
      where restaurant_id = restaurant_uuid and source_hash = audit_source_hash
        and window_start = current_window) <> 1
  then raise exception 'Below-limit checkout or restaurant scoping failed'; end if;

  -- An invalid NEW request rolls back its counter reservation.
  begin
    perform public.create_order_with_abuse_limit_v1('armandos', invalid_key,
      jsonb_set(request_payload, '{items,0,menuItemId}', to_jsonb(gen_random_uuid()::text)),
      audit_source_hash);
    raise exception 'Invalid new checkout was accepted';
  exception when others then
    if sqlerrm not like 'MM_ITEM_NOT_ON_MENU|%'
      and sqlerrm not like 'MM_ITEM_NOT_ORDERABLE|%' then raise; end if;
  end;
  if (select creation_count from public.checkout_creation_windows
      where restaurant_id = restaurant_uuid and window_start = current_window
        and checkout_creation_windows.source_hash = audit_source_hash) <> 1
    or exists (select 1 from public.orders where restaurant_id = restaurant_uuid
      and idempotency_key = invalid_key)
  then raise exception 'Failed checkout consumed capacity in limiter'; end if;

  update public.checkout_creation_windows set creation_count = 119
    where restaurant_id = restaurant_uuid and window_start = current_window
      and checkout_creation_windows.source_hash = audit_source_hash;
  result := public.create_order_with_abuse_limit_v1(
    'armandos', second_key, request_payload, audit_source_hash);
  if (result ->> 'orderId')::uuid is null
    or (select creation_count from public.checkout_creation_windows
      where restaurant_id = restaurant_uuid and window_start = current_window
        and checkout_creation_windows.source_hash = audit_source_hash) <> 120
  then raise exception 'The final below-limit checkout did not succeed'; end if;

  select last_order_number into order_counter from public.restaurant_order_counters
    where restaurant_id = restaurant_uuid;
  select count(*) into reservation_count from public.pickup_slot_reservations
    where restaurant_id = restaurant_uuid;
  select count(*) into payment_count from public.payments
    where restaurant_id = restaurant_uuid;
  select count(*) into session_count from public.payment_checkout_sessions session
    join public.payments payment on payment.id = session.payment_id
    where payment.restaurant_id = restaurant_uuid;
  begin
    perform public.create_order_with_abuse_limit_v1(
      'armandos', rejected_key, request_payload, audit_source_hash);
    raise exception 'Over-limit new checkout was accepted';
  exception when others then
    if sqlerrm !~ '^MM_CHECKOUT_RATE_LIMITED\|[1-9][0-9]*$' then raise; end if;
  end;
  if exists (select 1 from public.orders where restaurant_id = restaurant_uuid
      and idempotency_key = rejected_key)
    or (select last_order_number from public.restaurant_order_counters
      where restaurant_id = restaurant_uuid) <> order_counter
    or (select count(*) from public.pickup_slot_reservations
      where restaurant_id = restaurant_uuid) <> reservation_count
    or (select count(*) from public.payments
      where restaurant_id = restaurant_uuid) <> payment_count
    or (select count(*) from public.payment_checkout_sessions session
      join public.payments payment on payment.id = session.payment_id
      where payment.restaurant_id = restaurant_uuid) <> session_count
  then raise exception 'Limited checkout created order, pickup or payment state'; end if;

  replay_result := public.create_order_with_abuse_limit_v1(
    'armandos', first_key, request_payload, audit_source_hash);
  if (replay_result ->> 'orderId')::uuid <> first_order
    or (replay_result ->> 'replayed')::boolean is not true
    or (select creation_count from public.checkout_creation_windows
      where restaurant_id = restaurant_uuid and window_start = current_window
        and checkout_creation_windows.source_hash = audit_source_hash) <> 120
  then raise exception 'Exact replay was limited or consumed a counter'; end if;
  begin
    perform public.create_order_with_abuse_limit_v1('armandos', first_key,
      jsonb_set(request_payload, '{orderNotes}', '"changed"'::jsonb), audit_source_hash);
    raise exception 'Changed payload reused an idempotency key';
  exception when others then
    if sqlerrm not like 'MM_IDEMPOTENCY_CONFLICT|%' then raise; end if;
  end;

  -- Local/test has no trusted edge source and stays deterministic.
  result := public.create_order_with_abuse_limit_v1(
    'armandos', local_key, request_payload, null);
  if (result ->> 'orderId')::uuid is null
    or (select creation_count from public.checkout_creation_windows
      where restaurant_id = restaurant_uuid and window_start = current_window
        and checkout_creation_windows.source_hash = audit_source_hash) <> 120
  then raise exception 'Missing edge source did not degrade to ordinary checkout'; end if;

  -- A full previous window does not restrict a new window.
  update public.checkout_creation_windows
    set window_start = current_window - interval '10 minutes'
    where restaurant_id = restaurant_uuid and window_start = current_window
      and checkout_creation_windows.source_hash = audit_source_hash;
  result := public.create_order_with_abuse_limit_v1(
    'armandos', rollover_key, request_payload, audit_source_hash);
  if (result ->> 'orderId')::uuid is null
    or (select creation_count from public.checkout_creation_windows
      where restaurant_id = restaurant_uuid and window_start = current_window
        and checkout_creation_windows.source_hash = audit_source_hash) <> 1
  then raise exception 'Previous window blocked a new checkout'; end if;
end;
$$;

rollback;



