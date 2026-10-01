begin;

-- Keep the existing cancellation and pickup guards in the event path. Correct
-- only the summary of a processed success after a completed refund.
alter function public.apply_payment_event_v1(uuid)
  rename to apply_payment_event_before_refund_monotonicity_v1;
revoke all on function public.apply_payment_event_before_refund_monotonicity_v1(uuid)
  from public, anon, authenticated, service_role;

create function public.apply_payment_event_v1(p_webhook_event_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  apply_result jsonb;
  event_kind text;
  payment_uuid uuid;
  order_uuid uuid;
  captured_amount integer;
  refunded_amount integer;
  refund_status text;
begin
  apply_result := public.apply_payment_event_before_refund_monotonicity_v1(p_webhook_event_id);

  if coalesce((apply_result ->> 'processed')::boolean, false) is not true then
    return apply_result;
  end if;

  select event.normalized_event ->> 'kind' into event_kind
  from public.payment_webhook_events event where event.id = p_webhook_event_id;
  if event_kind is distinct from 'payment.succeeded' then
    return apply_result;
  end if;

  select payment.id, payment.order_id, payment.captured_cents, payment.refunded_cents
  into payment_uuid, order_uuid, captured_amount, refunded_amount
  from public.payment_webhook_events event
  join public.payment_attempts attempt
    on attempt.id = (event.normalized_event ->> 'attemptId')::uuid
  join public.payments payment on payment.id = attempt.payment_id
  where event.id = p_webhook_event_id;

  if not found or refunded_amount = 0 then
    return apply_result;
  end if;

  refund_status := case
    when refunded_amount >= captured_amount then 'refunded'
    else 'partially_refunded'
  end;

  -- The delegated success already increments payment.version. These corrections
  -- belong to that same event/transaction, so do not increment it a second time.
  update public.payments
  set status = refund_status
  where id = payment_uuid and status is distinct from refund_status;

  update public.orders
  set payment_status = refund_status
  where id = order_uuid and payment_status is distinct from refund_status;

  -- The delegated function records the transition before returning. Keep its
  -- recorded next state consistent with the authoritative final state.
  update public.payment_state_transitions
  set next_state = pg_catalog.jsonb_set(
    pg_catalog.jsonb_set(next_state, '{payment}', pg_catalog.to_jsonb(refund_status), true),
    '{orderPayment}', pg_catalog.to_jsonb(refund_status), true
  )
  where webhook_event_id = p_webhook_event_id
    and event_type = 'payment.succeeded';

  return apply_result;
end;
$$;

revoke all on function public.apply_payment_event_v1(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.apply_payment_event_v1(uuid) to service_role;

commit;
