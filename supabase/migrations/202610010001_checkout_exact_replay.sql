-- Recover a committed checkout before current restaurant settings can reinterpret
-- its original request. Keep the existing new-order path intact.
begin;

alter function public.create_order_v1(text, text, jsonb)
  rename to create_order_before_exact_replay_v1;
revoke all on function public.create_order_before_exact_replay_v1(text, text, jsonb)
  from public, anon, authenticated, service_role;

create function public.create_order_v1(
  p_restaurant_slug text,
  p_idempotency_key text,
  p_request jsonb
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  restaurant_uuid uuid;
  existing_order record;
  replay_request jsonb;
  replay_fingerprint text;
begin
  -- The core uses the same transaction lock before creating a new order.
  if p_idempotency_key is not null
    and p_idempotency_key ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  then
    select id into restaurant_uuid from public.restaurants
    where slug = p_restaurant_slug;
    if restaurant_uuid is not null then
      perform pg_catalog.pg_advisory_xact_lock(
        pg_catalog.hashtextextended(restaurant_uuid::text || ':' || pg_catalog.lower(p_idempotency_key), 0)
      );
      select o.id, o.request_fingerprint into existing_order
      from public.orders o
      where o.restaurant_id = restaurant_uuid
        and o.idempotency_key = pg_catalog.lower(p_idempotency_key);
      if found then
        -- Reproduce the original core fingerprint without today's required-field
        -- flags, custom-tip cap, hours, menu, or pickup availability.
        replay_request := p_request - 'largeTipConfirmed' - 'largeTipConfirmedSubtotalCents';
        if replay_request ->> 'tipChoice' = 'custom' then
          replay_request := pg_catalog.jsonb_set(replay_request, '{tipChoice}', '"none"'::jsonb)
            || pg_catalog.jsonb_build_object('_menuManCustomTip', true);
        end if;
        replay_request := pg_catalog.jsonb_set(replay_request, '{customer,name}',
          coalesce(to_jsonb(private.normalize_checkout_customer_name_v1(
            replay_request #>> '{customer,name}', false)), 'null'::jsonb), true);
        replay_request := pg_catalog.jsonb_set(replay_request, '{customer,email}',
          coalesce(to_jsonb(private.normalize_checkout_customer_email_v1(
            replay_request #>> '{customer,email}', false)), 'null'::jsonb), true);
        replay_request := pg_catalog.jsonb_set(replay_request, '{customer,phone}',
          coalesce(to_jsonb(private.normalize_checkout_customer_phone_v1(
            replay_request #>> '{customer,phone}', false)), 'null'::jsonb), true);
        replay_request := pg_catalog.jsonb_set(replay_request, '{orderNotes}',
          coalesce(to_jsonb(private.normalize_checkout_notes_v1(
            replay_request ->> 'orderNotes')), 'null'::jsonb), true);
        replay_fingerprint := pg_catalog.encode(
          pg_catalog.sha256(pg_catalog.convert_to(replay_request::text, 'UTF8')), 'hex');
        if replay_fingerprint is distinct from existing_order.request_fingerprint then
          raise exception using message =
            'MM_IDEMPOTENCY_CONFLICT|This idempotency key was already used for a different request.';
        end if;
        return public.menu_man_order_response_v1(existing_order.id, true);
      end if;
    end if;
  end if;

  return public.create_order_before_exact_replay_v1(
    p_restaurant_slug, p_idempotency_key, p_request);
end;
$$;

revoke all on function public.create_order_v1(text, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.create_order_v1(text, text, jsonb)
  to service_role;

-- A status change between order replay and payment preparation must not mint a
-- new checkout capability for a terminal order with an existing payment.
alter function public.prepare_payment_v1(uuid, text, boolean, integer, integer)
  rename to prepare_payment_before_exact_replay_guard_v1;
revoke all on function public.prepare_payment_before_exact_replay_guard_v1(uuid, text, boolean, integer, integer)
  from public, anon, authenticated, service_role;

create function public.prepare_payment_v1(
  p_order_id uuid,
  p_access_token_hash text,
  p_allow_fake boolean default false,
  p_payment_ttl_minutes integer default 30,
  p_session_ttl_minutes integer default 120
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  order_record record;
begin
  select order_status, payment_status into order_record
  from public.orders where id = p_order_id for update;
  if found and (order_record.order_status <> 'pending_payment'
      or order_record.payment_status not in ('unpaid', 'pending', 'failed')) then
    raise exception using message = 'MM_PAYMENT_NOT_ALLOWED|This order cannot start payment.';
  end if;
  return public.prepare_payment_before_exact_replay_guard_v1(
    p_order_id, p_access_token_hash, p_allow_fake,
    p_payment_ttl_minutes, p_session_ttl_minutes);
end;
$$;

revoke all on function public.prepare_payment_v1(uuid, text, boolean, integer, integer)
  from public, anon, authenticated;
grant execute on function public.prepare_payment_v1(uuid, text, boolean, integer, integer)
  to service_role;

commit;
