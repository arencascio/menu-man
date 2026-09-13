-- Provider-neutral support required by the first real provider adapter:
-- refund command correlation and authenticated server-side reconciliation.

begin;

alter table public.refunds
  add column failure_category text,
  add column failure_code text,
  add column failure_message text;

alter table public.payment_webhook_events
  add column event_source text not null default 'webhook';

alter table public.payment_webhook_events
  drop constraint payment_webhook_events_verified_check;

alter table public.payment_webhook_events
  add constraint payment_webhook_events_source_check check (
    event_source in ('webhook', 'reconciliation')
  ),
  add constraint payment_webhook_events_verified_check check (
    (event_source = 'webhook' and signature_verified)
    or (event_source = 'reconciliation' and not signature_verified)
  );

create or replace function public.record_refund_command_result_v1(
  p_refund_id uuid,
  p_status text,
  p_provider_refund_reference text default null,
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
  refund_record public.refunds%rowtype;
  payment_record public.payments%rowtype;
  old_state jsonb;
  next_status text;
begin
  if p_status not in ('processing', 'failed')
    or jsonb_typeof(p_provider_metadata) <> 'object'
  then
    raise exception using message = 'MM_INVALID_PAYMENT_EVENT|Refund command result is invalid.';
  end if;

  select * into refund_record
  from public.refunds
  where id = p_refund_id
  for update;
  if not found then
    raise exception using message = 'MM_PAYMENT_NOT_FOUND|Refund was not found.';
  end if;
  select * into payment_record from public.payments where id = refund_record.payment_id for update;

  if refund_record.provider_refund_reference is not null
    and p_provider_refund_reference is not null
    and refund_record.provider_refund_reference <> p_provider_refund_reference
  then
    raise exception using message = 'MM_INVALID_PAYMENT_EVENT|Provider refund reference changed unexpectedly.';
  end if;

  old_state := jsonb_build_object('refund', refund_record.status, 'payment', payment_record.status);
  next_status := case when refund_record.status = 'succeeded' then 'succeeded' else p_status end;

  update public.refunds
  set status = next_status,
      provider_refund_reference = coalesce(provider_refund_reference, p_provider_refund_reference),
      provider_status = p_provider_status,
      failure_category = case when next_status = 'failed' then p_failure_category else null end,
      failure_code = case when next_status = 'failed' then p_failure_code else null end,
      failure_message = case when next_status = 'failed' then left(p_failure_message, 500) else null end,
      provider_metadata = provider_metadata || p_provider_metadata
  where id = refund_record.id;

  select * into refund_record from public.refunds where id = refund_record.id;
  insert into public.payment_state_transitions (
    restaurant_id, payment_id, refund_id, source, event_type, previous_state, next_state
  ) values (
    refund_record.restaurant_id, refund_record.payment_id, refund_record.id,
    'command', 'refund.command_result', old_state,
    jsonb_build_object('refund', refund_record.status, 'payment', payment_record.status)
  );

  return jsonb_build_object(
    'refundId', refund_record.id,
    'paymentId', refund_record.payment_id,
    'connectionId', refund_record.connection_id,
    'status', refund_record.status,
    'providerRefundReference', refund_record.provider_refund_reference
  );
end;
$$;

create or replace function public.ingest_payment_reconciliation_v1(
  p_provider_key text,
  p_environment text,
  p_provider_event_id text,
  p_connection_id uuid,
  p_normalized_event jsonb,
  p_occurred_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_uuid uuid;
  payload_sha256 text;
  existing_payload_sha256 text;
  inserted boolean := true;
  apply_result jsonb;
begin
  if btrim(coalesce(p_provider_event_id, '')) = ''
    or jsonb_typeof(p_normalized_event) <> 'object'
    or p_occurred_at is null
  then
    raise exception using message = 'MM_INVALID_PAYMENT_EVENT|Reconciliation event is invalid.';
  end if;
  if not exists (
    select 1 from public.restaurant_payment_connections connection
    where connection.id = p_connection_id
      and connection.provider_key = p_provider_key
      and connection.environment = p_environment
  ) then
    raise exception using message = 'MM_INVALID_PAYMENT_EVENT|Reconciliation connection does not match provider and environment.';
  end if;

  payload_sha256 := pg_catalog.encode(
    extensions.digest(pg_catalog.convert_to(p_normalized_event::text, 'UTF8'), 'sha256'),
    'hex'
  );

  insert into public.payment_webhook_events (
    provider_key, environment, provider_event_id, connection_id, payload_sha256,
    raw_payload, normalized_event, signature_verified, event_source,
    occurred_at, available_at
  ) values (
    p_provider_key, p_environment, p_provider_event_id, p_connection_id, payload_sha256,
    p_normalized_event, p_normalized_event, false, 'reconciliation',
    p_occurred_at, now()
  )
  on conflict (provider_key, environment, provider_event_id) do nothing
  returning id into event_uuid;

  if event_uuid is null then
    inserted := false;
    select event.id, event.payload_sha256 into event_uuid, existing_payload_sha256
    from public.payment_webhook_events event
    where event.provider_key = p_provider_key
      and event.environment = p_environment
      and event.provider_event_id = p_provider_event_id;
    if existing_payload_sha256 <> payload_sha256 then
      raise exception using message = 'MM_INVALID_PAYMENT_EVENT|Provider event ID was reused with a different payload.';
    end if;
  end if;

  apply_result := public.apply_payment_event_v1(event_uuid);
  update public.payment_state_transitions transition
  set source = 'reconciliation'
  where transition.webhook_event_id = event_uuid
    and transition.source = 'webhook';

  return jsonb_build_object(
    'providerEventId', p_provider_event_id,
    'paymentEventId', event_uuid,
    'inserted', inserted,
    'result', apply_result
  );
end;
$$;

create or replace function public.touch_payment_reconciliation_v1(
  p_attempt_id uuid,
  p_provider_status text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.payment_attempts
  set last_provider_sync_at = now(),
      provider_status = coalesce(left(p_provider_status, 100), provider_status)
  where id = p_attempt_id;
  if not found then
    raise exception using message = 'MM_PAYMENT_NOT_FOUND|Payment attempt was not found.';
  end if;
end;
$$;

revoke all on function public.record_refund_command_result_v1(
  uuid, text, text, text, text, text, text, jsonb
) from public, anon, authenticated;
revoke all on function public.ingest_payment_reconciliation_v1(
  text, text, text, uuid, jsonb, timestamptz
) from public, anon, authenticated;
revoke all on function public.touch_payment_reconciliation_v1(uuid, text)
  from public, anon, authenticated;

grant execute on function public.record_refund_command_result_v1(
  uuid, text, text, text, text, text, text, jsonb
) to service_role;
grant execute on function public.ingest_payment_reconciliation_v1(
  text, text, text, uuid, jsonb, timestamptz
) to service_role;
grant execute on function public.touch_payment_reconciliation_v1(uuid, text)
  to service_role;

commit;
