-- Order Management polish: extend the existing permission-gated export read
-- model with date-basis cursors and item counts. Financial and fulfillment
-- authority remain unchanged.

begin;

drop function if exists public.list_managed_order_export_rows_v1(
  text, date, date, timestamptz, uuid, integer
);

create function public.list_managed_order_export_rows_v1(
  p_restaurant_slug text,
  p_from_date date,
  p_to_date date,
  p_date_basis text default 'placed',
  p_cursor_at timestamptz default null,
  p_cursor_order_id uuid default null,
  p_limit integer default 500
)
returns table (
  order_id uuid,
  order_number text,
  history_at timestamptz,
  placed_at timestamptz,
  pickup_at timestamptz,
  customer_name text,
  fulfillment_status text,
  payment_status text,
  refund_status text,
  item_count integer,
  subtotal_cents integer,
  tax_cents integer,
  tip_cents integer,
  total_cents integer,
  refund_amount_cents integer,
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
  if p_from_date is null
    or p_to_date is null
    or p_from_date > p_to_date
    or p_date_basis not in ('placed', 'pickup')
    or p_limit not between 1 and 1000
    or (p_cursor_at is null) <> (p_cursor_order_id is null)
  then
    raise exception using message = 'MM_MANAGEMENT_INVALID_REQUEST|Export query is invalid.';
  end if;

  select * into access_record
  from private.require_restaurant_capability_v1(
    p_restaurant_slug, 'export_order_history'
  );
  select * into restaurant_record
  from public.restaurants restaurant
  where restaurant.id = access_record.restaurant_id;

  return query
  select order_record.id,
         order_record.order_number::text,
         case p_date_basis
           when 'pickup' then order_record.pickup_at
           else coalesce(order_record.placed_at, order_record.created_at)
         end,
         coalesce(order_record.placed_at, order_record.created_at),
         order_record.pickup_at,
         case when access_record.can_view_contact
           then order_record.customer_name else null end,
         fulfillment.status,
         order_record.payment_status,
         case
           when exists (
             select 1 from public.refunds pending_refund
             where pending_refund.payment_id = payment.id
               and pending_refund.status in ('requested', 'processing')
           ) then 'processing'
           when coalesce(payment.refunded_cents, 0) > 0
             and payment.refunded_cents >= payment.captured_cents then 'refunded'
           when coalesce(payment.refunded_cents, 0) > 0 then 'partially_refunded'
           when exists (
             select 1 from public.refunds failed_refund
             where failed_refund.payment_id = payment.id
               and failed_refund.status = 'failed'
           ) then 'failed'
           else null
         end,
         coalesce((
           select sum(item.quantity)::integer
           from public.order_items item
           where item.order_id = order_record.id
         ), 0),
         order_record.subtotal_cents,
         order_record.tax_cents,
         order_record.tip_cents,
         order_record.total_cents,
         coalesce(payment.refunded_cents, 0),
         fulfillment.completed_at
  from public.order_fulfillments fulfillment
  join public.orders order_record
    on order_record.restaurant_id = fulfillment.restaurant_id
   and order_record.id = fulfillment.order_id
  left join public.payments payment on payment.order_id = order_record.id
  where fulfillment.restaurant_id = access_record.restaurant_id
    and fulfillment.status = 'completed'
    and (case p_date_basis
      when 'pickup' then order_record.pickup_at
      else coalesce(order_record.placed_at, order_record.created_at)
    end) >= (p_from_date::timestamp at time zone restaurant_record.timezone)
    and (case p_date_basis
      when 'pickup' then order_record.pickup_at
      else coalesce(order_record.placed_at, order_record.created_at)
    end) < ((p_to_date + 1)::timestamp at time zone restaurant_record.timezone)
    and (
      p_cursor_at is null
      or ((case p_date_basis
        when 'pickup' then order_record.pickup_at
        else coalesce(order_record.placed_at, order_record.created_at)
      end), order_record.id) < (p_cursor_at, p_cursor_order_id)
    )
  order by
    case p_date_basis
      when 'pickup' then order_record.pickup_at
      else coalesce(order_record.placed_at, order_record.created_at)
    end desc,
    order_record.id desc
  limit p_limit + 1;
end;
$$;

revoke all on function public.list_managed_order_export_rows_v1(
  text, date, date, text, timestamptz, uuid, integer
) from public, anon, authenticated, service_role;
grant execute on function public.list_managed_order_export_rows_v1(
  text, date, date, text, timestamptz, uuid, integer
) to authenticated;

commit;
