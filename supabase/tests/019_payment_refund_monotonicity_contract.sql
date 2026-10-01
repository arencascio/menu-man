-- STAGING CONTRACT. Run after the Square Sandbox seed and migration 202609300001.
-- Every order, event, refund, and temporary ordering-setting change rolls back.
begin;

do $$
declare
  restaurant_uuid uuid;
  connection_uuid uuid;
  menu_uuid uuid;
  item_uuid uuid;
  chicken_option_uuid uuid;
  pickup_at_value text;
  request_payload jsonb;
  order_response jsonb;
  prepared jsonb;
  attempt jsonb;
  refund_response jsonb;
  event_response jsonb;
  replay_response jsonb;
  event_uuid uuid;
  payment_uuid uuid;
  payment_reference text;
  event_prefix text;
  expected_status text;
  refund_amount integer;
  variant text;
  access_token_hash text;
begin
  select id into strict restaurant_uuid
  from public.restaurants where slug = 'armandos' and is_active;
  select id into strict connection_uuid
  from public.restaurant_payment_connections
  where restaurant_id = restaurant_uuid
    and provider_key = 'square' and environment = 'sandbox'
    and connection_status = 'active' and is_payment_route;
  select id into strict menu_uuid from public.menus
  where restaurant_id = restaurant_uuid and is_published;
  select id into strict item_uuid from public.menu_items
  where restaurant_id = restaurant_uuid and source_system = 'doordash'
    and source_item_id = '198880505' and is_orderable;
  select id into strict chicken_option_uuid from public.modifier_options
  where restaurant_id = restaurant_uuid and source_system = 'menu-man-test'
    and source_option_id = 'chicken' and is_active;

  update public.restaurant_ordering_settings set advance_order_days = 1
  where restaurant_id = restaurant_uuid;
  request_payload := jsonb_build_object(
    'menuId', menu_uuid,
    'items', jsonb_build_array(jsonb_build_object(
      'menuItemId', item_uuid, 'quantity', 1,
      'modifierOptionIds', jsonb_build_array(chicken_option_uuid),
      'specialInstructions', null)),
    'customer', jsonb_build_object('name', 'AUDIT TEST',
      'phone', '(951) 555-0100', 'email', 'audit-test@example.invalid'),
    'pickup', jsonb_build_object('mode', 'scheduled'),
    'tipChoice', 'none', 'orderNotes', 'AUTOMATED STAGING AUDIT'
  );

  foreach variant in array array['full', 'partial'] loop
    access_token_hash := md5(gen_random_uuid()::text) || md5(gen_random_uuid()::text);
    select slot ->> 'pickupAt' into strict pickup_at_value
    from jsonb_array_elements(
      public.get_pickup_availability_v1('armandos', statement_timestamp()) #> '{scheduled,slots}'
    ) slot
    order by (slot ->> 'pickupAt')::timestamptz limit 1;
    request_payload := jsonb_set(request_payload, '{pickup,pickupAt}', to_jsonb(pickup_at_value));

    event_prefix := 'refund-monotonicity-' || gen_random_uuid()::text;
    payment_reference := event_prefix || '-payment';
    order_response := public.create_order_v1('armandos', gen_random_uuid()::text, request_payload);
    prepared := public.prepare_payment_v1(
      (order_response ->> 'orderId')::uuid, access_token_hash, false, 30, 120);
    payment_uuid := (prepared ->> 'paymentId')::uuid;
    attempt := public.reserve_payment_attempt_v1(
      (order_response ->> 'orderId')::uuid, access_token_hash, gen_random_uuid());

    event_response := public.ingest_payment_reconciliation_v1(
      'square', 'sandbox', event_prefix || '-first-success', connection_uuid,
      jsonb_build_object(
        'kind', 'payment.succeeded', 'attemptId', attempt ->> 'attemptId',
        'amountCents', attempt ->> 'amountCents', 'currency', attempt ->> 'currency',
        'providerPaymentReference', payment_reference, 'providerStatus', 'COMPLETED'),
      now());
    event_uuid := (event_response ->> 'paymentEventId')::uuid;
    if (select status from public.payments where id = payment_uuid) <> 'succeeded'
      or not exists (select 1 from public.orders
        where id = (order_response ->> 'orderId')::uuid
          and order_status = 'placed' and payment_status = 'paid')
      or (select count(*) from public.analytics_outbox
        where event_type = 'purchase' and aggregate_id = payment_uuid) <> 1
    then raise exception 'First success failed for %', variant; end if;

    replay_response := public.ingest_payment_reconciliation_v1(
      'square', 'sandbox', event_prefix || '-first-success', connection_uuid,
      jsonb_build_object(
        'kind', 'payment.succeeded', 'attemptId', attempt ->> 'attemptId',
        'amountCents', attempt ->> 'amountCents', 'currency', attempt ->> 'currency',
        'providerPaymentReference', payment_reference, 'providerStatus', 'COMPLETED'),
      now());
    if (replay_response ->> 'inserted')::boolean
      or (select count(*) from public.payment_state_transitions
        where webhook_event_id = event_uuid) <> 1
    then raise exception 'Same-event success replay was not idempotent for %', variant; end if;

    refund_amount := case when variant = 'full'
      then (prepared ->> 'amountCents')::integer else 100 end;
    expected_status := case when variant = 'full'
      then 'refunded' else 'partially_refunded' end;
    refund_response := public.reserve_refund_v1(
      payment_uuid, gen_random_uuid(), refund_amount,
      'Refund monotonicity contract', 'contract_test');
    perform public.record_refund_command_result_v1(
      (refund_response ->> 'refundId')::uuid, 'processing',
      event_prefix || '-refund', 'PENDING', null, null, null,
      jsonb_build_object('source', 'refund_monotonicity_contract'));
    perform public.ingest_payment_reconciliation_v1(
      'square', 'sandbox', event_prefix || '-refund-completed', connection_uuid,
      jsonb_build_object(
        'kind', 'refund.succeeded', 'refundId', refund_response ->> 'refundId',
        'amountCents', refund_amount, 'currency', refund_response ->> 'currency',
        'providerPaymentReference', payment_reference,
        'providerRefundReference', event_prefix || '-refund',
        'providerStatus', 'COMPLETED'),
      now());

    if not exists (select 1 from public.payments where id = payment_uuid
        and status = expected_status and refunded_cents = refund_amount)
      or not exists (select 1 from public.orders
        where id = (order_response ->> 'orderId')::uuid
          and order_status = 'placed' and payment_status = expected_status)
    then raise exception 'Refund did not reach % for %', expected_status, variant; end if;

    -- This is a new provider event ID for the same original captured attempt.
    event_response := public.ingest_payment_reconciliation_v1(
      'square', 'sandbox', event_prefix || '-later-success', connection_uuid,
      jsonb_build_object(
        'kind', 'payment.succeeded', 'attemptId', attempt ->> 'attemptId',
        'amountCents', attempt ->> 'amountCents', 'currency', attempt ->> 'currency',
        'providerPaymentReference', payment_reference, 'providerStatus', 'COMPLETED'),
      now());
    event_uuid := (event_response ->> 'paymentEventId')::uuid;

    if (event_response ->> 'inserted')::boolean is not true
      or not exists (select 1 from public.payment_webhook_events
        where id = event_uuid and processing_status = 'processed')
      or not exists (select 1 from public.payments where id = payment_uuid
        and status = expected_status and refunded_cents = refund_amount)
      or not exists (select 1 from public.orders
        where id = (order_response ->> 'orderId')::uuid
          and order_status = 'placed' and payment_status = expected_status)
      or not exists (select 1 from public.payment_state_transitions
        where webhook_event_id = event_uuid and event_type = 'payment.succeeded'
          and next_state ->> 'payment' = expected_status
          and next_state ->> 'orderPayment' = expected_status)
      or (select count(*) from public.analytics_outbox
        where event_type = 'purchase' and aggregate_id = payment_uuid) <> 1
    then raise exception 'Later success regressed % refund state', variant; end if;

    replay_response := public.ingest_payment_reconciliation_v1(
      'square', 'sandbox', event_prefix || '-later-success', connection_uuid,
      jsonb_build_object(
        'kind', 'payment.succeeded', 'attemptId', attempt ->> 'attemptId',
        'amountCents', attempt ->> 'amountCents', 'currency', attempt ->> 'currency',
        'providerPaymentReference', payment_reference, 'providerStatus', 'COMPLETED'),
      now());
    if (replay_response ->> 'inserted')::boolean
      or (select count(*) from public.payment_state_transitions
        where webhook_event_id = event_uuid) <> 1
      or not exists (select 1 from public.payments where id = payment_uuid
        and status = expected_status and refunded_cents = refund_amount)
    then raise exception 'Later success replay was not idempotent for %', variant; end if;
  end loop;
end;
$$;

rollback;
