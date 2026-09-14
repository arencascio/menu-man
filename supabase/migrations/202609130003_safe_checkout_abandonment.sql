-- Allow a guest to abandon only a pristine, unpaid checkout. The payment row
-- lock is the same serialization point used by reserve_payment_attempt_v1, so
-- payment submission and abandonment cannot both win.

begin;

create or replace function public.abandon_checkout_v1(
  p_order_id uuid,
  p_access_token_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  checkout_record record;
  payment_record public.payments%rowtype;
  order_record public.orders%rowtype;
begin
  if p_access_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception using message = 'MM_INVALID_PAYMENT_SESSION|Payment session token is invalid.';
  end if;

  select
    session.id as session_id,
    payment.id as payment_id
  into checkout_record
  from public.payment_checkout_sessions session
  join public.payments payment on payment.id = session.payment_id
  where payment.order_id = p_order_id
    and session.access_token_hash = p_access_token_hash
    and session.revoked_at is null
    and session.expires_at > now()
  for update of payment;

  if not found then
    raise exception using message = 'MM_INVALID_PAYMENT_SESSION|Payment session is invalid or expired.';
  end if;

  select * into payment_record
  from public.payments
  where id = checkout_record.payment_id;

  select * into order_record
  from public.orders
  where id = p_order_id
  for update;

  if payment_record.status <> 'requires_payment_method'
    or order_record.order_status <> 'pending_payment'
    or order_record.payment_status <> 'unpaid'
  then
    if payment_record.status in ('processing', 'unknown', 'authorized')
      or exists (
        select 1
        from public.payment_attempts attempt
        where attempt.payment_id = payment_record.id
      )
    then
      raise exception using message = 'MM_PAYMENT_IN_PROGRESS|Payment has already started and this checkout cannot be abandoned.';
    end if;
    raise exception using message = 'MM_PAYMENT_NOT_ALLOWED|This checkout cannot be abandoned.';
  end if;

  -- Any attempt means provider work may have started. Be conservative even if
  -- a stale application view still says requires_payment_method.
  if exists (
    select 1
    from public.payment_attempts attempt
    where attempt.payment_id = payment_record.id
  ) then
    raise exception using message = 'MM_PAYMENT_IN_PROGRESS|Payment has already started and this checkout cannot be abandoned.';
  end if;

  update public.payments
  set status = 'cancelled',
      cancelled_at = coalesce(cancelled_at, now()),
      version = version + 1
  where id = payment_record.id
    and status = 'requires_payment_method';

  if not found then
    raise exception using message = 'MM_PAYMENT_IN_PROGRESS|Payment has already started and this checkout cannot be abandoned.';
  end if;

  update public.orders
  set order_status = 'cancelled',
      payment_status = 'failed',
      cancelled_at = coalesce(cancelled_at, now()),
      cancellation_reason = 'checkout_abandoned'
  where id = order_record.id
    and order_status = 'pending_payment'
    and payment_status = 'unpaid';

  if not found then
    raise exception using message = 'MM_PAYMENT_NOT_ALLOWED|This checkout cannot be abandoned.';
  end if;

  update public.payment_checkout_sessions
  set revoked_at = coalesce(revoked_at, now())
  where payment_id = payment_record.id
    and revoked_at is null;

  insert into public.payment_state_transitions (
    restaurant_id, payment_id, source, event_type, previous_state, next_state
  ) values (
    payment_record.restaurant_id,
    payment_record.id,
    'command',
    'checkout.abandoned',
    jsonb_build_object(
      'payment', payment_record.status,
      'order', order_record.order_status,
      'orderPayment', order_record.payment_status
    ),
    jsonb_build_object(
      'payment', 'cancelled',
      'order', 'cancelled',
      'orderPayment', 'failed',
      'cancellationReason', 'checkout_abandoned'
    )
  );

  return jsonb_build_object(
    'abandoned', true,
    'orderId', order_record.id,
    'paymentId', payment_record.id
  );
end;
$$;

revoke all on function public.abandon_checkout_v1(uuid, text)
from public, anon, authenticated, service_role;
grant execute on function public.abandon_checkout_v1(uuid, text) to service_role;

commit;
