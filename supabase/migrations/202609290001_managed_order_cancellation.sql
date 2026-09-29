-- Restaurant cancellation is one authenticated transaction. Provider-backed
-- refunds remain separate commands: captured money is never described as
-- refunded until a verified refund event has applied.
begin;

insert into public.restaurant_capabilities (capability, description)
values ('cancel_orders', 'Cancel eligible restaurant orders with an audit trail');
insert into public.restaurant_role_capability_defaults (role, capability, allowed)
values ('owner', 'cancel_orders', true),
       ('manager', 'cancel_orders', false),
       ('staff', 'cancel_orders', false);

create table public.order_cancellation_events (
  id bigint generated always as identity primary key,
  restaurant_id uuid not null,
  order_id uuid not null,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  actor_membership_id uuid not null,
  actor_role_snapshot text not null,
  client_action_id uuid not null,
  previous_order_status text not null,
  previous_payment_status text not null,
  captured_cents integer not null,
  refunded_cents integer not null,
  created_at timestamptz not null default now(),
  constraint order_cancellation_events_order_fkey
    foreign key (restaurant_id, order_id)
    references public.orders(restaurant_id, id) on delete restrict,
  constraint order_cancellation_events_membership_fkey
    foreign key (restaurant_id, actor_membership_id)
    references public.restaurant_memberships(restaurant_id, id) on delete restrict,
  constraint order_cancellation_events_role_check
    check (actor_role_snapshot in ('owner', 'manager', 'staff')),
  constraint order_cancellation_events_amounts_check
    check (captured_cents >= 0 and refunded_cents >= 0 and refunded_cents <= captured_cents),
  constraint order_cancellation_events_action_key unique (restaurant_id, client_action_id)
);
create index order_cancellation_events_order_idx
  on public.order_cancellation_events (order_id, created_at, id);
alter table public.order_cancellation_events enable row level security;
revoke all on public.order_cancellation_events from public, anon, authenticated, service_role;

create trigger order_cancellation_broadcast_change
after insert on public.order_cancellation_events
for each row execute function public.broadcast_order_management_change_v1();

create function public.cancel_managed_order_v1(
  p_restaurant_slug text, p_order_id uuid, p_client_action_id uuid
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  access_record record;
  order_record public.orders%rowtype;
  payment_record public.payments%rowtype;
  fulfillment_record public.order_fulfillments%rowtype;
  existing_event public.order_cancellation_events%rowtype;
  actor_user uuid := (select auth.uid());
  refund_due integer;
begin
  select * into strict access_record
  from private.require_restaurant_capability_v1(p_restaurant_slug, 'cancel_orders');
  if p_client_action_id is null or p_order_id is null then
    raise exception using message = 'MM_MANAGEMENT_INVALID_REQUEST|Cancellation request is invalid.';
  end if;

  -- Payment commands and provider events lock payment before the order.
  select * into order_record from public.orders orders
  where orders.id = p_order_id and orders.restaurant_id = access_record.restaurant_id;
  if not found then
    raise exception using message = 'MM_MANAGEMENT_NOT_FOUND|Order was not found.';
  end if;
  select * into payment_record from public.payments payment
  where payment.order_id = p_order_id and payment.restaurant_id = access_record.restaurant_id
  for update;
  if not found then
    raise exception using message = 'MM_MANAGEMENT_CONFLICT|Payment preparation is still in progress.';
  end if;
  select * into fulfillment_record from public.order_fulfillments fulfillment
  where fulfillment.order_id = p_order_id and fulfillment.restaurant_id = access_record.restaurant_id
  for update;
  begin
    -- prepare_payment_v1 locks order before payment. Fail cleanly rather
    -- than wait on that reverse lock order while holding the payment row.
    select * into order_record from public.orders orders
    where orders.id = p_order_id and orders.restaurant_id = access_record.restaurant_id
    for update nowait;
  exception when lock_not_available then
    raise exception using message =
      'MM_MANAGEMENT_CONFLICT|Payment or fulfillment is updating. Try again.';
  end;

  select * into existing_event from public.order_cancellation_events event
  where event.restaurant_id = access_record.restaurant_id
    and event.client_action_id = p_client_action_id;
  if found and (existing_event.order_id <> p_order_id or existing_event.actor_user_id <> actor_user) then
    raise exception using message = 'MM_MANAGEMENT_CONFLICT|Action identifier was already used.';
  end if;
  if order_record.order_status = 'cancelled' then
    return pg_catalog.jsonb_build_object(
      'orderId', p_order_id, 'status', 'cancelled',
      'paymentStatus', order_record.payment_status,
      'refundRequiredCents', greatest(payment_record.captured_cents - payment_record.refunded_cents, 0),
      'replayed', true
    );
  end if;
  if found then
    raise exception using message = 'MM_MANAGEMENT_CONFLICT|Cancellation state changed.';
  end if;

  if order_record.order_status = 'pending_payment' then
    -- A started provider attempt can still succeed late. The existing safe
    -- abandonment path likewise refuses to cancel such an attempt locally.
    if order_record.payment_status <> 'unpaid'
      or payment_record.status <> 'requires_payment_method'
      or payment_record.captured_cents <> 0
      or payment_record.authorized_cents <> 0
      or exists (select 1 from public.payment_attempts attempt
        where attempt.payment_id = payment_record.id)
    then
      raise exception using message =
        'MM_MANAGEMENT_CONFLICT|Payment has started. Review its outcome before cancelling.';
    end if;
    update public.payments set status = 'cancelled',
      cancelled_at = coalesce(cancelled_at, now()), version = version + 1
    where id = payment_record.id;
    update public.orders set order_status = 'cancelled', payment_status = 'failed',
      cancelled_at = coalesce(cancelled_at, now()),
      cancellation_reason = 'restaurant_cancelled'
    where id = p_order_id;
    refund_due := 0;
  elsif order_record.order_status in ('placed', 'confirmed', 'preparing', 'ready') then
    if fulfillment_record.order_id is null or fulfillment_record.status = 'completed'
      or payment_record.status not in ('succeeded', 'partially_refunded', 'refunded')
      or payment_record.captured_cents <= 0
    then
      raise exception using message =
        'MM_MANAGEMENT_CONFLICT|This order can no longer be cancelled safely.';
    end if;
    update public.orders set order_status = 'cancelled',
      cancelled_at = coalesce(cancelled_at, now()),
      cancellation_reason = 'restaurant_cancelled'
    where id = p_order_id;
    refund_due := greatest(payment_record.captured_cents - payment_record.refunded_cents, 0);
  else
    raise exception using message = 'MM_MANAGEMENT_CONFLICT|This order cannot be cancelled.';
  end if;

  -- The capacity projection excludes cancelled orders. Release only pending
  -- reservations; committed rows remain immutable payment history.
  update public.pickup_slot_reservations
  set released_at = coalesce(released_at, now())
  where order_id = p_order_id and committed_at is null and released_at is null;

  insert into public.order_cancellation_events (
    restaurant_id, order_id, actor_user_id, actor_membership_id,
    actor_role_snapshot, client_action_id, previous_order_status,
    previous_payment_status, captured_cents, refunded_cents
  ) values (
    access_record.restaurant_id, p_order_id, actor_user,
    access_record.membership_id, access_record.member_role, p_client_action_id,
    order_record.order_status, order_record.payment_status,
    payment_record.captured_cents, payment_record.refunded_cents
  );
  insert into public.payment_state_transitions (
    restaurant_id, payment_id, source, event_type, previous_state, next_state
  ) values (
    access_record.restaurant_id, payment_record.id, 'command', 'order.cancelled',
    pg_catalog.jsonb_build_object('order', order_record.order_status,
      'orderPayment', order_record.payment_status, 'payment', payment_record.status),
    pg_catalog.jsonb_build_object('order', 'cancelled',
      'orderPayment', case when order_record.order_status = 'pending_payment'
        then 'failed' else order_record.payment_status end,
      'payment', case when order_record.order_status = 'pending_payment'
        then 'cancelled' else payment_record.status end,
      'refundRequiredCents', refund_due)
  );

  return pg_catalog.jsonb_build_object(
    'orderId', p_order_id, 'status', 'cancelled',
    'paymentStatus', case when refund_due = 0 and order_record.order_status = 'pending_payment'
      then 'failed' else order_record.payment_status end,
    'refundRequiredCents', refund_due, 'replayed', false
  );
end;
$$;
revoke all on function public.cancel_managed_order_v1(text, uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.cancel_managed_order_v1(text, uuid, uuid) to authenticated;

create function public.get_managed_order_cancellation_v1(
  p_restaurant_slug text, p_order_id uuid
)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  access_record record;
  order_record public.orders%rowtype;
  payment_record public.payments%rowtype;
  fulfillment_record public.order_fulfillments%rowtype;
begin
  select * into strict access_record
  from private.require_restaurant_capability_v1(p_restaurant_slug, 'view_orders');
  select * into order_record from public.orders orders
  where orders.id = p_order_id and orders.restaurant_id = access_record.restaurant_id;
  if not found then
    raise exception using message = 'MM_MANAGEMENT_NOT_FOUND|Order was not found.';
  end if;
  select * into payment_record from public.payments payment
  where payment.order_id = p_order_id and payment.restaurant_id = access_record.restaurant_id;
  select * into fulfillment_record from public.order_fulfillments fulfillment
  where fulfillment.order_id = p_order_id and fulfillment.restaurant_id = access_record.restaurant_id;
  return pg_catalog.jsonb_build_object(
    'orderStatus', order_record.order_status,
    'cancelledAt', order_record.cancelled_at,
    'cancellationReason', order_record.cancellation_reason,
    'canCancel', case
      when order_record.order_status = 'pending_payment'
        and order_record.payment_status = 'unpaid'
        and payment_record.status = 'requires_payment_method'
        and payment_record.captured_cents = 0 and payment_record.authorized_cents = 0
        and not exists (select 1 from public.payment_attempts attempt
          where attempt.payment_id = payment_record.id)
        then true
      when order_record.order_status in ('placed', 'confirmed', 'preparing', 'ready')
        and fulfillment_record.order_id is not null
        and fulfillment_record.status <> 'completed'
        and payment_record.status in ('succeeded', 'partially_refunded', 'refunded')
        and payment_record.captured_cents > 0 then true
      else false end,
    'timeline', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'id', 'cancellation:' || event.id::text, 'kind', 'cancellation',
        'label', 'Order cancelled', 'actorName', membership.display_name,
        'occurredAt', event.created_at
      ) order by event.created_at, event.id)
      from public.order_cancellation_events event
      left join public.restaurant_memberships membership
        on membership.id = event.actor_membership_id
        and membership.restaurant_id = event.restaurant_id
      where event.order_id = p_order_id and event.restaurant_id = access_record.restaurant_id
    ), '[]'::jsonb)
  );
end;
$$;
revoke all on function public.get_managed_order_cancellation_v1(text, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.get_managed_order_cancellation_v1(text, uuid) to authenticated;

-- Keep the active kitchen queue unchanged. Include cancelled orders (including
-- unpaid ones without a fulfillment row) in the existing history view.
create function public.list_managed_orders_v2(
  p_restaurant_slug text, p_view text default 'active',
  p_from_date date default null, p_to_date date default null,
  p_cursor_at timestamptz default null, p_cursor_order_id uuid default null,
  p_limit integer default 50, p_date_basis text default 'placed'
)
returns table (
  order_id uuid, order_number text, placed_at timestamptz,
  history_date timestamptz, pickup_mode text, pickup_at timestamptz,
  pickup_timezone text, customer_name text, item_summary jsonb,
  item_count integer, total_cents integer, currency text,
  payment_status text, refunded_cents integer, fulfillment_status text,
  fulfillment_version integer, status_changed_at timestamptz,
  completed_at timestamptz, order_status text
)
language plpgsql stable security definer set search_path = '' as $$
declare
  access_record record;
  restaurant_record public.restaurants%rowtype;
begin
  if p_view not in ('active', 'pending', 'history') then
    raise exception using message = 'MM_MANAGEMENT_INVALID_REQUEST|Order query is invalid.';
  end if;
  select * into strict access_record
  from private.require_restaurant_capability_v1(p_restaurant_slug, 'view_orders');
  select * into restaurant_record from public.restaurants restaurant
  where restaurant.id = access_record.restaurant_id;

  return query
  with entries as (
    select base.*, original.order_status as current_order_status
    from public.list_managed_orders_v1(
      p_restaurant_slug, case when p_view = 'pending' then 'active' else p_view end,
      p_from_date, p_to_date,
      p_cursor_at, p_cursor_order_id, p_limit, p_date_basis
    ) base
    join public.orders original on original.id = base.order_id
      and original.restaurant_id = access_record.restaurant_id
    where p_view <> 'pending'
    union all
    select cancelled.id, cancelled.order_number::text,
      coalesce(cancelled.placed_at, cancelled.created_at),
      case when p_view = 'pending' then cancelled.created_at
        when p_date_basis = 'pickup' then cancelled.pickup_at
        else coalesce(cancelled.placed_at, cancelled.created_at) end,
      cancelled.pickup_mode, cancelled.pickup_at, cancelled.pickup_timezone,
      case when access_record.can_view_contact then cancelled.customer_name else null end,
      coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'quantity', item.quantity, 'itemName', item.item_name
      ) order by item.sort_order, item.id)
        from public.order_items item where item.order_id = cancelled.id), '[]'::jsonb),
      coalesce((select sum(item.quantity)::integer from public.order_items item
        where item.order_id = cancelled.id), 0),
      cancelled.total_cents, cancelled.currency, cancelled.payment_status,
      coalesce(payment.refunded_cents, 0), fulfillment.status,
      fulfillment.version, fulfillment.status_changed_at,
      fulfillment.completed_at, cancelled.order_status
    from public.orders cancelled
    left join public.order_fulfillments fulfillment on fulfillment.order_id = cancelled.id
      and fulfillment.restaurant_id = cancelled.restaurant_id
    left join public.payments payment on payment.order_id = cancelled.id
      and payment.restaurant_id = cancelled.restaurant_id
    where cancelled.restaurant_id = access_record.restaurant_id
      and ((p_view = 'history' and cancelled.order_status = 'cancelled')
        or (p_view = 'pending' and cancelled.order_status = 'pending_payment'))
      and (p_view <> 'pending' or payment.id is not null)
      and (p_view = 'pending' or p_from_date is null or (case p_date_basis when 'pickup' then cancelled.pickup_at
        else coalesce(cancelled.placed_at, cancelled.created_at) end) >=
        (p_from_date::timestamp at time zone restaurant_record.timezone))
      and (p_view = 'pending' or p_to_date is null or (case p_date_basis when 'pickup' then cancelled.pickup_at
        else coalesce(cancelled.placed_at, cancelled.created_at) end) <
        ((p_to_date + 1)::timestamp at time zone restaurant_record.timezone))
      and (p_cursor_at is null or ((case when p_view = 'pending' then cancelled.created_at
        when p_date_basis = 'pickup' then cancelled.pickup_at
        else coalesce(cancelled.placed_at, cancelled.created_at) end), cancelled.id)
        < (p_cursor_at, p_cursor_order_id))
  )
  select entry.order_id, entry.order_number, entry.placed_at, entry.history_date,
    entry.pickup_mode, entry.pickup_at, entry.pickup_timezone, entry.customer_name,
    entry.item_summary, entry.item_count, entry.total_cents, entry.currency,
    entry.payment_status, entry.refunded_cents, entry.fulfillment_status,
    entry.fulfillment_version, entry.status_changed_at, entry.completed_at,
    entry.current_order_status
  from entries entry
  order by
    case when p_view = 'active' then entry.pickup_at end asc,
    case when p_view = 'active' then entry.order_id end asc,
    case when p_view = 'history' then entry.history_date end desc,
    case when p_view = 'history' then entry.order_id end desc,
    case when p_view = 'pending' then entry.history_date end desc,
    case when p_view = 'pending' then entry.order_id end desc
  limit p_limit + 1;
end;
$$;
revoke all on function public.list_managed_orders_v2(text, text, date, date, timestamptz, uuid, integer, text)
  from public, anon, authenticated, service_role;
grant execute on function public.list_managed_orders_v2(text, text, date, date, timestamptz, uuid, integer, text)
  to authenticated;

create function public.get_managed_order_detail_v2(
  p_restaurant_slug text, p_order_id uuid
)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  access_record record;
  order_record public.orders%rowtype;
  payment_record public.payments%rowtype;
  detail jsonb;
begin
  select * into strict access_record
  from private.require_restaurant_capability_v1(p_restaurant_slug, 'view_orders');
  select * into order_record from public.orders orders
  where orders.id = p_order_id and orders.restaurant_id = access_record.restaurant_id;
  if not found then
    raise exception using message = 'MM_MANAGEMENT_NOT_FOUND|Order was not found.';
  end if;
  if exists (select 1 from public.order_fulfillments fulfillment
    where fulfillment.order_id = p_order_id and fulfillment.restaurant_id = access_record.restaurant_id)
  then
    return public.get_managed_order_detail_v1(p_restaurant_slug, p_order_id);
  end if;
  if order_record.order_status not in ('pending_payment', 'cancelled') then
    raise exception using message = 'MM_MANAGEMENT_NOT_FOUND|Order was not found.';
  end if;
  select * into payment_record from public.payments payment
  where payment.order_id = p_order_id and payment.restaurant_id = access_record.restaurant_id;
  if not found then
    raise exception using message = 'MM_MANAGEMENT_CONFLICT|Payment preparation is still in progress.';
  end if;

  detail := pg_catalog.jsonb_build_object(
    'orderId', order_record.id, 'orderNumber', order_record.order_number::text,
    'placedAt', order_record.placed_at,
    'pickup', pg_catalog.jsonb_build_object('mode', order_record.pickup_mode,
      'pickupAt', order_record.pickup_at, 'timezone', order_record.pickup_timezone),
    'customer', case when access_record.can_view_contact then pg_catalog.jsonb_build_object(
      'name', order_record.customer_name, 'phone', order_record.customer_phone,
      'email', order_record.customer_email) else null end,
    'orderNotes', order_record.special_instructions,
    'currency', order_record.currency,
    'subtotalCents', order_record.subtotal_cents,
    'taxCents', order_record.tax_cents, 'tipCents', order_record.tip_cents,
    'totalCents', order_record.total_cents,
    'fulfillment', null,
    'items', coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'orderItemId', item.id, 'quantity', item.quantity,
      'itemName', item.item_name, 'unitPriceCents', item.unit_price_cents,
      'lineTotalCents', item.line_total_cents,
      'specialInstructions', item.special_instructions,
      'modifiers', coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'groupName', modifier.modifier_group_name,
        'optionName', modifier.modifier_option_name,
        'priceAdjustmentCents', modifier.price_adjustment_cents
      ) order by modifier.sort_order, modifier.id)
        from public.order_item_modifiers modifier where modifier.order_item_id = item.id), '[]'::jsonb)
    ) order by item.sort_order, item.id)
      from public.order_items item where item.order_id = order_record.id), '[]'::jsonb),
    'timeline', '[]'::jsonb
  );
  return detail;
end;
$$;
revoke all on function public.get_managed_order_detail_v2(text, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.get_managed_order_detail_v2(text, uuid) to authenticated;

-- A provider may redeliver the success for the original captured attempt after
-- an operator cancels. Preserve the cancellation/refund state instead of
-- classifying that duplicate as a new late success.
alter function public.apply_payment_event_v1(uuid)
  rename to apply_payment_event_before_restaurant_cancellation_v1;
revoke all on function public.apply_payment_event_before_restaurant_cancellation_v1(uuid)
  from public, anon, authenticated, service_role;

create function public.apply_payment_event_v1(p_webhook_event_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  event_record record;
  attempt_record record;
  payment_record record;
  order_record record;
  attempt_uuid uuid;
begin
  select id, connection_id, processing_status, normalized_event into event_record
  from public.payment_webhook_events where id = p_webhook_event_id for update;
  if not found then
    return public.apply_payment_event_before_restaurant_cancellation_v1(p_webhook_event_id);
  end if;
  if event_record.processing_status in ('processed', 'ignored')
    or event_record.normalized_event ->> 'kind' <> 'payment.succeeded' then
    return public.apply_payment_event_before_restaurant_cancellation_v1(p_webhook_event_id);
  end if;
  begin
    attempt_uuid := (event_record.normalized_event ->> 'attemptId')::uuid;
  exception when others then
    return public.apply_payment_event_before_restaurant_cancellation_v1(p_webhook_event_id);
  end;
  select id, payment_id, status, connection_id into attempt_record
  from public.payment_attempts where id = attempt_uuid for update;
  if not found then
    return public.apply_payment_event_before_restaurant_cancellation_v1(p_webhook_event_id);
  end if;
  if attempt_record.connection_id <> event_record.connection_id then
    return public.apply_payment_event_before_restaurant_cancellation_v1(p_webhook_event_id);
  end if;
  select id, order_id, status into payment_record from public.payments
  where id = attempt_record.payment_id for update;
  if not found then
    return public.apply_payment_event_before_restaurant_cancellation_v1(p_webhook_event_id);
  end if;
  select id, order_status, cancellation_reason, placed_at into order_record
  from public.orders where id = payment_record.order_id for update;
  if order_record.order_status = 'cancelled'
    and order_record.cancellation_reason = 'restaurant_cancelled'
    and order_record.placed_at is not null
    and attempt_record.status = 'succeeded'
    and payment_record.status in ('succeeded', 'partially_refunded', 'refunded')
  then
    update public.payment_webhook_events
    set processing_status = 'ignored', processed_at = now()
    where id = p_webhook_event_id;
    return pg_catalog.jsonb_build_object('processed', false, 'duplicate', true);
  end if;
  return public.apply_payment_event_before_restaurant_cancellation_v1(p_webhook_event_id);
end;
$$;
revoke all on function public.apply_payment_event_v1(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.apply_payment_event_v1(uuid) to service_role;

commit;
