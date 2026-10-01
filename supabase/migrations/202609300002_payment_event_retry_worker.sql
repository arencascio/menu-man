-- Process verified payment events independently of webhook and customer traffic.
-- A failed application rolls back only that event's financial writes; its retry
-- metadata is then committed with the rest of the bounded batch.
begin;

create index payment_webhook_events_retry_due_idx
  on public.payment_webhook_events
    (coalesce(next_attempt_at, available_at), received_at, id)
  where processing_status in ('received', 'retryable_failure');

create function public.drain_due_payment_webhooks_v1(
  p_provider_key text default null,
  p_limit integer default 25
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  event_record record;
  apply_result jsonb;
  failure_message text;
  failure_status text;
  claimed_count integer := 0;
  applied_count integer := 0;
  failed_count integer := 0;
  quarantined_count integer := 0;
begin
  for event_record in
    select event.id
    from public.payment_webhook_events event
    where (p_provider_key is null or event.provider_key = p_provider_key)
      and event.processing_status in ('received', 'retryable_failure')
      and event.available_at <= now()
      and (event.next_attempt_at is null or event.next_attempt_at <= now())
    order by coalesce(event.next_attempt_at, event.available_at),
             event.received_at, event.id
    limit least(greatest(coalesce(p_limit, 25), 1), 100)
    for update of event skip locked
  loop
    claimed_count := claimed_count + 1;
    begin
      apply_result := public.apply_payment_event_v1(event_record.id);
      if coalesce((apply_result ->> 'processed')::boolean, false) is not true then
        raise exception 'Eligible payment event was not applied.';
      end if;
      update public.payment_webhook_events
      set next_attempt_at = null, last_error = null
      where id = event_record.id;
      applied_count := applied_count + 1;
    exception when others then
      failure_message := pg_catalog.left(sqlstate || ': ' || sqlerrm, 500);
      update public.payment_webhook_events event
      set attempt_count = event.attempt_count + 1,
          processing_status = case when event.attempt_count + 1 >= 8
            then 'permanent_failure' else 'retryable_failure' end,
          next_attempt_at = case when event.attempt_count + 1 >= 8 then null
            else now() + make_interval(secs => least(
              3600, 30 * (2 ^ least(event.attempt_count + 1, 7))
            )) end,
          last_error = failure_message
      where event.id = event_record.id
      returning event.processing_status into failure_status;
      failed_count := failed_count + 1;
      if failure_status = 'permanent_failure' then
        quarantined_count := quarantined_count + 1;
      end if;
    end;
  end loop;

  return pg_catalog.jsonb_build_object(
    'claimed', claimed_count,
    'applied', applied_count,
    'failed', failed_count,
    'quarantined', quarantined_count
  );
end;
$$;

revoke all on function public.drain_due_payment_webhooks_v1(text, integer)
  from public, anon, authenticated, service_role;
grant execute on function public.drain_due_payment_webhooks_v1(text, integer)
  to service_role;

-- Supabase Cron runs inside this database, including staging Preview's
-- database, where Vercel production-only cron jobs cannot run.
create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule(
  'menu-man-payment-events', '* * * * *',
  'select public.drain_due_payment_webhooks_v1(null, 100);'
);

commit;
