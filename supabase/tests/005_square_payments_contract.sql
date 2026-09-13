-- STAGING CONTRACT TEST. Run after 005_armandos_square_sandbox.sql.
-- This tests provider-neutral Square event/reconciliation storage and transitions;
-- the application unit tests cover Square SDK request and signature behavior.

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
  reconciliation_response jsonb;
  refund_response jsonb;
  payment_uuid uuid;
  event_uuid uuid;
begin
  select id into strict restaurant_uuid
  from public.restaurants where slug = 'armandos' and is_active;

  select id into strict connection_uuid
  from public.restaurant_payment_connections
  where restaurant_id = restaurant_uuid
    and provider_key = 'square'
    and environment = 'sandbox'
    and connection_status = 'active'
    and is_payment_route;

  if not exists (
    select 1 from public.payment_provider_references
    where connection_id = connection_uuid
      and provider_key = 'square'
      and environment = 'sandbox'
      and reference_kind = 'location'
  ) then
    raise exception 'Square Sandbox location reference is missing';
  end if;

  select id into strict menu_uuid
  from public.menus where restaurant_id = restaurant_uuid and is_published;

  select id into strict item_uuid
  from public.menu_items
  where restaurant_id = restaurant_uuid
    and source_system = 'doordash'
    and source_item_id = '198880505'
    and is_orderable;

  select option.id into strict chicken_option_uuid
  from public.modifier_options option
  where option.restaurant_id = restaurant_uuid
    and option.source_system = 'menu-man-test'
    and option.source_option_id = 'chicken'
    and option.is_active;

  select slot ->> 'pickupAt' into pickup_at_value
  from jsonb_array_elements(
    public.get_pickup_availability_v1('armandos', statement_timestamp()) #> '{scheduled,slots}'
  ) slot
  order by (slot ->> 'pickupAt')::timestamptz
  limit 1;

  request_payload := jsonb_build_object(
    'menuId', menu_uuid,
    'items', jsonb_build_array(jsonb_build_object(
      'menuItemId', item_uuid,
      'quantity', 1,
      'modifierOptionIds', jsonb_build_array(chicken_option_uuid),
      'specialInstructions', null
    )),
    'customer', jsonb_build_object(
      'name', 'Square Payment Contract Test',
      'phone', '555-0100',
      'email', null
    ),
    'pickup', jsonb_build_object('mode', 'scheduled', 'pickupAt', pickup_at_value),
    'tipChoice', 'none',
    'orderNotes', null
  );

  order_response := public.create_order_v1('armandos', gen_random_uuid()::text, request_payload);
  prepared := public.prepare_payment_v1(
    (order_response ->> 'orderId')::uuid, repeat('3', 64), false, 30, 120
  );
  payment_uuid := (prepared ->> 'paymentId')::uuid;
  if prepared ->> 'provider' <> 'square'
    or prepared ->> 'providerEnvironment' <> 'sandbox'
    or prepared ->> 'status' <> 'requires_payment_method'
  then
    raise exception 'Unexpected Square prepared payment: %', prepared;
  end if;

  attempt := public.reserve_payment_attempt_v1(
    (order_response ->> 'orderId')::uuid, repeat('3', 64), gen_random_uuid()
  );
  reconciliation_response := public.ingest_payment_reconciliation_v1(
    'square',
    'sandbox',
    'square-contract-payment-completed',
    connection_uuid,
    jsonb_build_object(
      'eventId', 'square-contract-payment-completed',
      'kind', 'payment.succeeded',
      'attemptId', attempt ->> 'attemptId',
      'amountCents', attempt ->> 'amountCents',
      'currency', attempt ->> 'currency',
      'providerPaymentReference', 'square_contract_payment',
      'providerStatus', 'COMPLETED'
    ),
    now()
  );
  event_uuid := (reconciliation_response ->> 'paymentEventId')::uuid;

  if not exists (
    select 1 from public.payment_webhook_events
    where id = event_uuid
      and event_source = 'reconciliation'
      and not signature_verified
      and processing_status = 'processed'
      and not (raw_payload ? 'customer')
      and not (raw_payload ? 'billing')
  ) then
    raise exception 'Square reconciliation event was not minimally and safely persisted';
  end if;
  if not exists (
    select 1 from public.orders
    where id = (order_response ->> 'orderId')::uuid
      and order_status = 'placed'
      and payment_status = 'paid'
  ) or (select count(*) from public.analytics_outbox
        where event_type = 'purchase' and aggregate_id = payment_uuid) <> 1
  then
    raise exception 'Square reconciliation did not place/pay exactly once';
  end if;

  reconciliation_response := public.ingest_payment_reconciliation_v1(
    'square',
    'sandbox',
    'square-contract-payment-completed',
    connection_uuid,
    jsonb_build_object(
      'eventId', 'square-contract-payment-completed',
      'kind', 'payment.succeeded',
      'attemptId', attempt ->> 'attemptId',
      'amountCents', attempt ->> 'amountCents',
      'currency', attempt ->> 'currency',
      'providerPaymentReference', 'square_contract_payment',
      'providerStatus', 'COMPLETED'
    ),
    now()
  );
  if (reconciliation_response ->> 'inserted')::boolean then
    raise exception 'Duplicate Square reconciliation was inserted twice';
  end if;

  refund_response := public.reserve_refund_v1(
    payment_uuid, gen_random_uuid(), (prepared ->> 'amountCents')::integer,
    'Square contract refund', 'contract_test'
  );
  perform public.record_refund_command_result_v1(
    (refund_response ->> 'refundId')::uuid,
    'processing',
    'square_contract_refund',
    'PENDING',
    null, null, null,
    jsonb_build_object('source', 'square_contract_test')
  );
  perform public.ingest_payment_reconciliation_v1(
    'square',
    'sandbox',
    'square-contract-refund-completed',
    connection_uuid,
    jsonb_build_object(
      'eventId', 'square-contract-refund-completed',
      'kind', 'refund.succeeded',
      'refundId', refund_response ->> 'refundId',
      'amountCents', refund_response ->> 'amountCents',
      'currency', refund_response ->> 'currency',
      'providerPaymentReference', 'square_contract_payment',
      'providerRefundReference', 'square_contract_refund',
      'providerStatus', 'COMPLETED'
    ),
    now()
  );

  if (select status from public.refunds
      where id = (refund_response ->> 'refundId')::uuid) <> 'succeeded'
    or (select status from public.payments where id = payment_uuid) <> 'refunded'
    or (select payment_status from public.orders
        where id = (order_response ->> 'orderId')::uuid) <> 'refunded'
  then
    raise exception 'Square refund reconciliation did not update provider-neutral summaries';
  end if;
end;
$$;

rollback;
