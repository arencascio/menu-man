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
  event_uuid uuid;
begin
  select id into strict restaurant_uuid
  from public.restaurants where slug = 'armandos' and is_active;

  select id into strict connection_uuid
  from public.restaurant_payment_connections
  where restaurant_id = restaurant_uuid
    and provider_key = 'fake'
    and environment = 'test'
    and connection_status = 'active'
    and is_payment_route;

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
      'email', null
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

  if not exists (
    select 1 from public.orders
    where id = (failed_order_response ->> 'orderId')::uuid
      and order_status = 'cancelled'
      and payment_status = 'failed'
      and cancellation_reason = 'payment_declined'
  ) then
    raise exception 'Conclusive decline did not terminally cancel the order';
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

rollback;
