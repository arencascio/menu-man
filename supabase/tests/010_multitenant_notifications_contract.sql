-- STAGING CONTRACT TEST. Run after 006_test_kitchen.sql and
-- 007_test_kitchen_memberships.sql. All synthetic records roll back.

begin;

do $$
declare
  armandos_uuid uuid;
  test_uuid uuid;
  armandos_menu uuid;
  test_menu uuid;
  owner_user uuid;
  test_membership uuid;
  armandos_order uuid := gen_random_uuid();
  test_order uuid := gen_random_uuid();
  disabled_order uuid := gen_random_uuid();
  target_outbox uuid;
  test_item uuid;
  test_option uuid;
  checkout_response jsonb;
  prepared_payment jsonb;
  checkout_pickup text;
  claimed_id uuid;
  claimed_token uuid;
  settings_response jsonb;
  today_local date := (now() at time zone 'America/Los_Angeles')::date;
begin
  select id into strict armandos_uuid from public.restaurants where slug = 'armandos';
  select id into strict test_uuid from public.restaurants
    where slug = 'test-kitchen' and not is_indexable;
  select id into strict armandos_menu from public.menus
    where restaurant_id = armandos_uuid and is_published limit 1;
  select id into strict test_menu from public.menus
    where restaurant_id = test_uuid and is_published limit 1;
  select id into strict test_item from public.menu_items
    where restaurant_id = test_uuid and source_system = 'menu-man-staging'
      and source_item_id = 'test-bowl' and is_orderable;
  select id into strict test_option from public.modifier_options
    where restaurant_id = test_uuid and source_system = 'menu-man-staging'
      and source_option_id = 'chicken' and is_active;
  select membership.user_id into strict owner_user
  from public.restaurant_memberships membership
  where membership.restaurant_id = armandos_uuid
    and membership.role = 'owner' and membership.status = 'active' limit 1;
  select membership.id into strict test_membership
  from public.restaurant_memberships membership
  where membership.restaurant_id = test_uuid and membership.user_id = owner_user
    and membership.status = 'active';

  perform set_config('request.jwt.claims', jsonb_build_object(
    'sub', owner_user, 'role', 'authenticated'
  )::text, true);
  if (select count(*) from public.list_my_restaurant_memberships_v1()
      where restaurant_slug in ('armandos', 'test-kitchen')) <> 2 then
    raise exception 'Multi-membership selector source did not return both restaurants';
  end if;
  if not private.member_has_capability_v1(test_membership, 'owner', 'manage_notifications')
    or private.member_has_capability_v1(test_membership, 'staff', 'manage_notifications') then
    raise exception 'Notification role defaults are incorrect';
  end if;

  select slot ->> 'pickupAt' into strict checkout_pickup
  from jsonb_array_elements(
    public.get_pickup_availability_v1('test-kitchen', now()) #> '{scheduled,slots}'
  ) slot order by (slot ->> 'pickupAt')::timestamptz limit 1;
  checkout_response := public.create_order_v1(
    'test-kitchen', gen_random_uuid()::text,
    jsonb_build_object(
      'menuId', test_menu,
      'items', jsonb_build_array(jsonb_build_object(
        'menuItemId', test_item, 'quantity', 1,
        'modifierOptionIds', jsonb_build_array(test_option),
        'specialInstructions', null
      )),
      'customer', jsonb_build_object(
        'name', 'Test Kitchen Checkout', 'phone', '(951) 555-0110', 'email', 'checkout@example.invalid'
      ),
      'pickup', jsonb_build_object('mode', 'scheduled', 'pickupAt', checkout_pickup),
      'tipChoice', 'none', 'orderNotes', null
    )
  );
  prepared_payment := public.prepare_payment_v1(
    (checkout_response ->> 'orderId')::uuid, repeat('d', 64), true, 30, 120
  );
  if checkout_response ->> 'orderStatus' <> 'pending_payment'
    or prepared_payment ->> 'provider' <> 'fake'
    or prepared_payment ->> 'providerEnvironment' <> 'test'
  then raise exception 'Test Kitchen normal checkout did not prepare a fake payment'; end if;

  insert into public.orders (
    id, restaurant_id, menu_id, order_number, idempotency_key,
    request_fingerprint, order_status, payment_status, customer_name,
    customer_email, pickup_mode, pickup_at, pickup_timezone, currency,
    subtotal_cents, tax_strategy, tax_rate_basis_points, tax_cents,
    tip_basis_points, tip_cents, total_cents
  ) values
    (armandos_order, armandos_uuid, armandos_menu,
      coalesce((select max(order_number) from public.orders where restaurant_id = armandos_uuid), 1000) + 10,
      gen_random_uuid()::text, repeat('a', 64), 'pending_payment', 'unpaid',
      'Armando Tenant Customer', 'armando-tenant@example.invalid', 'asap', now() + interval '20 minutes',
      'America/Los_Angeles', 'USD', 1000, 'restaurant_percentage', 0, 0, 0, 0, 1000),
    (test_order, test_uuid, test_menu,
      coalesce((select max(order_number) from public.orders where restaurant_id = test_uuid), 1000) + 10,
      gen_random_uuid()::text, repeat('b', 64), 'pending_payment', 'unpaid',
      'Test Tenant Customer', 'test-tenant@example.invalid', 'scheduled', now() + interval '30 minutes',
      'America/Los_Angeles', 'USD', 1200, 'restaurant_percentage', 0, 0, 0, 0, 1200);
  update public.orders set order_status = 'placed', payment_status = 'paid', placed_at = now()
  where id in (armandos_order, test_order);

  if exists (select 1 from public.list_managed_orders_v1('armandos', 'active') where order_id = test_order)
    or exists (select 1 from public.list_managed_orders_v1('test-kitchen', 'active') where order_id = armandos_order)
    or not exists (select 1 from public.list_managed_orders_v1('armandos', 'active') where order_id = armandos_order)
    or not exists (select 1 from public.list_managed_orders_v1('test-kitchen', 'active') where order_id = test_order)
  then raise exception 'Order list read model crossed restaurant boundaries'; end if;

  begin
    perform public.get_managed_order_detail_v1('test-kitchen', armandos_order);
    raise exception 'Cross-tenant order detail succeeded';
  exception when others then
    if sqlerrm not like 'MM_MANAGEMENT_NOT_FOUND|%' then raise; end if;
  end;

  update public.restaurant_memberships set status = 'revoked', revoked_at = now()
  where id = test_membership;
  begin
    perform public.list_restaurant_team_v1('test-kitchen');
    raise exception 'Cross-tenant team access succeeded without membership';
  exception when others then
    if sqlerrm not like 'MM_MANAGEMENT_FORBIDDEN|%' then raise; end if;
  end;
  if not exists (select 1 from public.list_restaurant_team_v1('armandos')) then
    raise exception 'Revoking Test Kitchen access affected Armando access';
  end if;
  update public.restaurant_memberships set status = 'active', revoked_at = null
  where id = test_membership;

  update public.order_fulfillments set status = 'completed', version = version + 1,
    preparing_at = now(), ready_at = now(), completed_at = now(), status_changed_at = now()
  where order_id = armandos_order;
  if not exists (select 1 from public.list_managed_order_export_rows_v1(
      'armandos', today_local, today_local, 'placed') where order_id = armandos_order)
  then raise exception 'Armando export omitted its own completed order'; end if;

  settings_response := public.update_restaurant_notification_settings_v1(
    'test-kitchen', jsonb_build_object(
      'customerOrderConfirmationEmail', true,
      'customerReadyForPickupEmail', true,
      'customerRefundConfirmationEmail', false,
      'internalNewPaidOrderEmail', false,
      'internalPaymentRefundExceptionEmail', false,
      'internalEmailRecipient', null
    ), gen_random_uuid()
  );
  if settings_response ->> 'customerOrderConfirmationEmail' <> 'true'
    or not exists (select 1 from public.restaurant_notification_setting_events event
      where event.restaurant_id = test_uuid and event.actor_user_id = owner_user)
  then raise exception 'Notification setting change was not authorized and audited'; end if;

  -- The earlier authoritative placement must have atomically queued one email.
  if (select count(*) from public.notification_outbox outbox
      where outbox.order_id = test_order
        and outbox.notification_type = 'customer.order_confirmed') <> 1 then
    raise exception 'Order confirmation was not queued exactly once';
  end if;
  update public.orders set payment_status = 'paid' where id = test_order;
  if (select count(*) from public.notification_outbox outbox
      where outbox.order_id = test_order
        and outbox.notification_type = 'customer.order_confirmed') <> 1 then
    raise exception 'Repeated order update duplicated confirmation';
  end if;

  perform public.transition_order_fulfillment_v1(
    'test-kitchen', test_order, 1, 'preparing', gen_random_uuid());
  perform public.transition_order_fulfillment_v1(
    'test-kitchen', test_order, 2, 'ready', gen_random_uuid());
  update public.order_fulfillments set status = 'ready' where order_id = test_order;
  if (select count(*) from public.notification_outbox outbox
      where outbox.order_id = test_order
        and outbox.notification_type = 'customer.ready_for_pickup') <> 1 then
    raise exception 'Ready notification was not queued exactly once';
  end if;

  perform public.update_restaurant_notification_settings_v1(
    'test-kitchen', jsonb_build_object(
      'customerOrderConfirmationEmail', false,
      'customerReadyForPickupEmail', true,
      'customerRefundConfirmationEmail', true,
      'internalNewPaidOrderEmail', false,
      'internalPaymentRefundExceptionEmail', false,
      'internalEmailRecipient', null
    ), gen_random_uuid()
  );
  insert into public.orders (
    id, restaurant_id, menu_id, order_number, idempotency_key,
    request_fingerprint, order_status, payment_status, customer_name,
    customer_email, pickup_mode, pickup_at, pickup_timezone, currency,
    subtotal_cents, tax_strategy, tax_rate_basis_points, tax_cents,
    tip_basis_points, tip_cents, total_cents
  ) values (
    disabled_order, test_uuid, test_menu,
    coalesce((select max(order_number) from public.orders where restaurant_id = test_uuid), 1000) + 10,
    gen_random_uuid()::text, repeat('c', 64), 'pending_payment', 'unpaid',
    'Disabled Notification Customer', 'disabled@example.invalid', 'asap', now() + interval '20 minutes',
    'America/Los_Angeles', 'USD', 800, 'restaurant_percentage', 0, 0, 0, 0, 800
  );
  update public.orders set order_status = 'placed', payment_status = 'paid', placed_at = now()
  where id = disabled_order;
  if exists (select 1 from public.notification_outbox where order_id = disabled_order) then
    raise exception 'Disabled notification type created an outbox delivery';
  end if;
  update public.order_fulfillments set status = 'completed', version = version + 1,
    preparing_at = now(), ready_at = now(), completed_at = now(), status_changed_at = now()
  where order_id = disabled_order;
  if exists (select 1 from public.list_managed_order_export_rows_v1(
      'armandos', today_local, today_local, 'placed') where order_id = disabled_order)
    or not exists (select 1 from public.list_managed_order_export_rows_v1(
      'test-kitchen', today_local, today_local, 'placed') where order_id = disabled_order)
  then raise exception 'Export crossed restaurant boundaries'; end if;

  insert into public.restaurant_membership_permission_overrides (
    restaurant_id, membership_id, capability, allowed, created_by_user_id
  ) values (test_uuid, test_membership, 'manage_notifications', false, owner_user);
  begin
    perform public.get_restaurant_notification_settings_v1('test-kitchen');
    raise exception 'Notification settings were visible without permission';
  exception when others then
    if sqlerrm not like 'MM_MANAGEMENT_FORBIDDEN|%' then raise; end if;
  end;
  delete from public.restaurant_membership_permission_overrides
  where membership_id = test_membership and capability = 'manage_notifications';

  -- Isolate one outbox row and exercise the retry state machine. Email delivery
  -- is deliberately outside the business transaction.
  select id into strict target_outbox from public.notification_outbox
  where order_id = test_order and notification_type = 'customer.order_confirmed';
  update public.notification_outbox set status = 'permanent_failure', next_attempt_at = null
  where id <> target_outbox and status in ('pending', 'retry', 'delivering');
  update public.notification_outbox set status = 'pending', available_at = now() - interval '1 minute'
  where id = target_outbox;
  select claim.outbox_id, claim.claim_token into strict claimed_id, claimed_token
  from public.claim_notification_outbox_v1(5) claim where claim.outbox_id = target_outbox;
  perform public.complete_notification_delivery_v1(
    claimed_id, claimed_token, false, true, 503, null, 'application_error', 'Temporary failure');
  if (select status from public.notification_outbox where id = target_outbox) <> 'retry'
    or (select order_status from public.orders where id = test_order) <> 'placed'
    or (select status from public.order_fulfillments where order_id = test_order) <> 'ready'
  then raise exception 'Resend failure altered business state or was not retryable'; end if;
  update public.notification_outbox set next_attempt_at = now() - interval '1 second'
  where id = target_outbox;
  select claim.outbox_id, claim.claim_token into strict claimed_id, claimed_token
  from public.claim_notification_outbox_v1(5) claim where claim.outbox_id = target_outbox;
  perform public.complete_notification_delivery_v1(
    claimed_id, claimed_token, true, false, 200, 'resend-contract-id', null, null);
  if (select status from public.notification_outbox where id = target_outbox) <> 'sent'
    or (select count(*) from public.notification_delivery_attempts
      where notification_outbox_id = target_outbox) <> 2
  then raise exception 'Notification retry did not settle exactly once'; end if;

  if has_table_privilege('authenticated', 'public.notification_outbox', 'SELECT')
    or has_table_privilege('authenticated', 'public.notification_outbox', 'DELETE')
    or has_function_privilege('authenticated', 'public.claim_notification_outbox_v1(integer)', 'EXECUTE')
    or has_function_privilege('anon', 'public.get_restaurant_notification_settings_v1(text)', 'EXECUTE')
  then raise exception 'Notification privilege boundary is too broad'; end if;
end;
$$;

rollback;
