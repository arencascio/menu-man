-- STAGING CONTRACT TEST. Run after 202609140001 and after the first owner is
-- bootstrapped. The outer transaction rolls back the synthetic order and all
-- permission overrides.

begin;

do $$
declare
  restaurant_uuid uuid;
  menu_uuid uuid;
  owner_membership_uuid uuid;
  owner_user_uuid uuid;
  order_uuid uuid := gen_random_uuid();
  action_uuid uuid := gen_random_uuid();
  result jsonb;
  detail jsonb;
  order_number_value bigint;
begin
  select restaurant.id into strict restaurant_uuid
  from public.restaurants restaurant
  where restaurant.slug = 'armandos' and restaurant.is_active;

  select menu.id into strict menu_uuid
  from public.menus menu
  where menu.restaurant_id = restaurant_uuid and menu.is_published
  order by menu.created_at
  limit 1;

  select membership.id, membership.user_id
  into strict owner_membership_uuid, owner_user_uuid
  from public.restaurant_memberships membership
  where membership.restaurant_id = restaurant_uuid
    and membership.role = 'owner'
    and membership.status = 'active'
  order by membership.created_at
  limit 1;

  if not private.member_has_capability_v1(
    owner_membership_uuid, 'owner', 'manage_memberships'
  ) or not private.member_has_capability_v1(
    owner_membership_uuid, 'owner', 'issue_refunds'
  ) then
    raise exception 'Owner role defaults do not include every granular capability';
  end if;

  if private.member_has_capability_v1(
    owner_membership_uuid, 'staff', 'issue_refunds'
  ) then
    raise exception 'Staff role unexpectedly inherited refund permission';
  end if;

  select coalesce(max(order_record.order_number), 1000) + 1
  into order_number_value
  from public.orders order_record
  where order_record.restaurant_id = restaurant_uuid;

  insert into public.orders (
    id, restaurant_id, menu_id, order_number, idempotency_key,
    request_fingerprint, order_status, payment_status, customer_name,
    customer_phone, customer_email, special_instructions, pickup_mode,
    pickup_at, pickup_timezone, currency, subtotal_cents, tax_strategy,
    tax_rate_basis_points, tax_cents, tip_basis_points, tip_cents, total_cents,
    placed_at
  ) values (
    order_uuid, restaurant_uuid, menu_uuid, order_number_value,
    gen_random_uuid()::text, repeat('7', 64), 'placed', 'paid',
    'Management Contract Customer', '555-0100', 'contract@example.invalid',
    'Management contract note', 'scheduled', now() + interval '20 minutes',
    'America/Los_Angeles', 'USD', 1000, 'restaurant_percentage', 0,
    0, 0, 0, 1000, now()
  );

  if not exists (
    select 1 from public.order_fulfillments fulfillment
    where fulfillment.order_id = order_uuid and fulfillment.status = 'new'
  ) or not exists (
    select 1 from public.order_fulfillment_events event
    where event.order_id = order_uuid
      and event.actor_type = 'system'
      and event.action = 'fulfillment.created'
  ) then
    raise exception 'A paid/placed order did not initialize immutable fulfillment history';
  end if;

  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', owner_user_uuid, 'role', 'authenticated')::text,
    true
  );

  if not exists (
    select 1 from public.list_managed_orders_v1('armandos', 'active') queue
    where queue.order_id = order_uuid
  ) then
    raise exception 'Authorized owner could not read the restaurant queue';
  end if;

  result := public.transition_order_fulfillment_v1(
    'armandos', order_uuid, 1, 'preparing', action_uuid
  );
  if result ->> 'status' <> 'preparing' or (result ->> 'version')::integer <> 2 then
    raise exception 'New order did not advance to preparing: %', result;
  end if;

  result := public.transition_order_fulfillment_v1(
    'armandos', order_uuid, 2, 'preparing', action_uuid
  );
  if not (result ->> 'replayed')::boolean then
    raise exception 'Repeated fulfillment action was not idempotent: %', result;
  end if;

  perform public.transition_order_fulfillment_v1(
    'armandos', order_uuid, 2, 'ready', gen_random_uuid()
  );
  perform public.transition_order_fulfillment_v1(
    'armandos', order_uuid, 3, 'completed', gen_random_uuid()
  );

  if (select count(*) from public.order_fulfillment_events event
      where event.order_id = order_uuid) <> 4
    or exists (
      select 1 from public.order_fulfillment_events event
      where event.order_id = order_uuid
        and event.actor_type = 'admin_user'
        and (event.actor_user_id <> owner_user_uuid
          or event.actor_membership_id <> owner_membership_uuid)
    )
  then
    raise exception 'Fulfillment history is incomplete or not attributable';
  end if;

  if not exists (
    select 1 from public.list_managed_orders_v1(
      'armandos', 'history', current_date - 1, current_date + 1
    ) history where history.order_id = order_uuid
  ) then
    raise exception 'Completed order disappeared from historical pagination';
  end if;

  insert into public.restaurant_membership_permission_overrides (
    restaurant_id, membership_id, capability, allowed, created_by_user_id
  ) values (
    restaurant_uuid, owner_membership_uuid, 'view_customer_contact', false,
    owner_user_uuid
  );
  detail := public.get_managed_order_detail_v1('armandos', order_uuid);
  if detail -> 'customer' <> 'null'::jsonb then
    raise exception 'Explicit contact denial did not redact customer contact';
  end if;

  insert into public.restaurant_membership_permission_overrides (
    restaurant_id, membership_id, capability, allowed, created_by_user_id
  ) values (
    restaurant_uuid, owner_membership_uuid, 'advance_fulfillment', false,
    owner_user_uuid
  );
  if private.member_has_capability_v1(
    owner_membership_uuid, 'owner', 'advance_fulfillment'
  ) then
    raise exception 'Explicit permission denial did not override owner preset';
  end if;

  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', gen_random_uuid(), 'role', 'authenticated')::text,
    true
  );
  begin
    perform public.get_managed_order_detail_v1('armandos', order_uuid);
    raise exception 'A non-member accessed restaurant order detail';
  exception when others then
    if sqlerrm not like 'MM_MANAGEMENT_FORBIDDEN|%' then raise; end if;
  end;

  if has_function_privilege('anon', 'public.list_managed_orders_v1(text,text,date,date,timestamptz,uuid,integer)', 'EXECUTE')
    or has_function_privilege('anon', 'public.transition_order_fulfillment_v1(text,uuid,integer,text,uuid)', 'EXECUTE')
    or has_table_privilege('authenticated', 'public.orders', 'UPDATE')
    or has_table_privilege('authenticated', 'public.payments', 'UPDATE')
    or has_table_privilege('authenticated', 'public.order_fulfillment_events', 'DELETE')
    or has_table_privilege('authenticated', 'public.restaurant_access_events', 'DELETE')
  then
    raise exception 'Management privilege boundary permits an unsafe direct operation';
  end if;
end;
$$;

rollback;
