-- Customer post-order presentation data, richer operational-email claims,
-- and authoritative custom-tip confirmation/cap enforcement. Notification
-- delivery remains outbox-driven and payment/fulfillment authority is unchanged.

begin;

create or replace function public.create_order_v1(
  p_restaurant_slug text,
  p_idempotency_key text,
  p_request jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  base_response jsonb;
  base_request jsonb;
  order_uuid uuid;
  custom_tip_value bigint;
  authoritative_subtotal bigint;
  maximum_custom_tip bigint;
  final_total bigint;
  large_tip_confirmed boolean := false;
  confirmed_subtotal bigint;
begin
  -- The UX-only confirmation marker must not affect preset-tip behavior or the
  -- established base checkout fingerprint.
  if p_request ->> 'tipChoice' <> 'custom' then
    return public.create_order_base_v1(
      p_restaurant_slug,
      p_idempotency_key,
      p_request - 'largeTipConfirmed' - 'largeTipConfirmedSubtotalCents'
    );
  end if;

  if jsonb_typeof(p_request -> 'customTipCents') <> 'number'
    or p_request ->> 'customTipCents' !~ '^\d+$'
  then
    raise exception using message = 'MM_INVALID_REQUEST|Enter a valid custom tip.';
  end if;
  if p_request ? 'largeTipConfirmed'
    and jsonb_typeof(p_request -> 'largeTipConfirmed') <> 'boolean'
  then
    raise exception using message = 'MM_INVALID_REQUEST|Large-tip confirmation is invalid.';
  end if;
  if p_request ? 'largeTipConfirmedSubtotalCents'
    and p_request -> 'largeTipConfirmedSubtotalCents' <> 'null'::jsonb
    and (
      jsonb_typeof(p_request -> 'largeTipConfirmedSubtotalCents') <> 'number'
      or p_request ->> 'largeTipConfirmedSubtotalCents' !~ '^\d+$'
    )
  then
    raise exception using message = 'MM_INVALID_REQUEST|Confirmed subtotal is invalid.';
  end if;

  begin
    custom_tip_value := (p_request ->> 'customTipCents')::bigint;
    large_tip_confirmed := coalesce((p_request ->> 'largeTipConfirmed')::boolean, false);
    confirmed_subtotal := (p_request ->> 'largeTipConfirmedSubtotalCents')::bigint;
  exception when numeric_value_out_of_range then
    raise exception using message = 'MM_INVALID_REQUEST|The custom tip is too large.';
  end;

  base_request := jsonb_set(
    p_request - 'largeTipConfirmed' - 'largeTipConfirmedSubtotalCents',
    '{tipChoice}',
    '"none"'::jsonb
  ) || jsonb_build_object('_menuManCustomTip', true);
  base_response := public.create_order_base_v1(
    p_restaurant_slug, p_idempotency_key, base_request
  );
  order_uuid := (base_response ->> 'orderId')::uuid;
  authoritative_subtotal := (base_response ->> 'subtotalCents')::bigint;
  maximum_custom_tip := authoritative_subtotal + 50000::bigint;

  if custom_tip_value > maximum_custom_tip then
    raise exception using message =
      'MM_INVALID_REQUEST|Custom tip cannot exceed the pre-tax subtotal plus $500.';
  end if;
  if custom_tip_value > authoritative_subtotal
    and (
      not large_tip_confirmed
      or confirmed_subtotal is distinct from authoritative_subtotal
    )
  then
    -- Raising rolls back base checkout inserts, snapshots, and counter changes.
    raise exception using message =
      'MM_LARGE_TIP_CONFIRMATION_REQUIRED|' || authoritative_subtotal::text;
  end if;

  final_total := authoritative_subtotal
    + (base_response ->> 'taxCents')::bigint + custom_tip_value;
  if final_total > 2147483647 then
    raise exception using message =
      'MM_TOTAL_TOO_LARGE|The order total exceeds the supported limit.';
  end if;

  update public.orders
  set tip_basis_points = null,
      tip_cents = custom_tip_value::integer,
      total_cents = final_total::integer
  where id = order_uuid;

  return public.menu_man_order_response_v1(
    order_uuid, (base_response ->> 'replayed')::boolean
  );
end;
$$;

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
    'customerEmail', (
      select customer_email from public.orders where id = p_order_id
    ),
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

drop function public.claim_notification_outbox_v1(integer);

create function public.claim_notification_outbox_v1(
  p_limit integer default 5
)
returns table (
  outbox_id uuid,
  claim_token uuid,
  attempt_number integer,
  notification_type text,
  recipient text,
  idempotency_key text,
  restaurant_name text,
  order_number text,
  pickup_mode text,
  pickup_at timestamptz,
  pickup_timezone text,
  restaurant_address_line1 text,
  restaurant_city text,
  restaurant_state text,
  restaurant_postal_code text,
  google_maps_url text,
  customer_email text
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_limit not between 1 and 20 then
    raise exception 'Notification claim limit is invalid.';
  end if;
  update public.notification_outbox outbox
  set status = 'permanent_failure', lease_token = null, next_attempt_at = null,
      last_error = coalesce(outbox.last_error, 'Delivery lease expired after the final attempt.')
  where outbox.status = 'delivering' and outbox.attempt_count >= 8
    and outbox.next_attempt_at <= now();
  return query
  with candidates as (
    select outbox.id
    from public.notification_outbox outbox
    where outbox.attempt_count < 8
      and outbox.available_at <= now()
      and (
        outbox.status in ('pending', 'retry')
        or (outbox.status = 'delivering' and outbox.next_attempt_at <= now())
      )
      and coalesce(outbox.next_attempt_at, outbox.available_at) <= now()
    order by coalesce(outbox.next_attempt_at, outbox.available_at),
             outbox.created_at, outbox.id
    for update skip locked
    limit p_limit
  ), claimed as (
    update public.notification_outbox outbox
    set status = 'delivering',
        attempt_count = outbox.attempt_count + 1,
        lease_token = gen_random_uuid(),
        last_attempt_at = now(),
        next_attempt_at = now() + interval '5 minutes'
    from candidates
    where outbox.id = candidates.id
    returning outbox.*
  )
  select claimed.id, claimed.lease_token, claimed.attempt_count,
         claimed.notification_type, claimed.recipient, claimed.idempotency_key,
         restaurant.name, order_record.order_number::text,
         order_record.pickup_mode, order_record.pickup_at, order_record.pickup_timezone,
         restaurant.address_line1, restaurant.city, restaurant.state,
         restaurant.postal_code, restaurant.google_maps_url,
         order_record.customer_email
  from claimed
  join public.restaurants restaurant on restaurant.id = claimed.restaurant_id
  join public.orders order_record on order_record.id = claimed.order_id
    and order_record.restaurant_id = claimed.restaurant_id;
end;
$$;

revoke all on function public.create_order_v1(text, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.create_order_v1(text, text, jsonb)
  to service_role;
revoke all on function public.get_order_payment_view_v1(uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.get_order_payment_view_v1(uuid, text, text)
  to service_role;
revoke all on function public.claim_notification_outbox_v1(integer)
  from public, anon, authenticated;
grant execute on function public.claim_notification_outbox_v1(integer)
  to service_role;

commit;
