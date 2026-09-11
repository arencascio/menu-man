-- Repair the terminal payment-failure trigger for already-migrated environments.
-- payment_state_transitions.source deliberately has a closed vocabulary; the
-- original trigger used the unsupported value `system`, which rolled back the
-- entire command/webhook transaction whenever an attempt became failed.

create or replace function public.menu_man_terminal_payment_failure_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  payment_record public.payments%rowtype;
  order_record public.orders%rowtype;
  failure_reason text;
begin
  if new.status <> 'failed' or old.status = 'failed' then
    return new;
  end if;

  select * into payment_record
  from public.payments
  where id = new.payment_id
  for update;

  select * into order_record
  from public.orders
  where id = payment_record.order_id
  for update;

  if payment_record.status in ('succeeded', 'partially_refunded', 'refunded')
    or order_record.order_status <> 'pending_payment'
  then
    return new;
  end if;

  failure_reason := case
    when new.failure_category = 'provider_decline' then 'payment_declined'
    else 'payment_failed'
  end;

  update public.orders
  set order_status = 'cancelled',
      payment_status = 'failed',
      cancelled_at = coalesce(cancelled_at, now()),
      cancellation_reason = failure_reason
  where id = order_record.id
    and order_status = 'pending_payment';

  if found then
    insert into public.payment_state_transitions (
      restaurant_id, payment_id, payment_attempt_id, source, event_type,
      previous_state, next_state
    ) values (
      payment_record.restaurant_id, payment_record.id, new.id, 'reconciliation',
      'payment.terminal_failure',
      jsonb_build_object(
        'payment', payment_record.status,
        'attempt', old.status,
        'order', order_record.order_status,
        'orderPayment', order_record.payment_status
      ),
      jsonb_build_object(
        'payment', 'failed',
        'attempt', 'failed',
        'order', 'cancelled',
        'orderPayment', 'failed',
        'cancellationReason', failure_reason
      )
    );
  end if;

  return new;
end;
$$;

revoke all on function public.menu_man_terminal_payment_failure_v1()
  from public, anon, authenticated, service_role;
