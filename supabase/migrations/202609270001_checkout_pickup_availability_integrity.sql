-- Serialize pickup configuration writes with checkout, then validate again
-- after order creation but before the transaction can commit. A rejection
-- rolls back the order, snapshots, counter allocation, and custom-tip update.

begin;

create function private.pickup_availability_lock_key_v1(p_restaurant_id uuid)
returns bigint
language sql
immutable
set search_path = ''
as $$
  select pg_catalog.hashtextextended('pickup-availability:' || p_restaurant_id::text, 0);
$$;

create function private.lock_pickup_availability_write_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    perform pg_catalog.pg_advisory_xact_lock(
      private.pickup_availability_lock_key_v1(old.restaurant_id)
    );
    return old;
  end if;

  if tg_op = 'UPDATE' then
    if old.restaurant_id is distinct from new.restaurant_id
      and old.restaurant_id < new.restaurant_id then
      perform pg_catalog.pg_advisory_xact_lock(
        private.pickup_availability_lock_key_v1(old.restaurant_id)
      );
    end if;
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    private.pickup_availability_lock_key_v1(new.restaurant_id)
  );
  if tg_op = 'UPDATE' then
    if old.restaurant_id is distinct from new.restaurant_id
      and old.restaurant_id > new.restaurant_id then
      perform pg_catalog.pg_advisory_xact_lock(
        private.pickup_availability_lock_key_v1(old.restaurant_id)
      );
    end if;
  end if;
  return new;
end;
$$;

create trigger restaurant_business_hours_pickup_write_lock
before insert or update or delete on public.restaurant_business_hours
for each row execute function private.lock_pickup_availability_write_v1();

create trigger restaurant_special_hours_pickup_write_lock
before insert or update or delete on public.restaurant_special_hours
for each row execute function private.lock_pickup_availability_write_v1();

create trigger restaurant_ordering_settings_pickup_write_lock
before insert or update or delete on public.restaurant_ordering_settings
for each row execute function private.lock_pickup_availability_write_v1();

create function private.lock_restaurant_pickup_write_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(
    private.pickup_availability_lock_key_v1(old.id)
  );
  return new;
end;
$$;

create trigger restaurant_pickup_identity_write_lock
before update of is_active, timezone, slug on public.restaurants
for each row execute function private.lock_restaurant_pickup_write_v1();

alter function public.create_order_v1(text, text, jsonb)
  rename to create_order_unlocked_v1;

revoke all on function public.create_order_unlocked_v1(text, text, jsonb)
  from public, anon, authenticated, service_role;

create function public.create_order_v1(
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
  restaurant_uuid uuid;
  order_response jsonb;
  pickup_availability jsonb;
  pickup_mode_value text;
  pickup_at_value timestamptz;
begin
  select restaurant.id into restaurant_uuid
  from public.restaurants restaurant
  where restaurant.slug = p_restaurant_slug and restaurant.is_active = true;

  if restaurant_uuid is not null then
    -- Concurrent checkouts share this lock. An hours/settings write takes the
    -- exclusive form, so the availability used for this order stays current
    -- through transaction commit without serializing customer orders.
    perform pg_catalog.pg_advisory_xact_lock_shared(
      private.pickup_availability_lock_key_v1(restaurant_uuid)
    );
  end if;

  order_response := public.create_order_unlocked_v1(
    p_restaurant_slug, p_idempotency_key, p_request
  );

  -- An idempotent replay returns an already committed order. Its original
  -- pickup validation must not be reinterpreted as a new order attempt.
  if coalesce((order_response ->> 'replayed')::boolean, false) then
    return order_response;
  end if;

  pickup_availability := public.get_pickup_availability_v1(
    p_restaurant_slug, pg_catalog.clock_timestamp()
  );
  pickup_mode_value := order_response #>> '{pickup,mode}';

  if pickup_mode_value = 'asap' then
    if not coalesce((pickup_availability #>> '{asap,available}')::boolean, false) then
      raise exception using message =
        'MM_PICKUP_UNAVAILABLE|Pickup availability changed. Choose a new pickup time.';
    end if;
  elsif pickup_mode_value = 'scheduled' then
    pickup_at_value := (order_response #>> '{pickup,pickupAt}')::timestamptz;
    if not exists (
      select 1
      from pg_catalog.jsonb_array_elements(pickup_availability #> '{scheduled,slots}') slot
      where (slot ->> 'pickupAt')::timestamptz = pickup_at_value
    ) then
      raise exception using message =
        'MM_PICKUP_UNAVAILABLE|Pickup availability changed. Choose a new pickup time.';
    end if;
  else
    raise exception using message = 'MM_PICKUP_UNAVAILABLE|Pickup availability changed.';
  end if;

  return order_response;
end;
$$;

revoke all on function private.pickup_availability_lock_key_v1(uuid)
  from public, anon, authenticated, service_role;
revoke all on function private.lock_pickup_availability_write_v1()
  from public, anon, authenticated, service_role;
revoke all on function private.lock_restaurant_pickup_write_v1()
  from public, anon, authenticated, service_role;
revoke all on function public.create_order_v1(text, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.create_order_v1(text, text, jsonb)
  to service_role;

commit;
