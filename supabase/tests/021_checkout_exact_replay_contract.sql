-- Run only after 202610010001_checkout_exact_replay.sql. All fixtures roll back.
begin;

do $$
declare
  restaurant_uuid uuid;
  connection_uuid uuid;
  menu_uuid uuid;
  item_uuid uuid;
  option_uuid uuid;
  pickup_at_value text;
  request_payload jsonb;
  custom_request jsonb;
  result jsonb;
  replay_result jsonb;
  prepared jsonb;
  attempt jsonb;
  event_result jsonb;
  normal_order uuid;
  optional_order uuid;
  custom_order uuid;
  abandoned_order uuid;
  paid_order uuid;
  partially_refunded_order uuid;
  paid_payment uuid;
  partial_payment uuid;
  normal_key text := gen_random_uuid()::text;
  optional_key text := gen_random_uuid()::text;
  custom_key text := gen_random_uuid()::text;
  new_overcap_key text := gen_random_uuid()::text;
  abandoned_key text := gen_random_uuid()::text;
  paid_key text := gen_random_uuid()::text;
  partial_key text := gen_random_uuid()::text;
  subtotal_value integer;
  initial_counter bigint;
  initial_sessions bigint;
  event_prefix text := 'checkout-replay-' || gen_random_uuid()::text;
begin
  select id into strict restaurant_uuid from public.restaurants
  where slug = 'armandos' and is_active;
  select id into strict menu_uuid from public.menus
  where restaurant_id = restaurant_uuid and is_published;
  select id into strict item_uuid from public.menu_items
  where restaurant_id = restaurant_uuid and source_system = 'doordash'
    and source_item_id = '198880505' and is_orderable;
  select id into strict option_uuid from public.modifier_options
  where restaurant_id = restaurant_uuid and source_system = 'menu-man-test'
    and source_option_id = 'chicken' and is_active;

  update public.restaurant_ordering_settings
  set advance_order_days = 1, pickup_max_orders_per_interval = 1000,
      custom_tip_additive_cap_cents = 50000
  where restaurant_id = restaurant_uuid;
  update public.restaurant_payment_connections set is_payment_route = false
  where restaurant_id = restaurant_uuid and is_payment_route;
  insert into public.restaurant_payment_connections (
    restaurant_id, provider_key, environment, connection_status,
    is_payment_route, capabilities
  ) values (
    restaurant_uuid, 'checkout_replay_contract', 'test', 'active', true,
    array['accept_payments']::text[]
  ) returning id into connection_uuid;

  select slot ->> 'pickupAt' into strict pickup_at_value
  from jsonb_array_elements(
    public.get_pickup_availability_v1('armandos', statement_timestamp()) #> '{scheduled,slots}'
  ) slot
  where (slot ->> 'pickupAt')::timestamptz >= clock_timestamp() + interval '2 hours'
  order by (slot ->> 'pickupAt')::timestamptz limit 1;
  request_payload := jsonb_build_object(
    'menuId', menu_uuid,
    'items', jsonb_build_array(jsonb_build_object(
      'menuItemId', item_uuid, 'quantity', 1,
      'modifierOptionIds', jsonb_build_array(option_uuid),
      'specialInstructions', null)),
    'customer', jsonb_build_object('name', 'EXACT REPLAY CONTRACT',
      'phone', '(951) 555-0100', 'email', 'replay-contract@example.invalid'),
    'pickup', jsonb_build_object('mode', 'scheduled', 'pickupAt', pickup_at_value),
    'tipChoice', 'none', 'orderNotes', null
  );

  -- An immediate replay preserves the order, counter, and pickup reservation.
  result := public.create_order_v1('armandos', normal_key, request_payload);
  normal_order := (result ->> 'orderId')::uuid;
  subtotal_value := (result ->> 'subtotalCents')::integer;
  select last_order_number into initial_counter from public.restaurant_order_counters
  where restaurant_id = restaurant_uuid;
  prepared := public.prepare_payment_v1(normal_order, repeat('a', 64), false, 30, 120);
  attempt := public.reserve_payment_attempt_v1(normal_order, repeat('a', 64), gen_random_uuid());
  replay_result := public.create_order_v1('armandos', normal_key, request_payload);
  if replay_result ->> 'orderId' <> normal_order::text
    or (replay_result ->> 'replayed')::boolean is not true
    or (select count(*) from public.orders where restaurant_id = restaurant_uuid
      and idempotency_key = normal_key) <> 1
    or (select last_order_number from public.restaurant_order_counters
      where restaurant_id = restaurant_uuid) <> initial_counter
    or (select count(*) from public.pickup_slot_reservations
      where order_id = normal_order) <> 1
    or (select count(*) from public.payment_attempts
      where payment_id = (prepared ->> 'paymentId')::uuid) <> 1
  then raise exception 'Immediate replay duplicated order, counter, attempt, or capacity'; end if;

  -- An accepted optional customer remains replayable if those fields become required.
  update public.restaurant_ordering_settings
  set customer_name_required = false, customer_email_required = false,
      customer_phone_required = false where restaurant_id = restaurant_uuid;
  result := public.create_order_v1('armandos', optional_key,
    jsonb_set(request_payload, '{customer}',
      jsonb_build_object('name', null, 'email', null, 'phone', null)));
  optional_order := (result ->> 'orderId')::uuid;
  update public.restaurant_ordering_settings
  set customer_name_required = true, customer_email_required = true,
      customer_phone_required = true where restaurant_id = restaurant_uuid;
  replay_result := public.create_order_v1('armandos', optional_key,
    jsonb_set(request_payload, '{customer}',
      jsonb_build_object('name', null, 'email', null, 'phone', null)));
  if replay_result ->> 'orderId' <> optional_order::text
    or (replay_result ->> 'replayed')::boolean is not true
  then raise exception 'Optional-customer replay failed after requirements changed'; end if;

  -- A historical custom tip survives a cap change; a new order still obeys it.
  custom_request := request_payload || jsonb_build_object(
    'tipChoice', 'custom', 'customTipCents', subtotal_value + 100,
    'largeTipConfirmed', true, 'largeTipConfirmedSubtotalCents', subtotal_value);
  result := public.create_order_v1('armandos', custom_key, custom_request);
  custom_order := (result ->> 'orderId')::uuid;
  update public.restaurant_ordering_settings
  set custom_tip_additive_cap_cents = 0 where restaurant_id = restaurant_uuid;
  replay_result := public.create_order_v1('armandos', custom_key, custom_request);
  if replay_result ->> 'orderId' <> custom_order::text
    or (replay_result ->> 'replayed')::boolean is not true
    or (replay_result ->> 'tipCents')::integer <> subtotal_value + 100
    or (select count(*) from public.orders where restaurant_id = restaurant_uuid
      and idempotency_key = custom_key) <> 1
  then raise exception 'Custom-tip replay failed after cap change'; end if;
  select last_order_number into initial_counter from public.restaurant_order_counters
  where restaurant_id = restaurant_uuid;
  begin
    perform public.create_order_v1('armandos', new_overcap_key, custom_request);
    raise exception 'New over-cap custom tip was accepted';
  exception when others then
    if sqlerrm not like 'MM_INVALID_REQUEST|Custom tip exceeds%' then raise; end if;
  end;
  if exists (select 1 from public.orders where restaurant_id = restaurant_uuid
      and idempotency_key = new_overcap_key)
    or (select last_order_number from public.restaurant_order_counters
      where restaurant_id = restaurant_uuid) <> initial_counter
  then raise exception 'Rejected new custom tip created an order or advanced its counter'; end if;
  begin
    perform public.create_order_v1('armandos', custom_key,
      jsonb_set(custom_request, '{customTipCents}', to_jsonb(subtotal_value + 101)));
    raise exception 'Changed payload reused an existing idempotency key';
  exception when others then
    if sqlerrm not like 'MM_IDEMPOTENCY_CONFLICT|%' then raise; end if;
  end;

  -- A revoked guest session cannot be reminted by replaying an abandoned order.
  result := public.create_order_v1('armandos', abandoned_key, request_payload);
  abandoned_order := (result ->> 'orderId')::uuid;
  perform public.prepare_payment_v1(abandoned_order, repeat('b', 64), false, 30, 120);
  perform public.abandon_checkout_v1(abandoned_order, repeat('b', 64));
  select count(*) into initial_sessions from public.payment_checkout_sessions session
  join public.payments payment on payment.id = session.payment_id
  where payment.order_id = abandoned_order;
  replay_result := public.create_order_v1('armandos', abandoned_key, request_payload);
  if replay_result ->> 'orderId' <> abandoned_order::text
    or replay_result ->> 'orderStatus' <> 'cancelled'
    or replay_result ->> 'paymentStatus' <> 'failed'
  then raise exception 'Abandoned-order replay did not return current state'; end if;
  begin
    perform public.prepare_payment_v1(abandoned_order, repeat('c', 64), false, 30, 120);
    raise exception 'Abandoned order minted a new payment session';
  exception when others then
    if sqlerrm not like 'MM_PAYMENT_NOT_ALLOWED|%' then raise; end if;
  end;
  if (select count(*) from public.payment_checkout_sessions session
      join public.payments payment on payment.id = session.payment_id
      where payment.order_id = abandoned_order) <> initial_sessions
  then raise exception 'Abandoned replay changed guest sessions'; end if;

  -- Genuine event application places an order; replay does not add an attempt.
  result := public.create_order_v1('armandos', paid_key, request_payload);
  paid_order := (result ->> 'orderId')::uuid;
  prepared := public.prepare_payment_v1(paid_order, repeat('d', 64), false, 30, 120);
  paid_payment := (prepared ->> 'paymentId')::uuid;
  attempt := public.reserve_payment_attempt_v1(paid_order, repeat('d', 64), gen_random_uuid());
  event_result := public.ingest_payment_webhook_v1(
    'checkout_replay_contract', 'test', event_prefix || '-paid', connection_uuid,
    repeat('a', 64), jsonb_build_object('fixture', 'paid'),
    jsonb_build_object('kind', 'payment.succeeded', 'attemptId', attempt ->> 'attemptId',
      'amountCents', prepared ->> 'amountCents', 'currency', prepared ->> 'currency',
      'providerPaymentReference', event_prefix || '-payment'), now(), now());
  perform public.apply_payment_event_v1((event_result ->> 'webhookEventId')::uuid);
  replay_result := public.create_order_v1('armandos', paid_key, request_payload);
  if replay_result ->> 'orderStatus' <> 'placed'
    or replay_result ->> 'paymentStatus' <> 'paid'
    or (select count(*) from public.payment_attempts where payment_id = paid_payment) <> 1
    or (select count(*) from public.orders where idempotency_key = paid_key
      and restaurant_id = restaurant_uuid) <> 1
  then raise exception 'Paid-order replay changed payment or order identity'; end if;
  begin
    perform public.prepare_payment_v1(paid_order, repeat('e', 64), false, 30, 120);
    raise exception 'Paid order minted a new payment session';
  exception when others then
    if sqlerrm not like 'MM_PAYMENT_NOT_ALLOWED|%' then raise; end if;
  end;

  -- Simulate subsequent refund summaries inside this rollback-only contract.
  update public.payments set status = 'refunded', refunded_cents = amount_cents
  where id = paid_payment;
  update public.orders set payment_status = 'refunded' where id = paid_order;
  replay_result := public.create_order_v1('armandos', paid_key, request_payload);
  if replay_result ->> 'paymentStatus' <> 'refunded'
  then raise exception 'Full-refund replay lost the current state'; end if;

  result := public.create_order_v1('armandos', partial_key, request_payload);
  partially_refunded_order := (result ->> 'orderId')::uuid;
  prepared := public.prepare_payment_v1(partially_refunded_order, repeat('f', 64), false, 30, 120);
  partial_payment := (prepared ->> 'paymentId')::uuid;
  update public.payments set status = 'partially_refunded',
    captured_cents = amount_cents, refunded_cents = 1 where id = partial_payment;
  update public.orders set order_status = 'placed', payment_status = 'partially_refunded'
  where id = partially_refunded_order;
  replay_result := public.create_order_v1('armandos', partial_key, request_payload);
  if replay_result ->> 'paymentStatus' <> 'partially_refunded'
    or (select count(*) from public.payment_attempts where payment_id = partial_payment) <> 0
  then raise exception 'Partial-refund replay changed the existing payment'; end if;
end;
$$;

rollback;
