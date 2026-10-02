-- Bound anonymous NEW checkout creation across serverless instances. Existing
-- idempotency keys are resolved by create_order_v1 before this counter is read.
begin;

create table public.checkout_creation_windows (
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  source_hash text not null check (source_hash ~ '^[0-9a-f]{64}$'),
  window_start timestamptz not null,
  creation_count integer not null check (creation_count between 1 and 120),
  primary key (restaurant_id, source_hash, window_start)
);
create index checkout_creation_windows_expiry_idx
  on public.checkout_creation_windows (window_start);
alter table public.checkout_creation_windows enable row level security;
revoke all on public.checkout_creation_windows from public, anon, authenticated, service_role;

create function public.create_order_with_abuse_limit_v1(
  p_restaurant_slug text,
  p_idempotency_key text,
  p_request jsonb,
  p_source_hash text
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  restaurant_uuid uuid;
  existing_order_id uuid;
  current_window timestamptz;
  accepted_count integer;
  retry_seconds integer;
  counter_failed boolean := false;
begin
  -- Use the same lock and key normalization as create_order_v1. After a
  -- concurrent request commits, a waiting exact replay bypasses the counter.
  if p_idempotency_key is not null
    and p_idempotency_key ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  then
    select id into restaurant_uuid from public.restaurants
      where slug = p_restaurant_slug;
    if restaurant_uuid is not null then
      perform pg_catalog.pg_advisory_xact_lock(
        pg_catalog.hashtextextended(restaurant_uuid::text || ':' || pg_catalog.lower(p_idempotency_key), 0)
      );
      select id into existing_order_id from public.orders
        where restaurant_id = restaurant_uuid
          and idempotency_key = pg_catalog.lower(p_idempotency_key);
      if found then
        -- The canonical function checks the fingerprint and either returns the
        -- original order or raises IDEMPOTENCY_CONFLICT, regardless of the limit.
        return public.create_order_v1(p_restaurant_slug, p_idempotency_key, p_request);
      end if;
    end if;
  end if;

  -- Missing source data degrades to ordinary checkout. Local callers and
  -- deployments without a valid edge source are deliberately not blocked.
  if restaurant_uuid is not null and p_source_hash ~ '^[0-9a-f]{64}$' then
    current_window := pg_catalog.date_bin('10 minutes'::interval,
      pg_catalog.clock_timestamp(), '2000-01-01 00:00:00+00'::timestamptz);
    begin
      insert into public.checkout_creation_windows as counter
        (restaurant_id, source_hash, window_start, creation_count)
      values (restaurant_uuid, p_source_hash, current_window, 1)
      on conflict (restaurant_id, source_hash, window_start)
      do update set creation_count = counter.creation_count + 1
        where counter.creation_count < 120
      returning creation_count into accepted_count;
    exception when others then
      -- This noncritical counter must not make restaurant checkout unavailable.
      counter_failed := true;
      raise warning 'checkout creation limiter unavailable: %, %', SQLSTATE, SQLERRM;
    end;
    if not counter_failed and accepted_count is null then
      retry_seconds := pg_catalog.greatest(1, pg_catalog.ceil(pg_catalog.date_part('epoch',
        current_window + interval '10 minutes' - pg_catalog.clock_timestamp()))::integer);
      raise exception using message = 'MM_CHECKOUT_RATE_LIMITED|' || retry_seconds;
    end if;
  end if;

  -- Counter and order creation share this transaction: a failed new checkout
  -- rolls back its reservation, while a limited checkout creates no side effects.
  return public.create_order_v1(p_restaurant_slug, p_idempotency_key, p_request);
end;
$$;

revoke all on function public.create_order_with_abuse_limit_v1(text, text, jsonb, text)
  from public, anon, authenticated;
grant execute on function public.create_order_with_abuse_limit_v1(text, text, jsonb, text)
  to service_role;

-- pg_cron is already part of the payment retry worker migration. Keep only
-- the current day's small counter rows; no raw source address is stored.
select cron.schedule(
  'menu-man-checkout-limits-cleanup', '17 3 * * *',
  'delete from public.checkout_creation_windows where window_start < now() - interval ''1 day'';'
);

commit;

