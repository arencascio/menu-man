-- Route-based guest checkout support.
-- Conclusive payment failures terminally cancel the frozen order, while the
-- checkout capability remains usable for read-only failure/receipt views.

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

drop trigger if exists payment_attempt_terminal_failure on public.payment_attempts;
create trigger payment_attempt_terminal_failure
after update of status on public.payment_attempts
for each row
when (new.status = 'failed' and old.status is distinct from new.status)
execute function public.menu_man_terminal_payment_failure_v1();

create or replace function public.get_order_payment_view_v1(
  p_order_id uuid,
  p_restaurant_slug text,
  p_access_token_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  payment_uuid uuid;
  order_response jsonb;
begin
  if p_access_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception using message = 'MM_INVALID_PAYMENT_SESSION|Payment session token is invalid.';
  end if;

  update public.payment_checkout_sessions session
  set last_used_at = now()
  from public.payments payment,
       public.orders order_record,
       public.restaurants restaurant
  where session.payment_id = payment.id
    and payment.order_id = order_record.id
    and order_record.restaurant_id = restaurant.id
    and order_record.id = p_order_id
    and restaurant.slug = p_restaurant_slug
    and session.access_token_hash = p_access_token_hash
    and session.revoked_at is null
    and session.expires_at > now()
  returning payment.id into payment_uuid;

  if payment_uuid is null then
    raise exception using message = 'MM_INVALID_PAYMENT_SESSION|Payment session is invalid or expired.';
  end if;

  order_response := public.menu_man_order_response_v1(p_order_id, false);
  order_response := order_response || jsonb_build_object(
    'cancellationReason', (
      select cancellation_reason from public.orders where id = p_order_id
    ),
    'items', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'orderItemId', item.id,
          'menuItemId', item.menu_item_id,
          'itemName', item.item_name,
          'quantity', item.quantity,
          'unitPriceCents', item.unit_price_cents,
          'lineTotalCents', item.line_total_cents,
          'specialInstructions', item.special_instructions,
          'modifiers', coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'groupName', modifier.modifier_group_name,
                'optionName', modifier.modifier_option_name,
                'priceAdjustmentCents', modifier.price_adjustment_cents
              ) order by modifier.sort_order, modifier.id
            )
            from public.order_item_modifiers modifier
            where modifier.order_item_id = item.id
          ), '[]'::jsonb)
        ) order by item.sort_order, item.id
      )
      from public.order_items item
      where item.order_id = p_order_id
    ), '[]'::jsonb)
  );

  return jsonb_build_object(
    'order', order_response,
    'payment', public.menu_man_payment_response_v1(payment_uuid)
  );
end;
$$;

revoke all on function public.menu_man_terminal_payment_failure_v1() from public, anon, authenticated, service_role;
revoke all on function public.get_order_payment_view_v1(uuid, text, text) from public, anon, authenticated;
grant execute on function public.get_order_payment_view_v1(uuid, text, text) to service_role;
