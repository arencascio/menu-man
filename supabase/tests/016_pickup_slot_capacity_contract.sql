-- STAGING CONTRACT: run after the standard restaurant/menu/fake-payment seed.
-- This transaction rolls back all settings, orders, attempts, and webhooks.
-- The two-session final-slot race is documented separately; one SQL session
-- cannot prove concurrent serialization.
-- On disposable staging, prepare two pending orders for one slot with cap=1,
-- each with its own checkout token. Then run concurrently:
-- Session A: begin; select public.reserve_payment_attempt_v1(
--   '<order_a>'::uuid, '<sha256_token_a>', gen_random_uuid());
--   select pg_sleep(5); commit;
-- Session B (start during sleep): select public.reserve_payment_attempt_v1(
--   '<order_b>'::uuid, '<sha256_token_b>', gen_random_uuid());
-- Expected: B waits for A's interval lock, then raises MM_PICKUP_CAPACITY;
-- exactly one active pickup_slot_reservations row and one payment_attempts
-- row exist for the two orders. Repeat with A rolling back: B must succeed.
begin;

do $$
declare
  restaurant_uuid uuid;
  connection_uuid uuid;
  menu_uuid uuid;
  item_uuid uuid;
  option_uuid uuid;
  slot_at timestamptz;
  slot_service_date date;
  payload jsonb;
  first_order jsonb;
  second_order jsonb;
  third_order jsonb;
  attempt jsonb;
  event_response jsonb;
  rejected_key uuid;
begin
  select id into strict restaurant_uuid from public.restaurants
  where slug = 'armandos' and is_active;
  select id into strict connection_uuid from public.restaurant_payment_connections
  where restaurant_id = restaurant_uuid and provider_key = 'fake'
    and environment = 'test' and connection_status = 'active';
  update public.restaurant_payment_connections set is_payment_route = false
  where restaurant_id = restaurant_uuid and is_payment_route;
  update public.restaurant_payment_connections set is_payment_route = true
  where id = connection_uuid;
  select id into strict menu_uuid from public.menus
  where restaurant_id = restaurant_uuid and is_published;
  select id into strict item_uuid from public.menu_items
  where restaurant_id = restaurant_uuid and source_system = 'doordash'
    and source_item_id = '198880505' and is_orderable;
  select id into strict option_uuid from public.modifier_options
  where restaurant_id = restaurant_uuid and source_system = 'menu-man-test'
    and source_option_id = 'chicken' and is_active;

  -- A legacy/unconfigured restaurant retains its cadence and generous cap.
  if (select pickup_max_orders_per_interval from public.restaurant_ordering_settings
      where restaurant_id = restaurant_uuid) <> 1000
    or (select pickup_interval_minutes = pickup_slot_interval_minutes
        from public.restaurant_ordering_settings where restaurant_id = restaurant_uuid) is not true
  then raise exception 'Capacity defaults or interval alias changed an existing restaurant'; end if;

  update public.restaurant_ordering_settings set pickup_enabled = true,
    scheduled_pickup_enabled = true, asap_enabled = true,
    pickup_slot_interval_minutes = 15, pickup_max_orders_per_interval = 1,
    pickup_lead_time_minutes = 0, pickup_cutoff_minutes_before_close = 0,
    advance_order_days = 1
  where restaurant_id = restaurant_uuid;
  delete from public.restaurant_special_hours where restaurant_id = restaurant_uuid;
  delete from public.restaurant_business_hours where restaurant_id = restaurant_uuid;
  insert into public.restaurant_business_hours
    (restaurant_id, day_of_week, open_time, close_time, is_closed, sort_order)
  select restaurant_uuid, weekday, time '00:00', time '00:00', false, 0
  from generate_series(0, 6) weekday;

  select (slot ->> 'pickupAt')::timestamptz into strict slot_at
  from pg_catalog.jsonb_array_elements(
    public.get_pickup_availability_v1('armandos', pg_catalog.clock_timestamp()) #> '{scheduled,slots}'
  ) slot
  where (slot ->> 'pickupAt')::timestamptz >= pg_catalog.clock_timestamp() + interval '2 hours'
  order by (slot ->> 'pickupAt')::timestamptz limit 1;
  select (slot_at at time zone timezone)::date into slot_service_date
  from public.restaurants where id = restaurant_uuid;
  payload := pg_catalog.jsonb_build_object(
    'menuId', menu_uuid,
    'items', pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
      'menuItemId', item_uuid, 'quantity', 1,
      'modifierOptionIds', pg_catalog.jsonb_build_array(option_uuid),
      'specialInstructions', null)),
    'customer', pg_catalog.jsonb_build_object('name', 'Capacity QA',
      'phone', '(951) 555-0100', 'email', 'capacity@example.invalid'),
    'pickup', pg_catalog.jsonb_build_object('mode', 'scheduled', 'pickupAt', slot_at),
    'tipChoice', 'none', 'orderNotes', null
  );

  -- Pending orders alone do not claim capacity; only the final attempt does.
  first_order := public.create_order_v1('armandos', gen_random_uuid()::text, payload);
  second_order := public.create_order_v1('armandos', gen_random_uuid()::text, payload);
  perform public.prepare_payment_v1((first_order ->> 'orderId')::uuid,
    repeat('1', 64), true, 30, 120);
  perform public.prepare_payment_v1((second_order ->> 'orderId')::uuid,
    repeat('2', 64), true, 30, 120);
  update public.restaurant_ordering_settings
  set pickup_enabled = false, asap_enabled = false, scheduled_pickup_enabled = false
  where restaurant_id = (select id from public.restaurants where slug = 'test-kitchen');
  if not exists (select 1 from pg_catalog.jsonb_array_elements(
      public.get_pickup_availability_v1('armandos', pg_catalog.clock_timestamp()) #> '{scheduled,slots}'
    ) slot where (slot ->> 'pickupAt')::timestamptz = slot_at)
  then raise exception 'Below-capacity scheduled slot disappeared'; end if;

  attempt := public.reserve_payment_attempt_v1(
    (first_order ->> 'orderId')::uuid, repeat('1', 64), gen_random_uuid());
  if attempt ->> 'attemptId' is null
    or exists (select 1 from pg_catalog.jsonb_array_elements(
      public.get_pickup_availability_v1('armandos', pg_catalog.clock_timestamp()) #> '{scheduled,slots}'
    ) slot where (slot ->> 'pickupAt')::timestamptz = slot_at)
  then raise exception 'Final capacity position was not reserved/hidden'; end if;

  rejected_key := gen_random_uuid();
  begin
    perform public.reserve_payment_attempt_v1(
      (second_order ->> 'orderId')::uuid, repeat('2', 64), rejected_key);
    raise exception 'A full slot accepted another payment attempt';
  exception when others then
    if sqlerrm not like 'MM_PICKUP_CAPACITY|%' then raise; end if;
  end;
  if exists (select 1 from public.payment_attempts where client_attempt_key = rejected_key)
  then raise exception 'Capacity rejection left a provider attempt'; end if;

  -- Conclusive payment failure releases the unit for a different checkout.
  perform public.record_payment_command_result_v1(
    (attempt ->> 'attemptId')::uuid, 'failed', null, null, 'DECLINED',
    'provider_decline', 'DECLINED', 'Capacity test failure', '{}'::jsonb);
  if not exists (select 1 from pg_catalog.jsonb_array_elements(
      public.get_pickup_availability_v1('armandos', pg_catalog.clock_timestamp()) #> '{scheduled,slots}'
    ) slot where (slot ->> 'pickupAt')::timestamptz = slot_at)
  then raise exception 'Failed payment left ghost capacity'; end if;

  attempt := public.reserve_payment_attempt_v1(
    (second_order ->> 'orderId')::uuid, repeat('2', 64), gen_random_uuid());
  -- Once payment begins, a later special-hours change cannot steal the
  -- already reserved capacity or invalidate this provider success.
  insert into public.restaurant_special_hours
    (restaurant_id, service_date, is_closed)
  values (restaurant_uuid, slot_service_date, true);
  event_response := public.ingest_payment_webhook_v1(
    'fake', 'test', 'capacity-contract-success', connection_uuid, repeat('b', 64),
    pg_catalog.jsonb_build_object('fixture', 'capacity'),
    pg_catalog.jsonb_build_object('kind', 'payment.succeeded',
      'attemptId', attempt ->> 'attemptId', 'amountCents', attempt ->> 'amountCents',
      'currency', attempt ->> 'currency',
      'providerPaymentReference', 'fake_capacity_payment',
      'providerTransactionReference', 'fake_capacity_transaction',
      'providerStatus', 'SUCCEEDED'), now(), now());
  perform public.apply_payment_event_v1((event_response ->> 'webhookEventId')::uuid);
  if not exists (select 1 from public.orders
      where id = (second_order ->> 'orderId')::uuid and order_status = 'placed')
    or not exists (select 1 from public.pickup_slot_reservations
      where payment_attempt_id = (attempt ->> 'attemptId')::uuid and committed_at is not null)
  then raise exception 'Successful payment did not commit reserved capacity'; end if;
  delete from public.restaurant_special_hours
  where restaurant_id = restaurant_uuid and service_date = slot_service_date;

  -- Cancelled orders no longer count even when their reservation was committed.
  update public.orders set order_status = 'cancelled', cancelled_at = now(),
    cancellation_reason = 'capacity_contract'
  where id = (second_order ->> 'orderId')::uuid;
  if not exists (select 1 from pg_catalog.jsonb_array_elements(
      public.get_pickup_availability_v1('armandos', pg_catalog.clock_timestamp()) #> '{scheduled,slots}'
    ) slot where (slot ->> 'pickupAt')::timestamptz = slot_at)
  then raise exception 'Cancelled order continued to consume capacity'; end if;

  -- An expired reservation frees capacity; a later captured success must be
  -- quarantined as late success, not silently placed without a valid unit.
  third_order := public.create_order_v1('armandos', gen_random_uuid()::text, payload);
  perform public.prepare_payment_v1((third_order ->> 'orderId')::uuid,
    repeat('3', 64), true, 30, 120);
  attempt := public.reserve_payment_attempt_v1(
    (third_order ->> 'orderId')::uuid, repeat('3', 64), gen_random_uuid());
  update public.pickup_slot_reservations
  set created_at = now() - interval '2 hours', expires_at = now() - interval '1 hour'
  where payment_attempt_id = (attempt ->> 'attemptId')::uuid;
  if not exists (select 1 from pg_catalog.jsonb_array_elements(
      public.get_pickup_availability_v1('armandos', pg_catalog.clock_timestamp()) #> '{scheduled,slots}'
    ) slot where (slot ->> 'pickupAt')::timestamptz = slot_at)
  then raise exception 'Expired reservation continued to consume capacity'; end if;
  event_response := public.ingest_payment_webhook_v1(
    'fake', 'test', 'capacity-contract-expired', connection_uuid, repeat('c', 64),
    pg_catalog.jsonb_build_object('fixture', 'expired-capacity'),
    pg_catalog.jsonb_build_object('kind', 'payment.succeeded',
      'attemptId', attempt ->> 'attemptId', 'amountCents', attempt ->> 'amountCents',
      'currency', attempt ->> 'currency',
      'providerPaymentReference', 'fake_expired_capacity_payment',
      'providerTransactionReference', 'fake_expired_capacity_transaction',
      'providerStatus', 'SUCCEEDED'), now(), now());
  perform public.apply_payment_event_v1((event_response ->> 'webhookEventId')::uuid);
  if not exists (select 1 from public.orders where id = (third_order ->> 'orderId')::uuid
      and order_status = 'cancelled' and payment_status = 'paid'
      and cancellation_reason = 'pickup_reservation_expired')
    or exists (select 1 from public.analytics_outbox
      where aggregate_type = 'payment' and event_type = 'purchase'
        and aggregate_id = (select id from public.payments
          where order_id = (third_order ->> 'orderId')::uuid))
    or not exists (select 1 from public.analytics_outbox
      where aggregate_type = 'payment' and event_type = 'payment_late_success'
        and aggregate_id = (select id from public.payments
          where order_id = (third_order ->> 'orderId')::uuid))
  then raise exception 'Expired reservation allowed paid placement'; end if;
  begin
    perform public.reserve_fake_late_success_resolution_v1(
      (third_order ->> 'orderId')::uuid, repeat('3', 64), 'accepted', gen_random_uuid()
    );
    raise exception 'Expired pickup reservation allowed fake late acceptance';
  exception when others then
    if sqlerrm not like 'MM_PICKUP_RESERVATION_EXPIRED|%' then raise; end if;
  end;
end;
$$;

rollback;
