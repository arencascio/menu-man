-- STAGING CONTRACT TEST. Run after the restaurant/menu/payment fixture.
-- Every configuration change and order is rolled back by the outer transaction.
begin;

do $$
declare
  restaurant_uuid uuid;
  menu_uuid uuid;
  item_uuid uuid;
  option_uuid uuid;
  slot_at timestamptz;
  service_date_value date;
  payload jsonb;
  order_response jsonb;
  prepared jsonb;
  attempt jsonb;
  order_uuid uuid;
  initial_counter bigint;
  failed_key uuid;
begin
  select id into strict restaurant_uuid
  from public.restaurants where slug = 'armandos' and is_active;
  select id into strict menu_uuid from public.menus
  where restaurant_id = restaurant_uuid and is_published;
  select id into strict item_uuid from public.menu_items
  where restaurant_id = restaurant_uuid and source_system = 'doordash'
    and source_item_id = '198880505' and is_orderable;
  select id into strict option_uuid from public.modifier_options
  where restaurant_id = restaurant_uuid and source_system = 'menu-man-test'
    and source_option_id = 'chicken' and is_active;

  update public.restaurant_ordering_settings
  set pickup_enabled = true, scheduled_pickup_enabled = true,
      asap_enabled = true, pickup_lead_time_minutes = 0,
      pickup_cutoff_minutes_before_close = 0, advance_order_days = 1
  where restaurant_id = restaurant_uuid;
  delete from public.restaurant_special_hours
  where restaurant_id = restaurant_uuid;
  delete from public.restaurant_business_hours
  where restaurant_id = restaurant_uuid;
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
  select (slot_at at time zone restaurant.timezone)::date into service_date_value
  from public.restaurants restaurant where restaurant.id = restaurant_uuid;

  payload := jsonb_build_object(
    'menuId', menu_uuid,
    'items', jsonb_build_array(jsonb_build_object(
      'menuItemId', item_uuid, 'quantity', 1,
      'modifierOptionIds', jsonb_build_array(option_uuid),
      'specialInstructions', null
    )),
    'customer', jsonb_build_object('name', 'Final Payment QA',
      'phone', '(951) 555-0100', 'email', 'final-payment@example.invalid'),
    'pickup', jsonb_build_object('mode', 'scheduled', 'pickupAt', slot_at),
    'tipChoice', 'none', 'orderNotes', null
  );

  -- A still-valid selection reserves an attempt normally.
  order_response := public.create_order_v1('armandos', gen_random_uuid()::text, payload);
  prepared := public.prepare_payment_v1((order_response ->> 'orderId')::uuid,
    repeat('1', 64), true, 30, 120);
  -- An unrelated restaurant's changed pickup setting must not affect this one.
  update public.restaurant_ordering_settings set pickup_enabled = false
  where restaurant_id = (select id from public.restaurants where slug = 'test-kitchen');
  attempt := public.reserve_payment_attempt_v1((order_response ->> 'orderId')::uuid,
    repeat('1', 64), gen_random_uuid());
  if attempt ->> 'attemptId' is null then
    raise exception 'Valid scheduled pickup was rejected at final payment';
  end if;

  -- Weekly hours changed after the customer reached payment.
  order_response := public.create_order_v1('armandos', gen_random_uuid()::text, payload);
  order_uuid := (order_response ->> 'orderId')::uuid;
  prepared := public.prepare_payment_v1(order_uuid, repeat('2', 64), true, 30, 120);
  select last_order_number into initial_counter from public.restaurant_order_counters
  where restaurant_id = restaurant_uuid;
  update public.restaurant_business_hours set is_closed = true,
    open_time = null, close_time = null
  where restaurant_id = restaurant_uuid
    and day_of_week = extract(dow from service_date_value)::integer;
  failed_key := gen_random_uuid();
  begin
    perform public.reserve_payment_attempt_v1(order_uuid, repeat('2', 64), failed_key);
    raise exception 'Changed weekly hours accepted stale scheduled pickup';
  exception when others then
    if sqlerrm not like 'MM_PICKUP_UNAVAILABLE|%' then raise; end if;
  end;
  if exists (select 1 from public.payment_attempts where client_attempt_key = failed_key)
    or (select last_order_number from public.restaurant_order_counters
        where restaurant_id = restaurant_uuid) <> initial_counter
    or not exists (select 1 from public.orders where id = order_uuid
        and order_status = 'pending_payment' and payment_status = 'unpaid')
    or not exists (select 1 from public.payments where order_id = order_uuid
        and status = 'requires_payment_method')
  then raise exception 'Rejected weekly-hours reservation changed payment/order/counter'; end if;
  update public.restaurant_business_hours set is_closed = false,
    open_time = time '00:00', close_time = time '00:00'
  where restaurant_id = restaurant_uuid
    and day_of_week = extract(dow from service_date_value)::integer;

  -- A special-hours override invalidates an already prepared order.
  order_response := public.create_order_v1('armandos', gen_random_uuid()::text, payload);
  order_uuid := (order_response ->> 'orderId')::uuid;
  prepared := public.prepare_payment_v1(order_uuid, repeat('3', 64), true, 30, 120);
  delete from public.restaurant_special_hours
  where restaurant_id = restaurant_uuid and service_date = service_date_value;
  insert into public.restaurant_special_hours (restaurant_id, service_date, is_closed)
  values (restaurant_uuid, service_date_value, true);
  failed_key := gen_random_uuid();
  begin
    perform public.reserve_payment_attempt_v1(order_uuid, repeat('3', 64), failed_key);
    raise exception 'Changed special hours accepted stale scheduled pickup';
  exception when others then
    if sqlerrm not like 'MM_PICKUP_UNAVAILABLE|%' then raise; end if;
  end;
  if exists (select 1 from public.payment_attempts where client_attempt_key = failed_key)
  then raise exception 'Special-hours rejection created an attempt'; end if;
  delete from public.restaurant_special_hours
  where restaurant_id = restaurant_uuid and service_date = service_date_value;

  -- A later lead-time/deadline setting removes a formerly valid slot.
  order_response := public.create_order_v1('armandos', gen_random_uuid()::text, payload);
  order_uuid := (order_response ->> 'orderId')::uuid;
  prepared := public.prepare_payment_v1(order_uuid, repeat('4', 64), true, 30, 120);
  update public.restaurant_ordering_settings set pickup_lead_time_minutes = 1440
  where restaurant_id = restaurant_uuid;
  failed_key := gen_random_uuid();
  begin
    perform public.reserve_payment_attempt_v1(order_uuid, repeat('4', 64), failed_key);
    raise exception 'Expired pickup lead-time accepted stale slot';
  exception when others then
    if sqlerrm not like 'MM_PICKUP_UNAVAILABLE|%' then raise; end if;
  end;
  update public.restaurant_ordering_settings set pickup_lead_time_minutes = 0
  where restaurant_id = restaurant_uuid;

  -- A pristine rejected checkout can be abandoned, retaining the browser cart;
  -- the new selection can then create a fresh checkout and payment attempt.
  perform public.abandon_checkout_v1(order_uuid, repeat('4', 64));
  order_response := public.create_order_v1('armandos', gen_random_uuid()::text, payload);
  prepared := public.prepare_payment_v1((order_response ->> 'orderId')::uuid,
    repeat('5', 64), true, 30, 120);
  attempt := public.reserve_payment_attempt_v1((order_response ->> 'orderId')::uuid,
    repeat('5', 64), gen_random_uuid());
  if attempt ->> 'attemptId' is null then
    raise exception 'Valid retry failed after stale pickup rejection';
  end if;

  -- Disable pickup after an ASAP checkout, before payment submission.
  if not coalesce((public.get_pickup_availability_v1('armandos',
      pg_catalog.clock_timestamp()) #>> '{asap,available}')::boolean, false)
  then raise exception 'ASAP test fixture is not open'; end if;
  payload := jsonb_set(payload, '{pickup}', '{"mode":"asap"}'::jsonb);
  order_response := public.create_order_v1('armandos', gen_random_uuid()::text, payload);
  order_uuid := (order_response ->> 'orderId')::uuid;
  prepared := public.prepare_payment_v1(order_uuid, repeat('6', 64), true, 30, 120);
  update public.restaurant_ordering_settings set pickup_enabled = false
  where restaurant_id = restaurant_uuid;
  failed_key := gen_random_uuid();
  begin
    perform public.reserve_payment_attempt_v1(order_uuid, repeat('6', 64), failed_key);
    raise exception 'Disabled ASAP pickup accepted at final payment';
  exception when others then
    if sqlerrm not like 'MM_PICKUP_UNAVAILABLE|%' then raise; end if;
  end;
  if exists (select 1 from public.payment_attempts where client_attempt_key = failed_key)
  then raise exception 'ASAP rejection created an attempt'; end if;
  update public.restaurant_ordering_settings set pickup_enabled = true
  where restaurant_id = restaurant_uuid;
  order_response := public.create_order_v1('armandos', gen_random_uuid()::text, payload);
  prepared := public.prepare_payment_v1((order_response ->> 'orderId')::uuid,
    repeat('7', 64), true, 30, 120);
  attempt := public.reserve_payment_attempt_v1((order_response ->> 'orderId')::uuid,
    repeat('7', 64), gen_random_uuid());
  if attempt ->> 'attemptId' is null then
    raise exception 'Valid ASAP pickup was rejected at final payment';
  end if;
end;
$$;

rollback;
