-- Configurable customer-field requirements and custom-tip allowance, with
-- canonical customer input normalization ahead of the existing checkout core.

begin;

alter table public.restaurant_ordering_settings
  add column customer_name_required boolean not null default true,
  add column customer_email_required boolean not null default true,
  add column customer_phone_required boolean not null default true,
  add column custom_tip_additive_cap_cents integer not null default 50000,
  add constraint restaurant_ordering_settings_custom_tip_additive_cap_check
    check (custom_tip_additive_cap_cents between 0 and 2147483647);

alter table public.orders alter column customer_name drop not null;

create or replace function private.normalize_checkout_customer_name_v1(
  p_value text,
  p_required boolean
)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare normalized text := pg_catalog.regexp_replace(pg_catalog.btrim(coalesce(p_value, '')), '[[:space:]]+', ' ', 'g');
begin
  if normalized = '' then
    if p_required then
      raise exception using message = 'MM_INVALID_REQUEST|Enter your name.';
    end if;
    return null;
  end if;
  if char_length(normalized) > 100 or normalized !~ '[[:alpha:]]' then
    raise exception using message = 'MM_INVALID_REQUEST|Enter a valid name using at least one letter and no more than 100 characters.';
  end if;
  -- Preserve legitimate single-character non-Latin names such as 李.
  if p_required and char_length(normalized) < 2 and normalized ~ '^[A-Za-z]$' then
    raise exception using message = 'MM_INVALID_REQUEST|Enter a name with at least two characters.';
  end if;
  return normalized;
end;
$$;

create or replace function private.normalize_checkout_customer_email_v1(
  p_value text,
  p_required boolean
)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare normalized text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_value, '')));
begin
  if normalized = '' then
    if p_required then
      raise exception using message = 'MM_INVALID_REQUEST|Enter your email address.';
    end if;
    return null;
  end if;
  if char_length(normalized) > 254
    or normalized !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  then
    raise exception using message = 'MM_INVALID_REQUEST|Enter a valid email address.';
  end if;
  return normalized;
end;
$$;

create or replace function private.normalize_checkout_customer_phone_v1(
  p_value text,
  p_required boolean
)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  normalized text := pg_catalog.btrim(coalesce(p_value, ''));
  digits text;
begin
  if normalized = '' then
    if p_required then
      raise exception using message = 'MM_INVALID_REQUEST|Enter your US phone number.';
    end if;
    return null;
  end if;
  if normalized !~ '^[0-9+().[:space:]-]+$' then
    raise exception using message = 'MM_INVALID_REQUEST|Enter a valid 10-digit US phone number.';
  end if;
  digits := pg_catalog.regexp_replace(normalized, '[^0-9]', '', 'g');
  if char_length(digits) = 11 and left(digits, 1) = '1' then
    digits := substring(digits from 2);
  end if;
  if digits !~ '^[2-9][0-9]{2}[2-9][0-9]{6}$' then
    raise exception using message = 'MM_INVALID_REQUEST|Enter a valid 10-digit US phone number.';
  end if;
  return '+1' || digits;
end;
$$;

create or replace function private.normalize_checkout_notes_v1(p_value text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare normalized text := pg_catalog.btrim(
  pg_catalog.replace(pg_catalog.replace(coalesce(p_value, ''), chr(13) || chr(10), chr(10)), chr(13), chr(10))
);
begin
  if normalized = '' then return null; end if;
  if char_length(normalized) > 500
    or pg_catalog.replace(pg_catalog.replace(normalized, chr(10), ''), chr(9), '') ~ '[[:cntrl:]]'
  then
    raise exception using message = 'MM_INVALID_REQUEST|Order notes must be 500 characters or fewer and contain only normal text.';
  end if;
  return normalized;
end;
$$;

alter function public.create_order_base_v1(text, text, jsonb)
  rename to create_order_core_v1;

revoke all on function public.create_order_core_v1(text, text, jsonb)
  from public, anon, authenticated, service_role;

create function public.create_order_base_v1(
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
  settings_record record;
  normalized_request jsonb;
  normalized_name text;
  normalized_email text;
  normalized_phone text;
  normalized_notes text;
begin
  select settings.customer_name_required,
         settings.customer_email_required,
         settings.customer_phone_required
  into settings_record
  from public.restaurants restaurant
  join public.restaurant_ordering_settings settings
    on settings.restaurant_id = restaurant.id
  where restaurant.slug = p_restaurant_slug
    and restaurant.is_active = true;

  if not found then
    return public.create_order_core_v1(p_restaurant_slug, p_idempotency_key, p_request);
  end if;

  normalized_name := private.normalize_checkout_customer_name_v1(
    p_request #>> '{customer,name}', settings_record.customer_name_required
  );
  normalized_email := private.normalize_checkout_customer_email_v1(
    p_request #>> '{customer,email}', settings_record.customer_email_required
  );
  normalized_phone := private.normalize_checkout_customer_phone_v1(
    p_request #>> '{customer,phone}', settings_record.customer_phone_required
  );
  normalized_notes := private.normalize_checkout_notes_v1(p_request ->> 'orderNotes');

  normalized_request := jsonb_set(
    jsonb_set(
      jsonb_set(
        jsonb_set(
          p_request,
          '{customer,name}',
          coalesce(to_jsonb(normalized_name), 'null'::jsonb),
          true
        ),
        '{customer,email}',
        coalesce(to_jsonb(normalized_email), 'null'::jsonb),
        true
      ),
      '{customer,phone}',
      coalesce(to_jsonb(normalized_phone), 'null'::jsonb),
      true
    ),
    '{orderNotes}',
    coalesce(to_jsonb(normalized_notes), 'null'::jsonb),
    true
  );

  return public.create_order_core_v1(
    p_restaurant_slug, p_idempotency_key, normalized_request
  );
end;
$$;

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
  additive_tip_cap bigint;
  maximum_custom_tip bigint;
  final_total bigint;
  large_tip_confirmed boolean := false;
  confirmed_subtotal bigint;
begin
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

  select settings.custom_tip_additive_cap_cents::bigint
  into additive_tip_cap
  from public.restaurants restaurant
  join public.restaurant_ordering_settings settings
    on settings.restaurant_id = restaurant.id
  where restaurant.slug = p_restaurant_slug
    and restaurant.is_active = true;

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
  maximum_custom_tip := authoritative_subtotal + additive_tip_cap;

  if custom_tip_value > maximum_custom_tip then
    raise exception using message =
      'MM_INVALID_REQUEST|Custom tip exceeds this restaurant''s allowed maximum.';
  end if;
  if custom_tip_value > authoritative_subtotal
    and (
      not large_tip_confirmed
      or confirmed_subtotal is distinct from authoritative_subtotal
    )
  then
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

revoke all on function public.create_order_base_v1(text, text, jsonb)
  from public, anon, authenticated, service_role;
revoke all on function public.create_order_v1(text, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.create_order_v1(text, text, jsonb)
  to service_role;

commit;
