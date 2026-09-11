-- Provider-neutral payment foundation. Payment preparation happens only after
-- create_order_v1 has committed an authoritative pending_payment order.

begin;

alter table public.orders
  add column if not exists payment_due_at timestamptz,
  add column if not exists placed_at timestamptz,
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancellation_reason text;

alter table public.orders
  drop constraint if exists orders_cancellation_reason_check;

alter table public.orders
  add constraint orders_cancellation_reason_check check (
    cancellation_reason is null or (
      btrim(cancellation_reason) <> '' and char_length(cancellation_reason) <= 100
    )
  );

create table public.restaurant_payment_connections (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete restrict,
  provider_key text not null,
  environment text not null,
  connection_status text not null default 'onboarding',
  is_payment_route boolean not null default false,
  credential_secret_ref text,
  capabilities text[] not null default '{}',
  provider_account_reference text,
  status_reason text,
  provider_metadata jsonb not null default '{}'::jsonb,
  last_verified_at timestamptz,
  disconnected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint restaurant_payment_connections_restaurant_id_id_key unique (restaurant_id, id),
  constraint restaurant_payment_connections_provider_identity_key unique (
    id, provider_key, environment
  ),
  constraint restaurant_payment_connections_restaurant_provider_environment_key unique (
    restaurant_id, provider_key, environment
  ),
  constraint restaurant_payment_connections_provider_key_check check (
    provider_key ~ '^[a-z][a-z0-9_]{1,39}$'
  ),
  constraint restaurant_payment_connections_environment_check check (
    environment in ('test', 'sandbox', 'production')
  ),
  constraint restaurant_payment_connections_status_check check (
    connection_status in (
      'onboarding', 'pending_review', 'active', 'restricted', 'disconnected', 'error'
    )
  ),
  constraint restaurant_payment_connections_fake_test_only_check check (
    provider_key <> 'fake' or environment = 'test'
  ),
  constraint restaurant_payment_connections_metadata_object_check check (
    jsonb_typeof(provider_metadata) = 'object'
  )
);

create unique index restaurant_payment_connections_route_idx
  on public.restaurant_payment_connections (restaurant_id)
  where is_payment_route;

create index restaurant_payment_connections_provider_account_idx
  on public.restaurant_payment_connections (provider_key, environment, provider_account_reference)
  where provider_account_reference is not null;

create table public.payment_provider_references (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.restaurant_payment_connections(id) on delete restrict,
  provider_key text not null,
  environment text not null,
  reference_kind text not null,
  external_id text not null,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  constraint payment_provider_references_kind_check check (
    reference_kind ~ '^[a-z][a-z0-9_]{1,39}$'
  ),
  constraint payment_provider_references_external_id_check check (
    btrim(external_id) <> '' and char_length(external_id) <= 255
  ),
  constraint payment_provider_references_connection_kind_key unique (connection_id, reference_kind),
  constraint payment_provider_references_connection_provider_fkey
    foreign key (connection_id, provider_key, environment)
    references public.restaurant_payment_connections(id, provider_key, environment)
    on delete restrict,
  constraint payment_provider_references_external_key unique (
    provider_key, environment, reference_kind, external_id
  )
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null,
  order_id uuid not null unique,
  connection_id uuid not null,
  status text not null default 'requires_payment_method',
  capture_mode text not null default 'automatic',
  amount_cents integer not null,
  currency text not null,
  authorized_cents integer not null default 0,
  captured_cents integer not null default 0,
  refunded_cents integer not null default 0,
  payment_due_at timestamptz not null,
  succeeded_at timestamptz,
  cancelled_at timestamptz,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payments_restaurant_id_id_key unique (restaurant_id, id),
  constraint payments_order_fkey
    foreign key (restaurant_id, order_id)
    references public.orders(restaurant_id, id) on delete restrict,
  constraint payments_connection_fkey
    foreign key (restaurant_id, connection_id)
    references public.restaurant_payment_connections(restaurant_id, id) on delete restrict,
  constraint payments_status_check check (
    status in (
      'requires_payment_method', 'processing', 'authorized', 'succeeded',
      'failed', 'cancelled', 'partially_refunded', 'refunded'
    )
  ),
  constraint payments_capture_mode_check check (capture_mode in ('automatic', 'manual')),
  constraint payments_currency_check check (currency ~ '^[A-Z]{3}$'),
  constraint payments_amounts_check check (
    amount_cents >= 0
    and authorized_cents >= 0
    and captured_cents >= 0
    and refunded_cents >= 0
    and authorized_cents <= amount_cents
    and captured_cents <= amount_cents
    and refunded_cents <= captured_cents
  ),
  constraint payments_version_check check (version > 0)
);

create index payments_pending_due_idx
  on public.payments (payment_due_at)
  where status in ('requires_payment_method', 'processing', 'authorized', 'failed');

create index payments_restaurant_created_idx
  on public.payments (restaurant_id, created_at desc);

create table public.payment_checkout_sessions (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null,
  payment_id uuid not null,
  access_token_hash text not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  constraint payment_checkout_sessions_payment_fkey
    foreign key (restaurant_id, payment_id)
    references public.payments(restaurant_id, id) on delete cascade,
  constraint payment_checkout_sessions_token_hash_check check (
    access_token_hash ~ '^[0-9a-f]{64}$'
  )
);

create index payment_checkout_sessions_payment_idx
  on public.payment_checkout_sessions (payment_id, expires_at desc);

create table public.payment_attempts (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null,
  payment_id uuid not null,
  connection_id uuid not null,
  client_attempt_key uuid not null,
  provider_idempotency_key text not null,
  provider_payment_reference text,
  provider_transaction_reference text,
  status text not null default 'processing',
  amount_cents integer not null,
  currency text not null,
  provider_status text,
  failure_category text,
  failure_code text,
  failure_message text,
  provider_metadata jsonb not null default '{}'::jsonb,
  last_provider_sync_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payment_attempts_restaurant_id_id_key unique (restaurant_id, id),
  constraint payment_attempts_payment_fkey
    foreign key (restaurant_id, payment_id)
    references public.payments(restaurant_id, id) on delete restrict,
  constraint payment_attempts_connection_fkey
    foreign key (restaurant_id, connection_id)
    references public.restaurant_payment_connections(restaurant_id, id) on delete restrict,
  constraint payment_attempts_payment_client_key unique (payment_id, client_attempt_key),
  constraint payment_attempts_connection_idempotency_key unique (
    connection_id, provider_idempotency_key
  ),
  constraint payment_attempts_status_check check (
    status in ('processing', 'authorized', 'succeeded', 'failed', 'cancelled', 'unknown')
  ),
  constraint payment_attempts_currency_check check (currency ~ '^[A-Z]{3}$'),
  constraint payment_attempts_amount_check check (amount_cents >= 0),
  constraint payment_attempts_metadata_object_check check (
    jsonb_typeof(provider_metadata) = 'object'
  )
);

create unique index payment_attempts_provider_payment_idx
  on public.payment_attempts (connection_id, provider_payment_reference)
  where provider_payment_reference is not null;

create unique index payment_attempts_provider_transaction_idx
  on public.payment_attempts (connection_id, provider_transaction_reference)
  where provider_transaction_reference is not null;

create index payment_attempts_payment_created_idx
  on public.payment_attempts (payment_id, created_at desc);

create table public.payment_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider_key text not null,
  environment text not null,
  provider_event_id text not null,
  connection_id uuid,
  payload_sha256 text not null,
  raw_payload jsonb not null,
  normalized_event jsonb not null,
  signature_verified boolean not null,
  processing_status text not null default 'received',
  attempt_count integer not null default 0,
  available_at timestamptz not null default now(),
  next_attempt_at timestamptz,
  last_error text,
  occurred_at timestamptz not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  constraint payment_webhook_events_provider_event_key unique (
    provider_key, environment, provider_event_id
  ),
  constraint payment_webhook_events_connection_fkey
    foreign key (connection_id) references public.restaurant_payment_connections(id) on delete restrict,
  constraint payment_webhook_events_environment_check check (
    environment in ('test', 'sandbox', 'production')
  ),
  constraint payment_webhook_events_payload_hash_check check (
    payload_sha256 ~ '^[0-9a-f]{64}$'
  ),
  constraint payment_webhook_events_payload_object_check check (
    jsonb_typeof(raw_payload) = 'object' and jsonb_typeof(normalized_event) = 'object'
  ),
  constraint payment_webhook_events_status_check check (
    processing_status in (
      'received', 'processed', 'ignored', 'retryable_failure', 'permanent_failure'
    )
  ),
  constraint payment_webhook_events_attempt_count_check check (attempt_count >= 0),
  constraint payment_webhook_events_verified_check check (signature_verified)
);

create index payment_webhook_events_due_idx
  on public.payment_webhook_events (available_at, received_at)
  where processing_status in ('received', 'retryable_failure');

create table public.refunds (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null,
  payment_id uuid not null,
  connection_id uuid not null,
  amount_cents integer not null,
  currency text not null,
  status text not null default 'requested',
  reason text,
  requested_by text,
  idempotency_key uuid not null,
  provider_idempotency_key text not null,
  provider_refund_reference text,
  provider_status text,
  provider_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint refunds_restaurant_id_id_key unique (restaurant_id, id),
  constraint refunds_payment_fkey
    foreign key (restaurant_id, payment_id)
    references public.payments(restaurant_id, id) on delete restrict,
  constraint refunds_connection_fkey
    foreign key (restaurant_id, connection_id)
    references public.restaurant_payment_connections(restaurant_id, id) on delete restrict,
  constraint refunds_payment_idempotency_key unique (payment_id, idempotency_key),
  constraint refunds_connection_provider_idempotency_key unique (
    connection_id, provider_idempotency_key
  ),
  constraint refunds_status_check check (
    status in ('requested', 'processing', 'succeeded', 'failed', 'cancelled')
  ),
  constraint refunds_amount_check check (amount_cents > 0),
  constraint refunds_currency_check check (currency ~ '^[A-Z]{3}$'),
  constraint refunds_reason_check check (reason is null or char_length(reason) <= 500),
  constraint refunds_metadata_object_check check (jsonb_typeof(provider_metadata) = 'object')
);

create unique index refunds_provider_reference_idx
  on public.refunds (connection_id, provider_refund_reference)
  where provider_refund_reference is not null;

create index refunds_payment_created_idx on public.refunds (payment_id, created_at desc);

create table public.payment_state_transitions (
  id bigint generated always as identity primary key,
  restaurant_id uuid not null references public.restaurants(id) on delete restrict,
  payment_id uuid not null references public.payments(id) on delete restrict,
  payment_attempt_id uuid references public.payment_attempts(id) on delete restrict,
  refund_id uuid references public.refunds(id) on delete restrict,
  webhook_event_id uuid references public.payment_webhook_events(id) on delete restrict,
  source text not null,
  event_type text not null,
  previous_state jsonb not null,
  next_state jsonb not null,
  created_at timestamptz not null default now(),
  constraint payment_state_transitions_source_check check (
    source in ('command', 'webhook', 'reconciliation', 'expiration')
  )
);

create index payment_state_transitions_payment_idx
  on public.payment_state_transitions (payment_id, id);

create table public.analytics_outbox (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  aggregate_type text not null,
  aggregate_id uuid not null,
  payload jsonb not null,
  delivery_status text not null default 'pending',
  attempt_count integer not null default 0,
  available_at timestamptz not null default now(),
  next_attempt_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  delivered_at timestamptz,
  constraint analytics_outbox_aggregate_event_key unique (
    event_type, aggregate_type, aggregate_id
  ),
  constraint analytics_outbox_event_type_check check (
    event_type in ('purchase', 'payment_late_success')
  ),
  constraint analytics_outbox_status_check check (
    delivery_status in ('pending', 'delivering', 'delivered', 'failed')
  ),
  constraint analytics_outbox_payload_object_check check (jsonb_typeof(payload) = 'object'),
  constraint analytics_outbox_attempt_count_check check (attempt_count >= 0)
);

create index analytics_outbox_due_idx
  on public.analytics_outbox (available_at, created_at)
  where delivery_status in ('pending', 'failed');

create trigger restaurant_payment_connections_set_updated_at
before update on public.restaurant_payment_connections
for each row execute function public.set_menu_man_updated_at();

create trigger payments_set_updated_at
before update on public.payments
for each row execute function public.set_menu_man_updated_at();

create trigger payment_attempts_set_updated_at
before update on public.payment_attempts
for each row execute function public.set_menu_man_updated_at();

create trigger refunds_set_updated_at
before update on public.refunds
for each row execute function public.set_menu_man_updated_at();

create or replace function public.menu_man_payment_response_v1(p_payment_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'paymentId', payment.id,
    'orderId', payment.order_id,
    'connectionId', payment.connection_id,
    'provider', connection.provider_key,
    'providerEnvironment', connection.environment,
    'status', payment.status,
    'orderStatus', order_record.order_status,
    'paymentStatus', order_record.payment_status,
    'captureMode', payment.capture_mode,
    'amountCents', payment.amount_cents,
    'currency', payment.currency,
    'paymentDueAt', payment.payment_due_at,
    'paidAt', payment.succeeded_at,
    'latestAttempt', (
      select jsonb_build_object(
        'attemptId', attempt.id,
        'status', attempt.status,
        'failureCategory', attempt.failure_category,
        'failureCode', attempt.failure_code,
        'failureMessage', attempt.failure_message
      )
      from public.payment_attempts attempt
      where attempt.payment_id = payment.id
      order by attempt.created_at desc
      limit 1
    )
  )
  from public.payments payment
  join public.orders order_record on order_record.id = payment.order_id
  join public.restaurant_payment_connections connection on connection.id = payment.connection_id
  where payment.id = p_payment_id;
$$;

create or replace function public.prepare_payment_v1(
  p_order_id uuid,
  p_access_token_hash text,
  p_allow_fake boolean default false,
  p_payment_ttl_minutes integer default 30,
  p_session_ttl_minutes integer default 120
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  order_record record;
  connection_record record;
  payment_record public.payments%rowtype;
  session_expiry timestamptz;
begin
  if p_access_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception using message = 'MM_INVALID_PAYMENT_SESSION|Payment session token is invalid.';
  end if;
  if p_payment_ttl_minutes not between 1 and 1440
    or p_session_ttl_minutes not between 1 and 1440
  then
    raise exception using message = 'MM_INVALID_PAYMENT_SESSION|Payment session lifetime is invalid.';
  end if;

  select * into order_record
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception using message = 'MM_PAYMENT_NOT_FOUND|Order was not found.';
  end if;

  select * into payment_record
  from public.payments
  where order_id = order_record.id
  for update;

  if not found then
    select * into connection_record
    from public.restaurant_payment_connections
    where restaurant_id = order_record.restaurant_id
      and is_payment_route = true
      and connection_status = 'active'
      and 'accept_payments' = any(capabilities)
    for share;

    if not found then
      raise exception using message = 'MM_PAYMENT_PROVIDER_UNAVAILABLE|No active payment provider is configured.';
    end if;
    if connection_record.provider_key = 'fake' and not p_allow_fake then
      raise exception using message = 'MM_PAYMENT_PROVIDER_UNAVAILABLE|The fake payment provider is disabled.';
    end if;
    if order_record.order_status <> 'pending_payment'
      or order_record.payment_status not in ('unpaid', 'pending', 'failed')
    then
      raise exception using message = 'MM_PAYMENT_NOT_ALLOWED|This order cannot start payment.';
    end if;

    insert into public.payments (
      restaurant_id, order_id, connection_id, amount_cents, currency, payment_due_at
    ) values (
      order_record.restaurant_id,
      order_record.id,
      connection_record.id,
      order_record.total_cents,
      order_record.currency,
      now() + make_interval(mins => p_payment_ttl_minutes)
    )
    returning * into payment_record;

    update public.orders
    set payment_due_at = payment_record.payment_due_at
    where id = order_record.id;

    insert into public.payment_state_transitions (
      restaurant_id, payment_id, source, event_type, previous_state, next_state
    ) values (
      payment_record.restaurant_id, payment_record.id, 'command', 'payment.prepared',
      jsonb_build_object('payment', null, 'orderPayment', order_record.payment_status),
      jsonb_build_object('payment', 'requires_payment_method', 'orderPayment', order_record.payment_status)
    );
  else
    select * into connection_record
    from public.restaurant_payment_connections
    where id = payment_record.connection_id;
    if connection_record.provider_key = 'fake' and not p_allow_fake then
      raise exception using message = 'MM_PAYMENT_PROVIDER_UNAVAILABLE|The fake payment provider is disabled.';
    end if;
  end if;

  session_expiry := least(
    now() + make_interval(mins => p_session_ttl_minutes),
    payment_record.payment_due_at + interval '2 hours'
  );

  insert into public.payment_checkout_sessions (
    restaurant_id, payment_id, access_token_hash, expires_at
  ) values (
    payment_record.restaurant_id, payment_record.id, p_access_token_hash, session_expiry
  );

  return public.menu_man_payment_response_v1(payment_record.id)
    || jsonb_build_object('sessionExpiresAt', session_expiry);
end;
$$;

create or replace function public.authorize_payment_session_v1(
  p_order_id uuid,
  p_access_token_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  payment_uuid uuid;
begin
  update public.payment_checkout_sessions session
  set last_used_at = now()
  from public.payments payment
  where session.payment_id = payment.id
    and payment.order_id = p_order_id
    and session.access_token_hash = p_access_token_hash
    and session.revoked_at is null
    and session.expires_at > now()
  returning payment.id into payment_uuid;

  if payment_uuid is null then
    raise exception using message = 'MM_INVALID_PAYMENT_SESSION|Payment session is invalid or expired.';
  end if;

  return public.menu_man_payment_response_v1(payment_uuid);
end;
$$;

create or replace function public.reserve_payment_attempt_v1(
  p_order_id uuid,
  p_access_token_hash text,
  p_client_attempt_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  payment_record public.payments%rowtype;
  connection_record public.restaurant_payment_connections%rowtype;
  attempt_record public.payment_attempts%rowtype;
  order_record public.orders%rowtype;
  attempt_uuid uuid := gen_random_uuid();
begin
  select payment.* into payment_record
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

  select * into order_record from public.orders where id = p_order_id for update;
  select * into connection_record
  from public.restaurant_payment_connections where id = payment_record.connection_id;

  if connection_record.connection_status <> 'active' then
    raise exception using message = 'MM_PAYMENT_PROVIDER_UNAVAILABLE|The payment provider connection is not active.';
  end if;

  select * into attempt_record
  from public.payment_attempts
  where payment_id = payment_record.id and client_attempt_key = p_client_attempt_key;

  if found then
    return jsonb_build_object(
      'attemptId', attempt_record.id,
      'paymentId', payment_record.id,
      'connectionId', payment_record.connection_id,
      'provider', connection_record.provider_key,
      'providerEnvironment', connection_record.environment,
      'providerIdempotencyKey', attempt_record.provider_idempotency_key,
      'amountCents', payment_record.amount_cents,
      'currency', payment_record.currency,
      'captureMode', payment_record.capture_mode,
      'replayed', true
    );
  end if;

  if order_record.order_status <> 'pending_payment'
    or payment_record.status in ('succeeded', 'partially_refunded', 'refunded', 'cancelled')
  then
    raise exception using message = 'MM_PAYMENT_NOT_ALLOWED|This order cannot accept another payment attempt.';
  end if;
  if payment_record.payment_due_at <= now() then
    raise exception using message = 'MM_PAYMENT_EXPIRED|This payment session has expired.';
  end if;
  if exists (
    select 1 from public.payment_attempts
    where payment_id = payment_record.id and status in ('processing', 'unknown', 'authorized', 'succeeded')
  ) then
    raise exception using message = 'MM_PAYMENT_IN_PROGRESS|A payment attempt is already in progress.';
  end if;

  insert into public.payment_attempts (
    id, restaurant_id, payment_id, connection_id, client_attempt_key,
    provider_idempotency_key, amount_cents, currency
  ) values (
    attempt_uuid, payment_record.restaurant_id, payment_record.id,
    payment_record.connection_id, p_client_attempt_key, attempt_uuid::text,
    payment_record.amount_cents, payment_record.currency
  ) returning * into attempt_record;

  update public.payments
  set status = 'processing', version = version + 1
  where id = payment_record.id;

  update public.orders
  set payment_status = 'pending'
  where id = order_record.id and payment_status in ('unpaid', 'failed');

  insert into public.payment_state_transitions (
    restaurant_id, payment_id, payment_attempt_id, source, event_type,
    previous_state, next_state
  ) values (
    payment_record.restaurant_id, payment_record.id, attempt_record.id,
    'command', 'payment.attempt_reserved',
    jsonb_build_object('payment', payment_record.status, 'orderPayment', order_record.payment_status),
    jsonb_build_object('payment', 'processing', 'orderPayment', 'pending')
  );

  return jsonb_build_object(
    'attemptId', attempt_record.id,
    'paymentId', payment_record.id,
    'connectionId', payment_record.connection_id,
    'provider', connection_record.provider_key,
    'providerEnvironment', connection_record.environment,
    'providerIdempotencyKey', attempt_record.provider_idempotency_key,
    'amountCents', payment_record.amount_cents,
    'currency', payment_record.currency,
    'captureMode', payment_record.capture_mode,
    'replayed', false
  );
end;
$$;

create or replace function public.record_payment_command_result_v1(
  p_attempt_id uuid,
  p_status text,
  p_provider_payment_reference text default null,
  p_provider_transaction_reference text default null,
  p_provider_status text default null,
  p_failure_category text default null,
  p_failure_code text default null,
  p_failure_message text default null,
  p_provider_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  attempt_record public.payment_attempts%rowtype;
  payment_record public.payments%rowtype;
  order_record public.orders%rowtype;
  next_status text;
  old_state jsonb;
begin
  if p_status not in ('processing', 'unknown', 'failed') then
    raise exception using message = 'MM_INVALID_PAYMENT_EVENT|Command result status is invalid.';
  end if;
  if jsonb_typeof(p_provider_metadata) <> 'object' then
    raise exception using message = 'MM_INVALID_PAYMENT_EVENT|Provider metadata must be an object.';
  end if;

  select * into attempt_record from public.payment_attempts where id = p_attempt_id for update;
  if not found then
    raise exception using message = 'MM_PAYMENT_NOT_FOUND|Payment attempt was not found.';
  end if;
  select * into payment_record from public.payments where id = attempt_record.payment_id for update;
  select * into order_record from public.orders where id = payment_record.order_id for update;
  old_state := jsonb_build_object(
    'attempt', attempt_record.status,
    'payment', payment_record.status,
    'orderPayment', order_record.payment_status
  );

  next_status := case when attempt_record.status = 'succeeded' then 'succeeded' else p_status end;

  update public.payment_attempts
  set status = next_status,
      provider_payment_reference = coalesce(provider_payment_reference, p_provider_payment_reference),
      provider_transaction_reference = coalesce(provider_transaction_reference, p_provider_transaction_reference),
      provider_status = p_provider_status,
      failure_category = case when next_status = 'failed' then p_failure_category else null end,
      failure_code = case when next_status = 'failed' then p_failure_code else null end,
      failure_message = case when next_status = 'failed' then left(p_failure_message, 500) else null end,
      provider_metadata = provider_metadata || p_provider_metadata,
      last_provider_sync_at = now()
  where id = attempt_record.id;

  if next_status = 'failed' then
    update public.payments set status = 'failed', version = version + 1
    where id = attempt_record.payment_id and status <> 'succeeded';
    update public.orders set payment_status = 'failed'
    where id = (select order_id from public.payments where id = attempt_record.payment_id)
      and order_status = 'pending_payment';
  elsif next_status in ('processing', 'unknown') then
    update public.payments set status = 'processing', version = version + 1
    where id = attempt_record.payment_id and status <> 'succeeded';
  end if;

  select * into attempt_record from public.payment_attempts where id = attempt_record.id;
  select * into payment_record from public.payments where id = payment_record.id;
  select * into order_record from public.orders where id = order_record.id;

  insert into public.payment_state_transitions (
    restaurant_id, payment_id, payment_attempt_id, source, event_type,
    previous_state, next_state
  ) values (
    attempt_record.restaurant_id, attempt_record.payment_id, attempt_record.id,
    'command', 'payment.command_result',
    old_state,
    jsonb_build_object(
      'attempt', attempt_record.status,
      'payment', payment_record.status,
      'orderPayment', order_record.payment_status
    )
  );

  return public.menu_man_payment_response_v1(attempt_record.payment_id);
end;
$$;

create or replace function public.ingest_payment_webhook_v1(
  p_provider_key text,
  p_environment text,
  p_provider_event_id text,
  p_connection_id uuid,
  p_payload_sha256 text,
  p_raw_payload jsonb,
  p_normalized_event jsonb,
  p_occurred_at timestamptz,
  p_available_at timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_uuid uuid;
  inserted boolean := true;
  existing_payload_sha256 text;
begin
  if p_payload_sha256 !~ '^[0-9a-f]{64}$'
    or jsonb_typeof(p_raw_payload) <> 'object'
    or jsonb_typeof(p_normalized_event) <> 'object'
  then
    raise exception using message = 'MM_INVALID_PAYMENT_EVENT|Webhook event is invalid.';
  end if;
  if not exists (
    select 1 from public.restaurant_payment_connections connection
    where connection.id = p_connection_id
      and connection.provider_key = p_provider_key
      and connection.environment = p_environment
  ) then
    raise exception using message = 'MM_INVALID_PAYMENT_EVENT|Webhook connection does not match provider and environment.';
  end if;

  insert into public.payment_webhook_events (
    provider_key, environment, provider_event_id, connection_id, payload_sha256,
    raw_payload, normalized_event, signature_verified, occurred_at, available_at
  ) values (
    p_provider_key, p_environment, p_provider_event_id, p_connection_id,
    p_payload_sha256, p_raw_payload, p_normalized_event, true,
    p_occurred_at, greatest(p_available_at, now() - interval '1 minute')
  )
  on conflict (provider_key, environment, provider_event_id) do nothing
  returning id into event_uuid;

  if event_uuid is null then
    inserted := false;
    select id, payload_sha256 into event_uuid, existing_payload_sha256
    from public.payment_webhook_events
    where provider_key = p_provider_key
      and environment = p_environment
      and provider_event_id = p_provider_event_id;
    if existing_payload_sha256 <> p_payload_sha256 then
      raise exception using message = 'MM_INVALID_PAYMENT_EVENT|Provider event ID was reused with a different payload.';
    end if;
  end if;

  return jsonb_build_object('webhookEventId', event_uuid, 'inserted', inserted);
end;
$$;

create or replace function public.apply_payment_event_v1(p_webhook_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_record public.payment_webhook_events%rowtype;
  attempt_record public.payment_attempts%rowtype;
  payment_record public.payments%rowtype;
  order_record public.orders%rowtype;
  refund_record public.refunds%rowtype;
  event_kind text;
  attempt_uuid uuid;
  refund_uuid uuid;
  old_state jsonb;
  next_state jsonb;
  late_success boolean := false;
  refunded_total integer;
begin
  select * into event_record
  from public.payment_webhook_events
  where id = p_webhook_event_id
  for update;

  if not found then
    raise exception using message = 'MM_INVALID_PAYMENT_EVENT|Webhook event was not found.';
  end if;
  if event_record.processing_status in ('processed', 'ignored') then
    return jsonb_build_object('processed', false, 'duplicate', true);
  end if;
  if event_record.available_at > now() then
    return jsonb_build_object('processed', false, 'pending', true);
  end if;

  event_kind := event_record.normalized_event ->> 'kind';

  if event_kind like 'payment.%' then
    begin
      attempt_uuid := (event_record.normalized_event ->> 'attemptId')::uuid;
    exception when others then
      raise exception using message = 'MM_INVALID_PAYMENT_EVENT|Payment attempt reference is invalid.';
    end;

    select * into attempt_record
    from public.payment_attempts where id = attempt_uuid for update;
    if not found or attempt_record.connection_id <> event_record.connection_id then
      raise exception using message = 'MM_INVALID_PAYMENT_EVENT|Payment attempt does not match its connection.';
    end if;

    select * into payment_record
    from public.payments where id = attempt_record.payment_id for update;
    select * into order_record
    from public.orders where id = payment_record.order_id for update;

    if (event_record.normalized_event ? 'amountCents'
        and (event_record.normalized_event ->> 'amountCents')::integer <> payment_record.amount_cents)
      or (event_record.normalized_event ? 'currency'
        and event_record.normalized_event ->> 'currency' <> payment_record.currency)
    then
      raise exception using message = 'MM_INVALID_PAYMENT_EVENT|Payment amount or currency does not match the order.';
    end if;

    old_state := jsonb_build_object(
      'attempt', attempt_record.status,
      'payment', payment_record.status,
      'order', order_record.order_status,
      'orderPayment', order_record.payment_status
    );

    update public.payment_attempts
    set provider_payment_reference = coalesce(
          provider_payment_reference, event_record.normalized_event ->> 'providerPaymentReference'
        ),
        provider_transaction_reference = coalesce(
          provider_transaction_reference, event_record.normalized_event ->> 'providerTransactionReference'
        ),
        provider_status = event_record.normalized_event ->> 'providerStatus',
        last_provider_sync_at = now()
    where id = attempt_record.id;

    if event_kind = 'payment.processing' then
      if attempt_record.status <> 'succeeded' and payment_record.status <> 'succeeded' then
        update public.payment_attempts set status = 'processing' where id = attempt_record.id;
        update public.payments set status = 'processing', version = version + 1
          where id = payment_record.id and status <> 'cancelled';
      end if;
    elsif event_kind = 'payment.authorized' then
      if attempt_record.status <> 'succeeded' and payment_record.status <> 'succeeded' then
        update public.payment_attempts set status = 'authorized' where id = attempt_record.id;
        update public.payments
        set status = 'authorized', authorized_cents = amount_cents, version = version + 1
        where id = payment_record.id and status <> 'cancelled';
        update public.orders set payment_status = 'pending'
        where id = order_record.id and order_status = 'pending_payment';
      end if;
    elsif event_kind = 'payment.failed' then
      if attempt_record.status <> 'succeeded' and payment_record.status <> 'succeeded' then
        update public.payment_attempts
        set status = 'failed',
            failure_category = coalesce(event_record.normalized_event ->> 'failureCategory', 'provider_decline'),
            failure_code = event_record.normalized_event ->> 'failureCode',
            failure_message = left(event_record.normalized_event ->> 'failureMessage', 500)
        where id = attempt_record.id;
        update public.payments set status = 'failed', version = version + 1
        where id = payment_record.id and status <> 'cancelled';
        update public.orders set payment_status = 'failed'
        where id = order_record.id and order_status = 'pending_payment';
      end if;
    elsif event_kind = 'payment.cancelled' then
      if attempt_record.status <> 'succeeded' and payment_record.status <> 'succeeded' then
        update public.payment_attempts set status = 'cancelled' where id = attempt_record.id;
        update public.payments
        set status = 'cancelled', cancelled_at = coalesce(cancelled_at, now()), version = version + 1
        where id = payment_record.id;
        update public.orders
        set order_status = 'cancelled', payment_status = 'failed',
            cancelled_at = coalesce(cancelled_at, now()),
            cancellation_reason = coalesce(cancellation_reason, 'payment_cancelled')
        where id = order_record.id and order_status = 'pending_payment';
      end if;
    elsif event_kind = 'payment.succeeded' then
      late_success := order_record.order_status = 'cancelled'
        or event_record.occurred_at > payment_record.payment_due_at;

      update public.payment_attempts
      set status = 'succeeded', failure_category = null, failure_code = null, failure_message = null
      where id = attempt_record.id;
      update public.payments
      set status = 'succeeded', authorized_cents = amount_cents,
          captured_cents = amount_cents, succeeded_at = coalesce(succeeded_at, event_record.occurred_at),
          version = version + 1
      where id = payment_record.id;

      if late_success then
        update public.orders set payment_status = 'paid'
        where id = order_record.id;
        insert into public.analytics_outbox (event_type, aggregate_type, aggregate_id, payload)
        values (
          'payment_late_success', 'payment', payment_record.id,
          jsonb_build_object(
            'paymentId', payment_record.id,
            'orderId', order_record.id,
            'restaurantId', order_record.restaurant_id,
            'amountCents', payment_record.amount_cents,
            'currency', payment_record.currency
          )
        ) on conflict (event_type, aggregate_type, aggregate_id) do nothing;
      elsif order_record.order_status = 'pending_payment' then
        update public.orders
        set order_status = 'placed', payment_status = 'paid', placed_at = coalesce(placed_at, now())
        where id = order_record.id;

        insert into public.analytics_outbox (event_type, aggregate_type, aggregate_id, payload)
        values (
          'purchase', 'payment', payment_record.id,
          jsonb_build_object(
            'transactionId', payment_record.id,
            'name', 'purchase',
            'paymentId', payment_record.id,
            'orderId', order_record.id,
            'orderNumber', order_record.order_number::text,
            'restaurantId', order_record.restaurant_id,
            'currency', order_record.currency,
            'revenueCents', order_record.total_cents,
            'taxCents', order_record.tax_cents,
            'tipCents', order_record.tip_cents,
            'items', coalesce((
              select jsonb_agg(jsonb_build_object(
                'itemId', item.menu_item_id,
                'itemName', item.item_name,
                'priceCents', item.unit_price_cents,
                'quantity', item.quantity
              ) order by item.sort_order)
              from public.order_items item where item.order_id = order_record.id
            ), '[]'::jsonb)
          )
        ) on conflict (event_type, aggregate_type, aggregate_id) do nothing;
      end if;
    else
      update public.payment_webhook_events
      set processing_status = 'ignored', processed_at = now(), attempt_count = attempt_count + 1
      where id = event_record.id;
      return jsonb_build_object('processed', true, 'ignored', true);
    end if;

    select * into attempt_record from public.payment_attempts where id = attempt_record.id;
    select * into payment_record from public.payments where id = payment_record.id;
    select * into order_record from public.orders where id = order_record.id;
    next_state := jsonb_build_object(
      'attempt', attempt_record.status,
      'payment', payment_record.status,
      'order', order_record.order_status,
      'orderPayment', order_record.payment_status
    );

    insert into public.payment_state_transitions (
      restaurant_id, payment_id, payment_attempt_id, webhook_event_id,
      source, event_type, previous_state, next_state
    ) values (
      payment_record.restaurant_id, payment_record.id, attempt_record.id, event_record.id,
      'webhook', event_kind, old_state, next_state
    );

  elsif event_kind like 'refund.%' then
    begin
      refund_uuid := (event_record.normalized_event ->> 'refundId')::uuid;
    exception when others then
      raise exception using message = 'MM_INVALID_PAYMENT_EVENT|Refund reference is invalid.';
    end;

    select * into refund_record from public.refunds where id = refund_uuid for update;
    if not found or refund_record.connection_id <> event_record.connection_id then
      raise exception using message = 'MM_INVALID_PAYMENT_EVENT|Refund does not match its connection.';
    end if;
    select * into payment_record from public.payments where id = refund_record.payment_id for update;
    select * into order_record from public.orders where id = payment_record.order_id for update;
    if (event_record.normalized_event ? 'amountCents'
        and (event_record.normalized_event ->> 'amountCents')::integer <> refund_record.amount_cents)
      or (event_record.normalized_event ? 'currency'
        and event_record.normalized_event ->> 'currency' <> refund_record.currency)
    then
      raise exception using message = 'MM_INVALID_PAYMENT_EVENT|Refund amount or currency does not match the request.';
    end if;
    old_state := jsonb_build_object('refund', refund_record.status, 'payment', payment_record.status);

    if event_kind = 'refund.succeeded' then
      update public.refunds
      set status = 'succeeded', completed_at = coalesce(completed_at, event_record.occurred_at),
          provider_refund_reference = coalesce(
            provider_refund_reference, event_record.normalized_event ->> 'providerRefundReference'
          ),
          provider_status = event_record.normalized_event ->> 'providerStatus'
      where id = refund_record.id;

      select coalesce(sum(amount_cents), 0)::integer into refunded_total
      from public.refunds where payment_id = payment_record.id and status = 'succeeded';

      update public.payments
      set refunded_cents = refunded_total,
          status = case when refunded_total = captured_cents then 'refunded' else 'partially_refunded' end,
          version = version + 1
      where id = payment_record.id;
      update public.orders
      set payment_status = case
        when refunded_total = payment_record.captured_cents then 'refunded'
        else 'partially_refunded'
      end
      where id = order_record.id;
    elsif event_kind = 'refund.failed' then
      update public.refunds
      set status = 'failed', provider_status = event_record.normalized_event ->> 'providerStatus'
      where id = refund_record.id;
    elsif event_kind = 'refund.processing' then
      update public.refunds
      set status = 'processing', provider_status = event_record.normalized_event ->> 'providerStatus'
      where id = refund_record.id and status <> 'succeeded';
    else
      update public.payment_webhook_events
      set processing_status = 'ignored', processed_at = now(), attempt_count = attempt_count + 1
      where id = event_record.id;
      return jsonb_build_object('processed', true, 'ignored', true);
    end if;

    select * into refund_record from public.refunds where id = refund_record.id;
    select * into payment_record from public.payments where id = payment_record.id;
    next_state := jsonb_build_object('refund', refund_record.status, 'payment', payment_record.status);
    insert into public.payment_state_transitions (
      restaurant_id, payment_id, refund_id, webhook_event_id,
      source, event_type, previous_state, next_state
    ) values (
      payment_record.restaurant_id, payment_record.id, refund_record.id, event_record.id,
      'webhook', event_kind, old_state, next_state
    );
  else
    update public.payment_webhook_events
    set processing_status = 'ignored', processed_at = now(), attempt_count = attempt_count + 1
    where id = event_record.id;
    return jsonb_build_object('processed', true, 'ignored', true);
  end if;

  update public.payment_webhook_events
  set processing_status = 'processed', processed_at = now(),
      attempt_count = attempt_count + 1, last_error = null
  where id = event_record.id;

  return jsonb_build_object('processed', true, 'lateSuccess', late_success);
end;
$$;

create or replace function public.list_due_payment_webhooks_v1(
  p_provider_key text,
  p_limit integer default 25
)
returns table (webhook_event_id uuid)
language sql
security definer
set search_path = ''
as $$
  select event.id
  from public.payment_webhook_events event
  where event.provider_key = p_provider_key
    and event.processing_status in ('received', 'retryable_failure')
    and event.available_at <= now()
    and coalesce(event.next_attempt_at, '-infinity'::timestamptz) <= now()
  order by event.available_at, event.received_at
  limit least(greatest(p_limit, 1), 100);
$$;

create or replace function public.expire_payment_v1(p_payment_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  payment_record public.payments%rowtype;
  order_record public.orders%rowtype;
begin
  select * into payment_record from public.payments where id = p_payment_id for update;
  if not found then
    raise exception using message = 'MM_PAYMENT_NOT_FOUND|Payment was not found.';
  end if;
  select * into order_record from public.orders where id = payment_record.order_id for update;

  if payment_record.status in ('processing', 'unknown', 'authorized') then
    raise exception using message = 'MM_PAYMENT_IN_PROGRESS|Payment must be reconciled before expiration.';
  end if;
  if payment_record.status in ('succeeded', 'partially_refunded', 'refunded') then
    return public.menu_man_payment_response_v1(payment_record.id);
  end if;

  update public.payments
  set status = 'cancelled', cancelled_at = coalesce(cancelled_at, now()), version = version + 1
  where id = payment_record.id;
  update public.orders
  set order_status = 'cancelled', payment_status = 'failed',
      cancelled_at = coalesce(cancelled_at, now()),
      cancellation_reason = coalesce(cancellation_reason, 'payment_expired')
  where id = order_record.id and order_status = 'pending_payment';

  insert into public.payment_state_transitions (
    restaurant_id, payment_id, source, event_type, previous_state, next_state
  ) values (
    payment_record.restaurant_id, payment_record.id, 'expiration', 'payment.expired',
    jsonb_build_object('payment', payment_record.status, 'order', order_record.order_status),
    jsonb_build_object('payment', 'cancelled', 'order', 'cancelled')
  );

  return public.menu_man_payment_response_v1(payment_record.id);
end;
$$;

create or replace function public.reserve_refund_v1(
  p_payment_id uuid,
  p_idempotency_key uuid,
  p_amount_cents integer,
  p_reason text default null,
  p_requested_by text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  payment_record public.payments%rowtype;
  refund_record public.refunds%rowtype;
  reserved_total bigint;
  refund_uuid uuid := gen_random_uuid();
begin
  select * into payment_record from public.payments where id = p_payment_id for update;
  if not found then
    raise exception using message = 'MM_PAYMENT_NOT_FOUND|Payment was not found.';
  end if;

  select * into refund_record
  from public.refunds
  where payment_id = payment_record.id and idempotency_key = p_idempotency_key;
  if found then
    return jsonb_build_object(
      'refundId', refund_record.id,
      'paymentId', refund_record.payment_id,
      'connectionId', refund_record.connection_id,
      'amountCents', refund_record.amount_cents,
      'currency', refund_record.currency,
      'providerIdempotencyKey', refund_record.provider_idempotency_key,
      'status', refund_record.status,
      'replayed', true
    );
  end if;

  if payment_record.captured_cents <= 0 or payment_record.status not in (
    'succeeded', 'partially_refunded', 'refunded'
  ) then
    raise exception using message = 'MM_REFUND_NOT_ALLOWED|Payment is not refundable.';
  end if;

  select coalesce(sum(amount_cents), 0) into reserved_total
  from public.refunds
  where payment_id = payment_record.id and status in ('requested', 'processing', 'succeeded');

  if p_amount_cents <= 0 or reserved_total + p_amount_cents > payment_record.captured_cents then
    raise exception using message = 'MM_REFUND_NOT_ALLOWED|Refund exceeds the remaining captured amount.';
  end if;

  insert into public.refunds (
    id, restaurant_id, payment_id, connection_id, amount_cents, currency,
    reason, requested_by, idempotency_key, provider_idempotency_key
  ) values (
    refund_uuid, payment_record.restaurant_id, payment_record.id, payment_record.connection_id,
    p_amount_cents, payment_record.currency, nullif(btrim(p_reason), ''),
    nullif(btrim(p_requested_by), ''), p_idempotency_key, refund_uuid::text
  ) returning * into refund_record;

  insert into public.payment_state_transitions (
    restaurant_id, payment_id, refund_id, source, event_type, previous_state, next_state
  ) values (
    payment_record.restaurant_id, payment_record.id, refund_record.id,
    'command', 'refund.requested',
    jsonb_build_object('refund', null), jsonb_build_object('refund', 'requested')
  );

  return jsonb_build_object(
    'refundId', refund_record.id,
    'paymentId', refund_record.payment_id,
    'connectionId', refund_record.connection_id,
    'amountCents', refund_record.amount_cents,
    'currency', refund_record.currency,
    'providerIdempotencyKey', refund_record.provider_idempotency_key,
    'status', refund_record.status,
    'replayed', false
  );
end;
$$;

alter table public.restaurant_payment_connections enable row level security;
alter table public.payment_provider_references enable row level security;
alter table public.payments enable row level security;
alter table public.payment_checkout_sessions enable row level security;
alter table public.payment_attempts enable row level security;
alter table public.payment_webhook_events enable row level security;
alter table public.refunds enable row level security;
alter table public.payment_state_transitions enable row level security;
alter table public.analytics_outbox enable row level security;

revoke all on table
  public.restaurant_payment_connections,
  public.payment_provider_references,
  public.payments,
  public.payment_checkout_sessions,
  public.payment_attempts,
  public.payment_webhook_events,
  public.refunds,
  public.payment_state_transitions,
  public.analytics_outbox
from anon, authenticated;

revoke insert, update, delete on table
  public.restaurant_payment_connections,
  public.payment_provider_references,
  public.payments,
  public.payment_checkout_sessions,
  public.payment_attempts,
  public.payment_webhook_events,
  public.refunds,
  public.payment_state_transitions,
  public.analytics_outbox
from service_role;

grant select on table
  public.restaurant_payment_connections,
  public.payment_provider_references,
  public.payments,
  public.payment_checkout_sessions,
  public.payment_attempts,
  public.payment_webhook_events,
  public.refunds,
  public.payment_state_transitions,
  public.analytics_outbox
to service_role;

revoke all on function public.menu_man_payment_response_v1(uuid) from public, anon, authenticated, service_role;
revoke all on function public.prepare_payment_v1(uuid, text, boolean, integer, integer) from public, anon, authenticated;
revoke all on function public.authorize_payment_session_v1(uuid, text) from public, anon, authenticated;
revoke all on function public.reserve_payment_attempt_v1(uuid, text, uuid) from public, anon, authenticated;
revoke all on function public.record_payment_command_result_v1(uuid, text, text, text, text, text, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.ingest_payment_webhook_v1(text, text, text, uuid, text, jsonb, jsonb, timestamptz, timestamptz) from public, anon, authenticated;
revoke all on function public.apply_payment_event_v1(uuid) from public, anon, authenticated;
revoke all on function public.list_due_payment_webhooks_v1(text, integer) from public, anon, authenticated;
revoke all on function public.expire_payment_v1(uuid) from public, anon, authenticated;
revoke all on function public.reserve_refund_v1(uuid, uuid, integer, text, text) from public, anon, authenticated;

grant execute on function public.prepare_payment_v1(uuid, text, boolean, integer, integer) to service_role;
grant execute on function public.authorize_payment_session_v1(uuid, text) to service_role;
grant execute on function public.reserve_payment_attempt_v1(uuid, text, uuid) to service_role;
grant execute on function public.record_payment_command_result_v1(uuid, text, text, text, text, text, text, text, jsonb) to service_role;
grant execute on function public.ingest_payment_webhook_v1(text, text, text, uuid, text, jsonb, jsonb, timestamptz, timestamptz) to service_role;
grant execute on function public.apply_payment_event_v1(uuid) to service_role;
grant execute on function public.list_due_payment_webhooks_v1(text, integer) to service_role;
grant execute on function public.expire_payment_v1(uuid) to service_role;
grant execute on function public.reserve_refund_v1(uuid, uuid, integer, text, text) to service_role;

commit;
