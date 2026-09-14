-- Order Management v1 refinement: quarantine migration-backfilled orders from
-- active kitchen work, make placed-at the default history basis, enrich queue
-- summaries, and reserve an audited permission/action shape for corrections.

begin;

insert into public.restaurant_capabilities (capability, description)
values (
  'correct_fulfillment',
  'Perform a future reason-required audited fulfillment correction'
)
on conflict (capability) do update
set description = excluded.description;

insert into public.restaurant_role_capability_defaults (role, capability, allowed)
values
  ('owner', 'correct_fulfillment', true),
  ('manager', 'correct_fulfillment', false),
  ('staff', 'correct_fulfillment', false)
on conflict (role, capability) do update
set allowed = excluded.allowed;

alter table public.order_fulfillment_events
  drop constraint order_fulfillment_events_action_check,
  drop constraint order_fulfillment_events_reason_check;

alter table public.order_fulfillment_events
  add constraint order_fulfillment_events_action_check check (
    action in ('fulfillment.created', 'fulfillment.started_preparing',
      'fulfillment.marked_ready', 'fulfillment.completed',
      'fulfillment.historical_backfill_completed', 'fulfillment.corrected')
  ),
  add constraint order_fulfillment_events_reason_check check (
    (reason is null or char_length(reason) <= 500)
    and (action <> 'fulfillment.corrected' or btrim(coalesce(reason, '')) <> '')
  );

create index if not exists orders_management_placed_idx
  on public.orders (restaurant_id, placed_at desc, id desc)
  where placed_at is not null;

-- Only the original migration wrote source=migration_backfill. Normal paid
-- orders created after launch use fulfillment.created with empty metadata and
-- are intentionally untouched here.
do $$
declare
  fulfillment_record public.order_fulfillments%rowtype;
begin
  for fulfillment_record in
    select fulfillment.*
    from public.order_fulfillments fulfillment
    where fulfillment.status <> 'completed'
      and exists (
        select 1
        from public.order_fulfillment_events event
        where event.order_id = fulfillment.order_id
          and event.metadata ->> 'source' = 'migration_backfill'
      )
    for update
  loop
    update public.order_fulfillments
    set status = 'completed',
        version = version + 1,
        status_changed_at = now(),
        preparing_at = coalesce(preparing_at, status_changed_at, created_at),
        ready_at = coalesce(ready_at, status_changed_at, created_at),
        completed_at = coalesce(completed_at, now())
    where order_id = fulfillment_record.order_id;

    insert into public.order_fulfillment_events (
      restaurant_id, order_id, actor_type, action, previous_status,
      next_status, metadata
    ) values (
      fulfillment_record.restaurant_id,
      fulfillment_record.order_id,
      'system',
      'fulfillment.completed',
      fulfillment_record.status,
      'completed',
      jsonb_build_object(
        'source', 'order_management_refinement',
        'preservedOriginalBackfill', true
      )
    );
  end loop;
end;
$$;

drop function if exists public.list_managed_orders_v1(
  text, text, date, date, timestamptz, uuid, integer
);
drop function if exists public.list_managed_orders_v1(
  text, text, date, date, timestamptz, uuid, integer, text
);

create function public.list_managed_orders_v1(
  p_restaurant_slug text,
  p_view text default 'active',
  p_from_date date default null,
  p_to_date date default null,
  p_cursor_at timestamptz default null,
  p_cursor_order_id uuid default null,
  p_limit integer default 50,
  p_date_basis text default 'placed'
)
returns table (
  order_id uuid,
  order_number text,
  placed_at timestamptz,
  history_date timestamptz,
  pickup_mode text,
  pickup_at timestamptz,
  pickup_timezone text,
  customer_name text,
  item_summary jsonb,
  item_count integer,
  total_cents integer,
  currency text,
  payment_status text,
  refunded_cents integer,
  fulfillment_status text,
  fulfillment_version integer,
  status_changed_at timestamptz,
  completed_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  access_record record;
  restaurant_record public.restaurants%rowtype;
begin
  if p_view not in ('active', 'history')
    or p_date_basis not in ('placed', 'pickup')
    or p_limit not between 1 and 100
    or (p_cursor_at is null) <> (p_cursor_order_id is null)
    or (p_from_date is not null and p_to_date is not null and p_from_date > p_to_date)
  then
    raise exception using message = 'MM_MANAGEMENT_INVALID_REQUEST|Order query is invalid.';
  end if;

  select * into access_record
  from private.require_restaurant_capability_v1(p_restaurant_slug, 'view_orders');
  select * into restaurant_record
  from public.restaurants restaurant where restaurant.id = access_record.restaurant_id;

  return query
  select order_record.id,
         order_record.order_number::text,
         coalesce(order_record.placed_at, order_record.created_at),
         case p_date_basis
           when 'pickup' then order_record.pickup_at
           else coalesce(order_record.placed_at, order_record.created_at)
         end,
         order_record.pickup_mode,
         order_record.pickup_at,
         order_record.pickup_timezone,
         case when access_record.can_view_contact then order_record.customer_name else null end,
         coalesce((
           select jsonb_agg(jsonb_build_object(
             'quantity', item.quantity,
             'itemName', item.item_name
           ) order by item.sort_order, item.id)
           from public.order_items item
           where item.order_id = order_record.id
         ), '[]'::jsonb),
         coalesce((
           select sum(item.quantity)::integer
           from public.order_items item
           where item.order_id = order_record.id
         ), 0),
         order_record.total_cents,
         order_record.currency,
         order_record.payment_status,
         coalesce(payment.refunded_cents, 0),
         fulfillment.status,
         fulfillment.version,
         fulfillment.status_changed_at,
         fulfillment.completed_at
  from public.order_fulfillments fulfillment
  join public.orders order_record
    on order_record.restaurant_id = fulfillment.restaurant_id
   and order_record.id = fulfillment.order_id
  left join public.payments payment on payment.order_id = order_record.id
  where fulfillment.restaurant_id = access_record.restaurant_id
    and order_record.order_status in ('placed', 'confirmed', 'preparing', 'ready', 'completed')
    and (
      (p_view = 'active'
        and fulfillment.status <> 'completed'
        and (
          p_cursor_at is null
          or (order_record.pickup_at, order_record.id) > (p_cursor_at, p_cursor_order_id)
        ))
      or
      (p_view = 'history'
        and fulfillment.status = 'completed'
        and (p_from_date is null or (case p_date_basis
          when 'pickup' then order_record.pickup_at
          else coalesce(order_record.placed_at, order_record.created_at)
        end) >= (
          p_from_date::timestamp at time zone restaurant_record.timezone
        ))
        and (p_to_date is null or (case p_date_basis
          when 'pickup' then order_record.pickup_at
          else coalesce(order_record.placed_at, order_record.created_at)
        end) < (
          (p_to_date + 1)::timestamp at time zone restaurant_record.timezone
        ))
        and (
          p_cursor_at is null
          or ((case p_date_basis
            when 'pickup' then order_record.pickup_at
            else coalesce(order_record.placed_at, order_record.created_at)
          end), order_record.id) < (p_cursor_at, p_cursor_order_id)
        ))
    )
  order by
    case when p_view = 'active' then order_record.pickup_at end asc,
    case when p_view = 'active' then order_record.id end asc,
    case when p_view = 'history' and p_date_basis = 'placed'
      then coalesce(order_record.placed_at, order_record.created_at) end desc,
    case when p_view = 'history' and p_date_basis = 'pickup' then order_record.pickup_at end desc,
    case when p_view = 'history' then order_record.id end desc
  limit p_limit + 1;
end;
$$;

revoke all on function public.list_managed_orders_v1(
  text, text, date, date, timestamptz, uuid, integer, text
) from public, anon, authenticated, service_role;
grant execute on function public.list_managed_orders_v1(
  text, text, date, date, timestamptz, uuid, integer, text
) to authenticated;

commit;
