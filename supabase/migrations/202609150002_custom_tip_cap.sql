-- Cap fixed custom tips against the authoritative repriced subtotal. The base
-- checkout remains unchanged; any rejection raises inside the same transaction
-- so no order or snapshots are committed.

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
begin
  if p_request ->> 'tipChoice' <> 'custom' then
    return public.create_order_base_v1(p_restaurant_slug, p_idempotency_key, p_request);
  end if;
  if jsonb_typeof(p_request -> 'customTipCents') <> 'number'
    or p_request ->> 'customTipCents' !~ '^\d+$'
  then
    raise exception using message = 'MM_INVALID_REQUEST|Enter a valid custom tip.';
  end if;
  begin
    custom_tip_value := (p_request ->> 'customTipCents')::bigint;
  exception when numeric_value_out_of_range then
    raise exception using message = 'MM_INVALID_REQUEST|The custom tip is too large.';
  end;

  base_request := jsonb_set(p_request, '{tipChoice}', '"none"'::jsonb)
    || jsonb_build_object('_menuManCustomTip', true);
  base_response := public.create_order_base_v1(
    p_restaurant_slug, p_idempotency_key, base_request
  );
  order_uuid := (base_response ->> 'orderId')::uuid;
  authoritative_subtotal := (base_response ->> 'subtotalCents')::bigint;
  maximum_custom_tip := least(authoritative_subtotal, 50000::bigint);
  if custom_tip_value > maximum_custom_tip then
    raise exception using message = 'MM_INVALID_REQUEST|Custom tip cannot exceed the pre-tax subtotal or $500.';
  end if;
  final_total := authoritative_subtotal
    + (base_response ->> 'taxCents')::bigint + custom_tip_value;
  if final_total > 2147483647 then
    raise exception using message = 'MM_TOTAL_TOO_LARGE|The order total exceeds the supported limit.';
  end if;
  update public.orders
  set tip_basis_points = null, tip_cents = custom_tip_value::integer,
      total_cents = final_total::integer
  where id = order_uuid;
  return public.menu_man_order_response_v1(
    order_uuid, (base_response ->> 'replayed')::boolean
  );
end;
$$;

revoke all on function public.create_order_v1(text, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.create_order_v1(text, text, jsonb)
  to service_role;

commit;
