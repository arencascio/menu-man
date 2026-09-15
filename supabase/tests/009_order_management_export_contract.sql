-- STAGING CONTRACT TEST. Run after 202609140004 and first-owner bootstrap.
-- The transaction rolls back the synthetic completed order and overrides.

begin;

do $$
declare
  restaurant_uuid uuid;
  menu_uuid uuid;
  owner_membership_uuid uuid;
  owner_user_uuid uuid;
  order_uuid uuid := gen_random_uuid();
  order_number_value bigint;
  placed_date date;
  pickup_date date;
begin
  select restaurant.id into strict restaurant_uuid
  from public.restaurants restaurant
  where restaurant.slug = 'armandos' and restaurant.is_active;

  select menu.id into strict menu_uuid
  from public.menus menu
  where menu.restaurant_id = restaurant_uuid and menu.is_published
  order by menu.created_at limit 1;

  select membership.id, membership.user_id
    into strict owner_membership_uuid, owner_user_uuid
  from public.restaurant_memberships membership
  where membership.restaurant_id = restaurant_uuid
    and membership.role = 'owner' and membership.status = 'active'
  order by membership.created_at limit 1;

  select coalesce(max(order_record.order_number), 1000) + 1
    into order_number_value
  from public.orders order_record
  where order_record.restaurant_id = restaurant_uuid;

  insert into public.orders (
    id, restaurant_id, menu_id, order_number, idempotency_key,
    request_fingerprint, order_status, payment_status, customer_name,
    customer_phone, customer_email, special_instructions, pickup_mode,
    pickup_at, pickup_timezone, currency, subtotal_cents, tax_strategy,
    tax_rate_basis_points, tax_cents, tip_basis_points, tip_cents,
    total_cents, placed_at
  ) values (
    order_uuid, restaurant_uuid, menu_uuid, order_number_value,
    gen_random_uuid()::text, repeat('9', 64), 'placed', 'paid',
    'Export, "Contract" Customer', '555-0100', 'export@example.invalid',
    null, 'scheduled', now() + interval '2 days',
    'America/Los_Angeles', 'USD', 1000, 'restaurant_percentage',
    0, 0, 0, 0, 1000, now()
  );

  update public.order_fulfillments
  set status = 'completed', version = version + 1,
      status_changed_at = now(), preparing_at = now(), ready_at = now(),
      completed_at = now()
  where order_id = order_uuid;

  placed_date := (now() at time zone 'America/Los_Angeles')::date;
  pickup_date := ((now() + interval '2 days') at time zone 'America/Los_Angeles')::date;
  perform set_config('request.jwt.claims', jsonb_build_object(
    'sub', owner_user_uuid, 'role', 'authenticated'
  )::text, true);

  if not exists (
    select 1 from public.list_managed_order_export_rows_v1(
      'armandos', placed_date, placed_date, 'placed'
    ) export where export.order_id = order_uuid
      and export.item_count = 0
      and export.pickup_mode = 'scheduled'
      and export.ready_at is not null
      and export.ready_on_time
      and export.customer_name = 'Export, "Contract" Customer'
  ) then raise exception 'Placed-date export omitted or corrupted the completed order'; end if;

  if exists (
    select 1 from public.list_managed_order_export_rows_v1(
      'armandos', placed_date, placed_date, 'pickup'
    ) export where export.order_id = order_uuid
  ) or not exists (
    select 1 from public.list_managed_order_export_rows_v1(
      'armandos', pickup_date, pickup_date, 'pickup'
    ) export where export.order_id = order_uuid
  ) then raise exception 'Export date basis did not switch between placed and pickup'; end if;

  insert into public.restaurant_membership_permission_overrides (
    restaurant_id, membership_id, capability, allowed, created_by_user_id
  ) values (
    restaurant_uuid, owner_membership_uuid, 'view_customer_contact', false,
    owner_user_uuid
  ) on conflict (membership_id, capability) do update set allowed = false;

  if exists (
    select 1 from public.list_managed_order_export_rows_v1(
      'armandos', placed_date, placed_date, 'placed'
    ) export where export.order_id = order_uuid and export.customer_name is not null
  ) then raise exception 'Export exposed customer name without contact permission'; end if;

  insert into public.restaurant_membership_permission_overrides (
    restaurant_id, membership_id, capability, allowed, created_by_user_id
  ) values (
    restaurant_uuid, owner_membership_uuid, 'export_order_history', false,
    owner_user_uuid
  ) on conflict (membership_id, capability) do update set allowed = false;
  begin
    perform public.list_managed_order_export_rows_v1(
      'armandos', placed_date, placed_date, 'placed'
    );
    raise exception 'Member without export permission exported orders';
  exception when others then
    if sqlerrm not like 'MM_MANAGEMENT_FORBIDDEN|%' then raise; end if;
  end;

  perform set_config('request.jwt.claims', jsonb_build_object(
    'sub', gen_random_uuid(), 'role', 'authenticated'
  )::text, true);
  begin
    perform public.list_managed_order_export_rows_v1(
      'armandos', placed_date, placed_date, 'placed'
    );
    raise exception 'Cross-tenant/non-member export succeeded';
  exception when others then
    if sqlerrm not like 'MM_MANAGEMENT_FORBIDDEN|%' then raise; end if;
  end;
end;
$$;

rollback;
