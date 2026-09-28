-- A checkout can remain on the payment screen after pickup hours change.
-- Reserve the provider attempt only while the order's pickup selection is
-- still valid; a rejection rolls the reservation back before provider work.
begin;

alter function public.reserve_payment_attempt_v1(uuid, text, uuid)
  rename to reserve_payment_attempt_unchecked_v1;

revoke all on function public.reserve_payment_attempt_unchecked_v1(uuid, text, uuid)
  from public, anon, authenticated, service_role;

create function public.reserve_payment_attempt_v1(
  p_order_id uuid,
  p_access_token_hash text,
  p_client_attempt_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  reservation jsonb;
  order_record record;
  availability jsonb;
  checked_at timestamptz;
begin
  -- The original function authenticates the checkout session and serializes
  -- payment/abandonment using the payment and order row locks.
  reservation := public.reserve_payment_attempt_unchecked_v1(
    p_order_id, p_access_token_hash, p_client_attempt_key
  );

  -- Retrying an already-reserved provider attempt must use its original
  -- idempotency key, even if availability subsequently changes.
  if coalesce((reservation ->> 'replayed')::boolean, false) then
    return reservation;
  end if;

  select orders.restaurant_id, orders.pickup_mode, orders.pickup_at,
         restaurants.slug
  into strict order_record
  from public.orders orders
  join public.restaurants restaurants on restaurants.id = orders.restaurant_id
  where orders.id = p_order_id;

  -- This shares the same restaurant-scoped lock as create_order_v1. Hours,
  -- special-hours, settings and restaurant availability writes take its
  -- exclusive form, so the final check remains valid until commit.
  perform pg_catalog.pg_advisory_xact_lock_shared(
    private.pickup_availability_lock_key_v1(order_record.restaurant_id)
  );
  checked_at := pg_catalog.clock_timestamp();
  availability := public.get_pickup_availability_v1(order_record.slug, checked_at);

  if order_record.pickup_mode = 'asap' then
    if not coalesce((availability #>> '{asap,available}')::boolean, false) then
      raise exception using message =
        'MM_PICKUP_UNAVAILABLE|Pickup availability changed. Choose a new pickup time.';
    end if;
  elsif order_record.pickup_mode = 'scheduled' then
    if not exists (
      select 1
      from pg_catalog.jsonb_array_elements(availability #> '{scheduled,slots}') slot
      where (slot ->> 'pickupAt')::timestamptz = order_record.pickup_at
    ) then
      raise exception using message =
        'MM_PICKUP_UNAVAILABLE|Pickup availability changed. Choose a new pickup time.';
    end if;
  else
    raise exception using message =
      'MM_PICKUP_UNAVAILABLE|Pickup availability changed. Choose a new pickup time.';
  end if;

  return reservation;
end;
$$;

revoke all on function public.reserve_payment_attempt_v1(uuid, text, uuid)
  from public, anon, authenticated;
grant execute on function public.reserve_payment_attempt_v1(uuid, text, uuid)
  to service_role;

commit;
