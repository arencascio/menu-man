-- STAGING CONTRACT TEST. Run after the Armando staging seed, including the
-- fake payment connection. The outer transaction rolls back all test records.

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
  second_order_response jsonb;
  failed_order_response jsonb;
  prepared jsonb;
  attempt jsonb;
  second_attempt jsonb;
  failed_attempt jsonb;
  webhook_response jsonb;
  refund_response jsonb;
  payment_uuid uuid;
  second_payment_uuid uuid;
  payment_view jsonb;
  failed_payment_status jsonb;
  event_uuid uuid;
  abandonment_response jsonb;
begin
  select id into strict restaurant_uuid
  from public.restaurants where slug = 'armandos' and is_active;

  update public.restaurant_ordering_settings
  set advance_order_days = 1
  where restaurant_id = restaurant_uuid;

  select id into strict connection_uuid
  from public.restaurant_payment_connections
  where restaurant_id = restaurant_uuid
    and provider_key = 'fake'
    and environment = 'test'
    and connection_status = 'active';

  update public.restaurant_payment_connections
  set is_payment_route = false
  where restaurant_id = restaurant_uuid and is_payment_route;
  update public.restaurant_payment_connections
  set is_payment_route = true
  where id = connection_uuid;

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
      'name', 'Payment Contract Test',
      'phone', '555-0100',
      'email', 'payments-contract@example.invalid'
    ),
    'pickup', jsonb_build_object('mode', 'scheduled', 'pickupAt', pickup_at_value),
    'tipChoice', 'none',
    'orderNotes', null
  );

  order_response := public.create_order_v1('armandos', gen_random_uuid()::text, request_payload);
  prepared := public.prepare_payment_v1(
    (order_response ->> 'orderId')::uuid, repeat('a', 64), true, 30, 120
  );
  payment_uuid := (prepared ->> 'paymentId')::uuid;

  if prepared ->> 'provider' <> 'fake'
    or prepared ->> 'status' <> 'requires_payment_method'
    or (prepared ->> 'amountCents')::integer <> (order_response ->> 'totalCents')::integer
  then
    raise exception 'Unexpected prepared payment: %', prepared;
  end if;

  attempt := public.reserve_payment_attempt_v1(
    (order_response ->> 'orderId')::uuid,
    repeat('a', 64),
    gen_random_uuid()
  );

  webhook_response := public.ingest_payment_webhook_v1(
    'fake', 'test', 'contract-success', connection_uuid, repeat('b', 64),
    jsonb_build_object('fixture', 'success'),
    jsonb_build_object(
      'kind', 'payment.succeeded',
      'attemptId', attempt ->> 'attemptId',
      'amountCents', attempt ->> 'amountCents',
      'currency', attempt ->> 'currency',
      'providerPaymentReference', 'fake_contract_payment',
      'providerTransactionReference', 'fake_contract_transaction',
      'providerStatus', 'SUCCEEDED'
    ),
    now(), now()
  );
  event_uuid := (webhook_response ->> 'webhookEventId')::uuid;
  perform public.apply_payment_event_v1(event_uuid);

  if not exists (
    select 1 from public.orders
    where id = (order_response ->> 'orderId')::uuid
      and order_status = 'placed' and payment_status = 'paid'
  ) then
    raise exception 'Verified success did not place and pay the order';
  end if;
  if (select count(*) from public.analytics_outbox
      where event_type = 'purchase' and aggregate_id = payment_uuid) <> 1
  then
    raise exception 'Verified success did not create exactly one purchase outbox event';
  end if;
  if (select count(*) from public.notification_outbox
      where order_id = (order_response ->> 'orderId')::uuid
        and notification_type = 'customer.order_confirmed') <> 1
  then
    raise exception 'Verified success did not create exactly one order-confirmation email';
  end if;

  webhook_response := public.ingest_payment_webhook_v1(
    'fake', 'test', 'contract-success', connection_uuid, repeat('b', 64),
    jsonb_build_object('fixture', 'success'),
    jsonb_build_object('kind', 'payment.succeeded'),
    now(), now()
  );
  if (webhook_response ->> 'inserted')::boolean then
    raise exception 'Duplicate provider event was inserted twice';
  end if;
  perform public.apply_payment_event_v1((webhook_response ->> 'webhookEventId')::uuid);
  if (select count(*) from public.notification_outbox
      where order_id = (order_response ->> 'orderId')::uuid
        and notification_type = 'customer.order_confirmed') <> 1
  then
    raise exception 'Duplicate payment webhook duplicated the order-confirmation email';
  end if;

  webhook_response := public.ingest_payment_webhook_v1(
    'fake', 'test', 'contract-old-processing', connection_uuid, repeat('c', 64),
    jsonb_build_object('fixture', 'out-of-order'),
    jsonb_build_object(
      'kind', 'payment.processing',
      'attemptId', attempt ->> 'attemptId',
      'amountCents', attempt ->> 'amountCents',
      'currency', attempt ->> 'currency',
      'providerStatus', 'PROCESSING'
    ),
    now() - interval '1 minute', now()
  );
  perform public.apply_payment_event_v1((webhook_response ->> 'webhookEventId')::uuid);
  if (select status from public.payments where id = payment_uuid) <> 'succeeded' then
    raise exception 'Out-of-order processing event downgraded a succeeded payment';
  end if;

  refund_response := public.reserve_refund_v1(
    payment_uuid, gen_random_uuid(), (prepared ->> 'amountCents')::integer,
    'Contract refund', 'contract_test'
  );
  webhook_response := public.ingest_payment_webhook_v1(
    'fake', 'test', 'contract-refund', connection_uuid, repeat('d', 64),
    jsonb_build_object('fixture', 'refund'),
    jsonb_build_object(
      'kind', 'refund.succeeded',
      'refundId', refund_response ->> 'refundId',
      'amountCents', refund_response ->> 'amountCents',
      'currency', refund_response ->> 'currency',
      'providerRefundReference', 'fake_contract_refund',
      'providerStatus', 'SUCCEEDED'
    ),
    now(), now()
  );
  perform public.apply_payment_event_v1((webhook_response ->> 'webhookEventId')::uuid);
  if (select status from public.payments where id = payment_uuid) <> 'refunded'
    or (select payment_status from public.orders where id = (order_response ->> 'orderId')::uuid) <> 'refunded'
  then
    raise exception 'Verified refund did not update payment summaries';
  end if;
  if (select count(*) from public.notification_outbox
      where order_id = (order_response ->> 'orderId')::uuid
        and notification_type = 'customer.refund_confirmed') <> 1
  then
    raise exception 'Verified refund did not create exactly one refund-confirmation email';
  end if;

  payment_view := public.get_order_payment_view_v1(
    (order_response ->> 'orderId')::uuid, 'armandos', repeat('a', 64)
  );
  if payment_view #>> '{order,orderNumber}' <> order_response ->> 'orderNumber'
    or jsonb_array_length(payment_view #> '{order,items}') < 1
    or payment_view #>> '{payment,status}' <> 'refunded'
  then
    raise exception 'Capability-protected order payment view is incomplete: %', payment_view;
  end if;

  second_order_response := public.create_order_v1(
    'armandos', gen_random_uuid()::text, request_payload
  );
  prepared := public.prepare_payment_v1(
    (second_order_response ->> 'orderId')::uuid, repeat('e', 64), true, 30, 120
  );
  second_payment_uuid := (prepared ->> 'paymentId')::uuid;
  second_attempt := public.reserve_payment_attempt_v1(
    (second_order_response ->> 'orderId')::uuid, repeat('e', 64), gen_random_uuid()
  );

  webhook_response := public.ingest_payment_webhook_v1(
    'fake', 'test', 'contract-cancelled', connection_uuid, repeat('f', 64),
    jsonb_build_object('fixture', 'cancelled'),
    jsonb_build_object(
      'kind', 'payment.cancelled',
      'attemptId', second_attempt ->> 'attemptId',
      'amountCents', second_attempt ->> 'amountCents',
      'currency', second_attempt ->> 'currency',
      'providerStatus', 'CANCELLED'
    ),
    now(), now()
  );
  perform public.apply_payment_event_v1((webhook_response ->> 'webhookEventId')::uuid);

  webhook_response := public.ingest_payment_webhook_v1(
    'fake', 'test', 'contract-late-success', connection_uuid, repeat('0', 64),
    jsonb_build_object('fixture', 'late-success'),
    jsonb_build_object(
      'kind', 'payment.succeeded',
      'attemptId', second_attempt ->> 'attemptId',
      'amountCents', second_attempt ->> 'amountCents',
      'currency', second_attempt ->> 'currency',
      'providerPaymentReference', 'fake_late_payment',
      'providerTransactionReference', 'fake_late_transaction',
      'providerStatus', 'SUCCEEDED'
    ),
    now(), now()
  );
  perform public.apply_payment_event_v1((webhook_response ->> 'webhookEventId')::uuid);

  if (select order_status from public.orders
      where id = (second_order_response ->> 'orderId')::uuid) <> 'cancelled'
    or not exists (
      select 1 from public.analytics_outbox
      where event_type = 'payment_late_success' and aggregate_id = second_payment_uuid
    )
    or exists (
      select 1 from public.analytics_outbox
      where event_type = 'purchase' and aggregate_id = second_payment_uuid
    )
  then
    raise exception 'Late success was not quarantined from order placement/purchase analytics';
  end if;

  failed_order_response := public.create_order_v1(
    'armandos', gen_random_uuid()::text, request_payload
  );
  prepared := public.prepare_payment_v1(
    (failed_order_response ->> 'orderId')::uuid, repeat('1', 64), true, 30, 120
  );
  failed_attempt := public.reserve_payment_attempt_v1(
    (failed_order_response ->> 'orderId')::uuid, repeat('1', 64), gen_random_uuid()
  );
  webhook_response := public.ingest_payment_webhook_v1(
    'fake', 'test', 'contract-decline', connection_uuid, repeat('2', 64),
    jsonb_build_object('fixture', 'decline'),
    jsonb_build_object(
      'kind', 'payment.failed',
      'attemptId', failed_attempt ->> 'attemptId',
      'amountCents', failed_attempt ->> 'amountCents',
      'currency', failed_attempt ->> 'currency',
      'providerStatus', 'DECLINED',
      'failureCategory', 'provider_decline',
      'failureCode', 'CARD_DECLINED'
    ),
    now(), now()
  );
  perform public.apply_payment_event_v1((webhook_response ->> 'webhookEventId')::uuid);

  if (select status from public.payment_attempts
      where id = (failed_attempt ->> 'attemptId')::uuid) <> 'failed'
    or (select status from public.payments
        where id = (prepared ->> 'paymentId')::uuid) <> 'failed'
    or not exists (
      select 1 from public.orders
      where id = (failed_order_response ->> 'orderId')::uuid
        and order_status = 'cancelled'
        and payment_status = 'failed'
        and cancellation_reason = 'payment_declined'
    )
  then
    raise exception 'Conclusive decline did not fail the attempt/payment and terminally cancel the order';
  end if;

  failed_payment_status := public.authorize_payment_session_v1(
    (failed_order_response ->> 'orderId')::uuid, repeat('1', 64)
  );
  if failed_payment_status ->> 'status' <> 'failed'
    or failed_payment_status ->> 'orderStatus' <> 'cancelled'
    or failed_payment_status ->> 'paymentStatus' <> 'failed'
    or failed_payment_status #>> '{latestAttempt,status}' <> 'failed'
  then
    raise exception 'Payment status API source did not expose a terminal decline: %', failed_payment_status;
  end if;

  payment_view := public.get_order_payment_view_v1(
    (failed_order_response ->> 'orderId')::uuid, 'armandos', repeat('1', 64)
  );
  if payment_view #>> '{payment,status}' <> 'failed'
    or payment_view #>> '{payment,orderStatus}' <> 'cancelled'
    or payment_view #>> '{payment,paymentStatus}' <> 'failed'
    or payment_view #>> '{payment,latestAttempt,status}' <> 'failed'
    or payment_view #>> '{order,orderStatus}' <> 'cancelled'
    or payment_view #>> '{order,paymentStatus}' <> 'failed'
    or payment_view #>> '{order,cancellationReason}' <> 'payment_declined'
  then
    raise exception 'Order payment view did not expose a terminal decline: %', payment_view;
  end if;

  begin
    perform public.reserve_payment_attempt_v1(
      (failed_order_response ->> 'orderId')::uuid, repeat('1', 64), gen_random_uuid()
    );
    raise exception 'Terminally declined order accepted another payment attempt';
  exception when others then
    if sqlerrm not like 'MM_PAYMENT_NOT_ALLOWED|%' then
      raise;
    end if;
  end;
end;
$$;

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
  event_response jsonb;
  action_reservation jsonb;
  late_resolution jsonb;
  refund_response jsonb;
  payment_status jsonb;
begin
  select restaurant.id into strict restaurant_uuid
  from public.restaurants restaurant
  where restaurant.slug = 'armandos' and restaurant.is_active;

  select connection.id into strict connection_uuid
  from public.restaurant_payment_connections connection
  where connection.restaurant_id = restaurant_uuid
    and connection.provider_key = 'fake'
    and connection.environment = 'test'
    and connection.connection_status = 'active'
    and connection.is_payment_route;

  select menu.id into strict menu_uuid
  from public.menus menu
  where menu.restaurant_id = restaurant_uuid and menu.is_published;

  select item.id into strict item_uuid
  from public.menu_items item
  where item.restaurant_id = restaurant_uuid
    and item.source_system = 'doordash'
    and item.source_item_id = '198880505'
    and item.is_orderable;

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
      'name', 'Payment Exceptional State Test',
      'phone', '555-0100',
      'email', null
    ),
    'pickup', jsonb_build_object('mode', 'scheduled', 'pickupAt', pickup_at_value),
    'tipChoice', 'none',
    'orderNotes', null
  );

  -- Capture the existing authorization through a verified provider event.
  order_response := public.create_order_v1('armandos', gen_random_uuid()::text, request_payload);
  prepared := public.prepare_payment_v1(
    (order_response ->> 'orderId')::uuid, repeat('3', 64), true, 30, 120
  );
  attempt := public.reserve_payment_attempt_v1(
    (order_response ->> 'orderId')::uuid, repeat('3', 64), gen_random_uuid()
  );
  event_response := public.ingest_payment_webhook_v1(
    'fake', 'test', 'contract-authorization-capture', connection_uuid, repeat('3', 64),
    jsonb_build_object('fixture', 'authorization-capture'),
    jsonb_build_object(
      'kind', 'payment.authorized',
      'attemptId', attempt ->> 'attemptId',
      'amountCents', attempt ->> 'amountCents',
      'currency', attempt ->> 'currency',
      'providerPaymentReference', 'fake_authorization_capture',
      'providerStatus', 'AUTHORIZED'
    ),
    now(), now()
  );
  perform public.apply_payment_event_v1((event_response ->> 'webhookEventId')::uuid);
  action_reservation := public.reserve_fake_authorization_action_v1(
    (order_response ->> 'orderId')::uuid, repeat('3', 64), 'capture', gen_random_uuid()
  );
  if action_reservation ->> 'attemptId' <> attempt ->> 'attemptId' then
    raise exception 'Capture created or selected a different payment attempt';
  end if;
  payment_status := public.reserve_fake_authorization_action_v1(
    (order_response ->> 'orderId')::uuid, repeat('3', 64), 'capture', gen_random_uuid()
  );
  if not (payment_status ->> 'replayed')::boolean
    or payment_status ->> 'providerIdempotencyKey' <> action_reservation ->> 'providerIdempotencyKey'
  then
    raise exception 'Repeated capture did not reuse its provider idempotency key';
  end if;
  begin
    perform public.reserve_fake_authorization_action_v1(
      (order_response ->> 'orderId')::uuid, repeat('3', 64), 'void', gen_random_uuid()
    );
    raise exception 'Reserved capture allowed a conflicting void';
  exception when others then
    if sqlerrm not like 'MM_PAYMENT_IN_PROGRESS|%' then
      raise;
    end if;
  end;
  event_response := public.ingest_payment_webhook_v1(
    'fake', 'test', 'contract-authorization-captured', connection_uuid, repeat('4', 64),
    jsonb_build_object('fixture', 'authorization-captured'),
    jsonb_build_object(
      'kind', 'payment.succeeded',
      'attemptId', attempt ->> 'attemptId',
      'amountCents', attempt ->> 'amountCents',
      'currency', attempt ->> 'currency',
      'providerPaymentReference', 'fake_authorization_capture',
      'providerStatus', 'CAPTURED'
    ),
    now(), now()
  );
  perform public.apply_payment_event_v1((event_response ->> 'webhookEventId')::uuid);
  if not exists (
      select 1 from public.orders order_row
      where order_row.id = (order_response ->> 'orderId')::uuid
        and order_row.order_status = 'placed'
        and order_row.payment_status = 'paid'
    )
    or (select count(*) from public.payment_attempts payment_attempt
        where payment_attempt.payment_id = (prepared ->> 'paymentId')::uuid) <> 1
  then
    raise exception 'Capturing an existing authorization did not place the order safely';
  end if;

  -- Void the existing authorization and verify the distinct terminal reason.
  order_response := public.create_order_v1('armandos', gen_random_uuid()::text, request_payload);
  prepared := public.prepare_payment_v1(
    (order_response ->> 'orderId')::uuid, repeat('4', 64), true, 30, 120
  );
  attempt := public.reserve_payment_attempt_v1(
    (order_response ->> 'orderId')::uuid, repeat('4', 64), gen_random_uuid()
  );
  event_response := public.ingest_payment_webhook_v1(
    'fake', 'test', 'contract-authorization-void', connection_uuid, repeat('5', 64),
    jsonb_build_object('fixture', 'authorization-void'),
    jsonb_build_object(
      'kind', 'payment.authorized',
      'attemptId', attempt ->> 'attemptId',
      'amountCents', attempt ->> 'amountCents',
      'currency', attempt ->> 'currency',
      'providerPaymentReference', 'fake_authorization_void',
      'providerStatus', 'AUTHORIZED'
    ),
    now(), now()
  );
  perform public.apply_payment_event_v1((event_response ->> 'webhookEventId')::uuid);
  action_reservation := public.reserve_fake_authorization_action_v1(
    (order_response ->> 'orderId')::uuid, repeat('4', 64), 'void', gen_random_uuid()
  );
  event_response := public.ingest_payment_webhook_v1(
    'fake', 'test', 'contract-authorization-voided', connection_uuid, repeat('6', 64),
    jsonb_build_object('fixture', 'authorization-voided'),
    jsonb_build_object(
      'kind', 'payment.failed',
      'attemptId', attempt ->> 'attemptId',
      'amountCents', attempt ->> 'amountCents',
      'currency', attempt ->> 'currency',
      'providerPaymentReference', 'fake_authorization_void',
      'providerStatus', 'VOIDED',
      'failureCategory', 'authorization_voided',
      'failureCode', 'AUTHORIZATION_VOIDED'
    ),
    now(), now()
  );
  perform public.apply_payment_event_v1((event_response ->> 'webhookEventId')::uuid);
  payment_status := public.authorize_payment_session_v1(
    (order_response ->> 'orderId')::uuid, repeat('4', 64)
  );
  if payment_status ->> 'status' <> 'failed'
    or payment_status ->> 'orderStatus' <> 'cancelled'
    or payment_status #>> '{latestAttempt,failureCategory}' <> 'authorization_voided'
    or not exists (
      select 1 from public.orders order_row
      where order_row.id = (order_response ->> 'orderId')::uuid
        and order_row.cancellation_reason = 'authorization_voided'
    )
    or (select count(*) from public.payment_attempts payment_attempt
        where payment_attempt.payment_id = (prepared ->> 'paymentId')::uuid) <> 1
  then
    raise exception 'Voiding an authorization did not terminally unlock the original attempt: %', payment_status;
  end if;

  -- Accept a quarantined late success without auto-placing it beforehand.
  order_response := public.create_order_v1('armandos', gen_random_uuid()::text, request_payload);
  prepared := public.prepare_payment_v1(
    (order_response ->> 'orderId')::uuid, repeat('5', 64), true, 30, 120
  );
  attempt := public.reserve_payment_attempt_v1(
    (order_response ->> 'orderId')::uuid, repeat('5', 64), gen_random_uuid()
  );
  event_response := public.ingest_payment_webhook_v1(
    'fake', 'test', 'contract-late-accept-cancelled', connection_uuid, repeat('7', 64),
    jsonb_build_object('fixture', 'late-accept-cancelled'),
    jsonb_build_object(
      'kind', 'payment.cancelled',
      'attemptId', attempt ->> 'attemptId',
      'amountCents', attempt ->> 'amountCents',
      'currency', attempt ->> 'currency',
      'providerStatus', 'CANCELLED'
    ),
    now(), now()
  );
  perform public.apply_payment_event_v1((event_response ->> 'webhookEventId')::uuid);
  event_response := public.ingest_payment_webhook_v1(
    'fake', 'test', 'contract-late-accept-succeeded', connection_uuid, repeat('8', 64),
    jsonb_build_object('fixture', 'late-accept-succeeded'),
    jsonb_build_object(
      'kind', 'payment.succeeded',
      'attemptId', attempt ->> 'attemptId',
      'amountCents', attempt ->> 'amountCents',
      'currency', attempt ->> 'currency',
      'providerPaymentReference', 'fake_late_accept',
      'providerStatus', 'SUCCEEDED'
    ),
    now(), now()
  );
  perform public.apply_payment_event_v1((event_response ->> 'webhookEventId')::uuid);
  if (select order_status from public.orders order_row
      where order_row.id = (order_response ->> 'orderId')::uuid) <> 'cancelled'
  then
    raise exception 'Late success was placed before explicit acceptance';
  end if;
  late_resolution := public.reserve_fake_late_success_resolution_v1(
    (order_response ->> 'orderId')::uuid, repeat('5', 64), 'accepted', gen_random_uuid()
  );
  payment_status := public.accept_fake_late_success_v1(
    (order_response ->> 'orderId')::uuid, repeat('5', 64)
  );
  if payment_status ->> 'orderStatus' <> 'placed'
    or payment_status ->> 'paymentStatus' <> 'paid'
    or (select count(*) from public.analytics_outbox outbox
        where outbox.event_type = 'purchase'
          and outbox.aggregate_id = (prepared ->> 'paymentId')::uuid) <> 1
  then
    raise exception 'Explicit late-success acceptance did not place the order: %', payment_status;
  end if;

  -- Refund a separate quarantined late success through the refund event path.
  order_response := public.create_order_v1('armandos', gen_random_uuid()::text, request_payload);
  prepared := public.prepare_payment_v1(
    (order_response ->> 'orderId')::uuid, repeat('6', 64), true, 30, 120
  );
  attempt := public.reserve_payment_attempt_v1(
    (order_response ->> 'orderId')::uuid, repeat('6', 64), gen_random_uuid()
  );
  event_response := public.ingest_payment_webhook_v1(
    'fake', 'test', 'contract-late-refund-cancelled', connection_uuid, repeat('9', 64),
    jsonb_build_object('fixture', 'late-refund-cancelled'),
    jsonb_build_object(
      'kind', 'payment.cancelled',
      'attemptId', attempt ->> 'attemptId',
      'amountCents', attempt ->> 'amountCents',
      'currency', attempt ->> 'currency',
      'providerStatus', 'CANCELLED'
    ),
    now(), now()
  );
  perform public.apply_payment_event_v1((event_response ->> 'webhookEventId')::uuid);
  event_response := public.ingest_payment_webhook_v1(
    'fake', 'test', 'contract-late-refund-succeeded', connection_uuid, repeat('a', 64),
    jsonb_build_object('fixture', 'late-refund-succeeded'),
    jsonb_build_object(
      'kind', 'payment.succeeded',
      'attemptId', attempt ->> 'attemptId',
      'amountCents', attempt ->> 'amountCents',
      'currency', attempt ->> 'currency',
      'providerPaymentReference', 'fake_late_refund',
      'providerStatus', 'SUCCEEDED'
    ),
    now(), now()
  );
  perform public.apply_payment_event_v1((event_response ->> 'webhookEventId')::uuid);
  late_resolution := public.reserve_fake_late_success_resolution_v1(
    (order_response ->> 'orderId')::uuid, repeat('6', 64), 'refunded', gen_random_uuid()
  );
  refund_response := public.reserve_refund_v1(
    (prepared ->> 'paymentId')::uuid,
    (late_resolution ->> 'resolutionKey')::uuid,
    (prepared ->> 'amountCents')::integer,
    'Late success contract refund',
    'contract_test'
  );
  event_response := public.ingest_payment_webhook_v1(
    'fake', 'test', 'contract-late-refund-completed', connection_uuid, repeat('b', 64),
    jsonb_build_object('fixture', 'late-refund-completed'),
    jsonb_build_object(
      'kind', 'refund.succeeded',
      'refundId', refund_response ->> 'refundId',
      'amountCents', refund_response ->> 'amountCents',
      'currency', refund_response ->> 'currency',
      'providerRefundReference', 'fake_late_refund_completed',
      'providerStatus', 'SUCCEEDED'
    ),
    now(), now()
  );
  perform public.apply_payment_event_v1((event_response ->> 'webhookEventId')::uuid);
  payment_status := public.authorize_payment_session_v1(
    (order_response ->> 'orderId')::uuid, repeat('6', 64)
  );
  if payment_status ->> 'status' <> 'refunded'
    or payment_status ->> 'orderStatus' <> 'cancelled'
    or payment_status ->> 'paymentStatus' <> 'refunded'
    or exists (
      select 1 from public.analytics_outbox outbox
      where outbox.event_type = 'purchase'
        and outbox.aggregate_id = (prepared ->> 'paymentId')::uuid
    )
    or (select count(*) from public.payment_attempts payment_attempt
        where payment_attempt.payment_id = (prepared ->> 'paymentId')::uuid) <> 1
  then
    raise exception 'Explicit late-success refund did not preserve quarantine: %', payment_status;
  end if;

  -- A pristine requires_payment_method checkout can be abandoned atomically.
  order_response := public.create_order_v1('armandos', gen_random_uuid()::text, request_payload);
  prepared := public.prepare_payment_v1(
    (order_response ->> 'orderId')::uuid, repeat('c', 64), true, 30, 120
  );
  abandonment_response := public.abandon_checkout_v1(
    (order_response ->> 'orderId')::uuid, repeat('c', 64)
  );
  if not (abandonment_response ->> 'abandoned')::boolean
    or not exists (
      select 1 from public.orders order_row
      where order_row.id = (order_response ->> 'orderId')::uuid
        and order_row.order_status = 'cancelled'
        and order_row.payment_status = 'failed'
        and order_row.cancellation_reason = 'checkout_abandoned'
    )
    or (select status from public.payments payment
        where payment.id = (prepared ->> 'paymentId')::uuid) <> 'cancelled'
    or exists (
      select 1 from public.payment_checkout_sessions session
      where session.payment_id = (prepared ->> 'paymentId')::uuid
        and session.revoked_at is null
    )
    or (select count(*) from public.payment_state_transitions transition
        where transition.payment_id = (prepared ->> 'paymentId')::uuid
          and transition.event_type = 'checkout.abandoned') <> 1
  then
    raise exception 'Safe checkout abandonment did not cancel and revoke atomically: %', abandonment_response;
  end if;

  begin
    perform public.reserve_payment_attempt_v1(
      (order_response ->> 'orderId')::uuid, repeat('c', 64), gen_random_uuid()
    );
    raise exception 'Abandoned checkout accepted a later payment attempt';
  exception when others then
    if sqlerrm not like 'MM_INVALID_PAYMENT_SESSION|%'
      and sqlerrm not like 'MM_PAYMENT_NOT_ALLOWED|%'
    then
      raise;
    end if;
  end;

  -- Once reservation has started provider work, abandonment loses the race.
  order_response := public.create_order_v1('armandos', gen_random_uuid()::text, request_payload);
  prepared := public.prepare_payment_v1(
    (order_response ->> 'orderId')::uuid, repeat('d', 64), true, 30, 120
  );
  attempt := public.reserve_payment_attempt_v1(
    (order_response ->> 'orderId')::uuid, repeat('d', 64), gen_random_uuid()
  );
  begin
    perform public.abandon_checkout_v1(
      (order_response ->> 'orderId')::uuid, repeat('d', 64)
    );
    raise exception 'Processing payment was abandoned';
  exception when others then
    if sqlerrm not like 'MM_PAYMENT_IN_PROGRESS|%' then
      raise;
    end if;
  end;

  perform public.record_payment_command_result_v1(
    (attempt ->> 'attemptId')::uuid,
    'unknown',
    null, null, 'REQUEST_OUTCOME_UNKNOWN',
    'provider_unavailable', null, null,
    jsonb_build_object('fixture', 'abandonment-race')
  );
  begin
    perform public.abandon_checkout_v1(
      (order_response ->> 'orderId')::uuid, repeat('d', 64)
    );
    raise exception 'Unknown payment was abandoned';
  exception when others then
    if sqlerrm not like 'MM_PAYMENT_IN_PROGRESS|%' then
      raise;
    end if;
  end;

  if not exists (
    select 1 from public.orders order_row
    join public.payments payment on payment.order_id = order_row.id
    join public.payment_attempts payment_attempt on payment_attempt.payment_id = payment.id
    where order_row.id = (order_response ->> 'orderId')::uuid
      and order_row.order_status = 'pending_payment'
      and payment.status = 'processing'
      and payment_attempt.status = 'unknown'
  ) or exists (
    select 1 from public.payment_checkout_sessions session
    where session.payment_id = (prepared ->> 'paymentId')::uuid
      and session.revoked_at is not null
  ) then
    raise exception 'Rejected abandonment mutated an uncertain payment';
  end if;
end;
$$;

rollback;
