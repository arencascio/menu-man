-- STAGING CONTRACT. All settings, orders, and synthetic verified events roll back.
-- The isolated retry_contract provider prevents the drain from touching other due work.
begin;

do $$
declare
  restaurant_uuid uuid;
  connection_uuid uuid;
  menu_uuid uuid;
  item_uuid uuid;
  option_uuid uuid;
  pickup_at_value text;
  access_token_hash text;
  request_payload jsonb;
  order_response jsonb;
  prepared jsonb;
  attempt jsonb;
  event_response jsonb;
  failed_event_uuid uuid;
  poison_event_uuid uuid;
  payment_uuid uuid;
  drain_result jsonb;
  event_prefix text := 'retry-contract-' || gen_random_uuid()::text;
  i integer;
begin
  if not exists (select 1 from cron.job
      where jobname = 'menu-man-payment-events'
        and schedule = '* * * * *'
        and command = 'select public.drain_due_payment_webhooks_v1(null, 100);')
    or has_function_privilege('anon',
      'public.drain_due_payment_webhooks_v1(text,integer)', 'execute')
    or not has_function_privilege('service_role',
      'public.drain_due_payment_webhooks_v1(text,integer)', 'execute')
  then raise exception 'Payment drain schedule or RPC grants are incorrect'; end if;

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
  set advance_order_days = 1, pickup_max_orders_per_interval = 1000
  where restaurant_id = restaurant_uuid;
  update public.restaurant_payment_connections set is_payment_route = false
  where restaurant_id = restaurant_uuid and is_payment_route;
  insert into public.restaurant_payment_connections (
    restaurant_id, provider_key, environment, connection_status,
    is_payment_route, capabilities
  ) values (
    restaurant_uuid, 'retry_contract', 'test', 'active', true,
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
    'customer', jsonb_build_object('name', 'AUTOMATED RETRY CONTRACT',
      'phone', '(951) 555-0100', 'email', 'retry-contract@example.invalid'),
    'pickup', jsonb_build_object('mode', 'scheduled', 'pickupAt', pickup_at_value),
    'tipChoice', 'none', 'orderNotes', 'ROLLBACK-ONLY RETRY CONTRACT'
  );
  order_response := public.create_order_v1('armandos', gen_random_uuid()::text, request_payload);
  access_token_hash := md5(gen_random_uuid()::text) || md5(gen_random_uuid()::text);
  prepared := public.prepare_payment_v1(
    (order_response ->> 'orderId')::uuid,
    access_token_hash,
    false, 30, 120);
  payment_uuid := (prepared ->> 'paymentId')::uuid;
  attempt := public.reserve_payment_attempt_v1(
    (order_response ->> 'orderId')::uuid, access_token_hash, gen_random_uuid());

  -- The first event is durably ingested but cannot be applied yet.
  event_response := public.ingest_payment_webhook_v1(
    'retry_contract', 'test', event_prefix || '-success', connection_uuid,
    repeat('a', 64), jsonb_build_object('fixture', 'retry-success'),
    jsonb_build_object('kind', 'payment.succeeded', 'attemptId', 'not-a-uuid',
      'amountCents', attempt ->> 'amountCents', 'currency', attempt ->> 'currency',
      'providerPaymentReference', event_prefix || '-payment'),
    now(), now() - interval '1 minute');
  failed_event_uuid := (event_response ->> 'webhookEventId')::uuid;

  -- Twenty-five later, harmless events demonstrate progress past a bad head.
  for i in 1..25 loop
    perform public.ingest_payment_webhook_v1(
      'retry_contract', 'test', event_prefix || '-later-' || i, connection_uuid,
      repeat('b', 64), jsonb_build_object('fixture', 'later-event', 'n', i),
      jsonb_build_object('kind', 'provider.unknown', 'n', i), now(), now());
  end loop;

  drain_result := public.drain_due_payment_webhooks_v1('retry_contract', 25);
  if (drain_result ->> 'claimed')::integer <> 25
    or (drain_result ->> 'failed')::integer <> 1
    or not exists (select 1 from public.payment_webhook_events
      where id = failed_event_uuid and processing_status = 'retryable_failure'
        and attempt_count = 1 and next_attempt_at > now()
        and last_error like 'P0001: MM_INVALID_PAYMENT_EVENT|%')
    or (select count(*) from public.payment_webhook_events
      where provider_key = 'retry_contract' and processing_status = 'ignored') <> 24
  then raise exception 'Failed head did not back off or later events did not progress: %', drain_result; end if;

  drain_result := public.drain_due_payment_webhooks_v1('retry_contract', 25);
  if (drain_result ->> 'claimed')::integer <> 1
    or (select count(*) from public.payment_webhook_events
      where provider_key = 'retry_contract' and processing_status = 'ignored') <> 25
  then raise exception 'The 26th due event was starved: %', drain_result; end if;

  -- Simulate the transient application dependency being repaired, then retry.
  update public.payment_webhook_events
  set normalized_event = jsonb_set(normalized_event, '{attemptId}',
        to_jsonb(attempt ->> 'attemptId')),
      next_attempt_at = now() - interval '1 second'
  where id = failed_event_uuid;
  drain_result := public.drain_due_payment_webhooks_v1('retry_contract', 25);
  if (drain_result ->> 'applied')::integer <> 1
    or not exists (select 1 from public.payment_webhook_events
      where id = failed_event_uuid and processing_status = 'processed'
        and attempt_count = 2 and next_attempt_at is null and last_error is null)
    or not exists (select 1 from public.payments
      where id = payment_uuid and status = 'succeeded')
    or (select count(*) from public.payment_state_transitions
      where webhook_event_id = failed_event_uuid) <> 1
  then raise exception 'Successful retry was not applied exactly once: %', drain_result; end if;

  -- Duplicate provider delivery and duplicate drain cannot repeat the payment.
  event_response := public.ingest_payment_webhook_v1(
    'retry_contract', 'test', event_prefix || '-success', connection_uuid,
    repeat('a', 64), jsonb_build_object('fixture', 'retry-success'),
    jsonb_build_object('kind', 'payment.succeeded', 'attemptId', 'not-a-uuid',
      'amountCents', attempt ->> 'amountCents', 'currency', attempt ->> 'currency',
      'providerPaymentReference', event_prefix || '-payment'), now(), now());
  if (event_response ->> 'inserted')::boolean then
    raise exception 'Duplicate provider delivery inserted a second event';
  end if;
  drain_result := public.drain_due_payment_webhooks_v1('retry_contract', 25);
  if (drain_result ->> 'claimed')::integer <> 0
    or (select count(*) from public.payment_state_transitions
      where webhook_event_id = failed_event_uuid) <> 1
    or (select count(*) from public.analytics_outbox
      where aggregate_id = payment_uuid and event_type = 'purchase') <> 1
  then raise exception 'Duplicate drain repeated financial effects: %', drain_result; end if;

  -- An out-of-order processing event is recorded without regressing success.
  perform public.ingest_payment_webhook_v1(
    'retry_contract', 'test', event_prefix || '-late-processing', connection_uuid,
    repeat('c', 64), jsonb_build_object('fixture', 'late-processing'),
    jsonb_build_object('kind', 'payment.processing', 'attemptId', attempt ->> 'attemptId'),
    now() - interval '1 minute', now());
  perform public.drain_due_payment_webhooks_v1('retry_contract', 25);
  if (select status from public.payments where id = payment_uuid) <> 'succeeded' then
    raise exception 'Out-of-order event regressed payment success';
  end if;

  -- Eight failed applications leave a visible, nonretrying exception.
  event_response := public.ingest_payment_webhook_v1(
    'retry_contract', 'test', event_prefix || '-poison', connection_uuid,
    repeat('d', 64), jsonb_build_object('fixture', 'poison'),
    jsonb_build_object('kind', 'payment.succeeded', 'attemptId', 'not-a-uuid'),
    now(), now());
  poison_event_uuid := (event_response ->> 'webhookEventId')::uuid;
  for i in 1..8 loop
    update public.payment_webhook_events set next_attempt_at = now() - interval '1 second'
    where id = poison_event_uuid;
    perform public.drain_due_payment_webhooks_v1('retry_contract', 1);
    if i < 8 and not exists (select 1 from public.payment_webhook_events
      where id = poison_event_uuid and processing_status = 'retryable_failure'
        and attempt_count = i and next_attempt_at > now()
        and next_attempt_at <= now() + interval '1 hour')
    then raise exception 'Retry % did not receive bounded backoff', i; end if;
  end loop;
  if not exists (select 1 from public.payment_webhook_events
      where id = poison_event_uuid and processing_status = 'permanent_failure'
        and attempt_count = 8 and next_attempt_at is null and last_error is not null)
    or (public.drain_due_payment_webhooks_v1('retry_contract', 25) ->> 'claimed')::integer <> 0
  then raise exception 'Repeated failure was not quarantined visibly'; end if;
end;
$$;

rollback;
