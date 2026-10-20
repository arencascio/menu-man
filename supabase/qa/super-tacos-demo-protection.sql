-- All demo order sources use one transaction lock, including simultaneous new
-- idempotency keys. Quotas and the authoritative order commit or roll back together.
create function public.create_demo_order_v1(p_restaurant_slug text,p_idempotency_key text,p_request jsonb,p_source_hash text)
returns jsonb language plpgsql security definer set search_path='' set lock_timeout='2s' as $$
declare
  tenant constant uuid := '20000000-0000-4000-8000-000000000001';
  current_window timestamptz;
  accepted integer;
  key text;
begin
  if p_restaurant_slug is distinct from 'super-tacos'
    or not exists(select 1 from public.restaurants where id=tenant and slug=p_restaurant_slug and is_active)
    or p_source_hash is null or p_source_hash !~ '^[0-9a-f]{64}$' or p_source_hash=repeat('0',64)
  then raise exception 'MM_ORDERING_DISABLED|Demo checkout configuration is unavailable.'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('public-demo:'||tenant::text,0));
  -- Canonical checkout still validates payload/fingerprint and session ownership.
  if exists(select 1 from public.orders where restaurant_id=tenant and idempotency_key=pg_catalog.lower(p_idempotency_key)) then
    return public.create_order_v1(p_restaurant_slug,p_idempotency_key,p_request);
  end if;
  current_window:=pg_catalog.date_bin('10 minutes'::interval,now(),'2000-01-01'::timestamptz);
  delete from public.checkout_creation_windows where restaurant_id=tenant and window_start<now()-interval '1 day';
  foreach key in array array[p_source_hash,repeat('0',64)] loop
    insert into public.checkout_creation_windows as counter(restaurant_id,source_hash,window_start,creation_count)
    values(tenant,key,current_window,1)
    on conflict(restaurant_id,source_hash,window_start) do update set creation_count=counter.creation_count+1
      where counter.creation_count<case when key=repeat('0',64) then 50 else 5 end
    returning creation_count into accepted;
    if accepted is null then raise exception 'MM_CHECKOUT_RATE_LIMITED|600'; end if;
  end loop;
  perform pg_catalog.set_config('menu_man.demo_order_entry','allowed',true);
  return public.create_order_v1(p_restaurant_slug,p_idempotency_key,p_request);
end;
$$;
revoke all on function public.create_demo_order_v1(text,text,jsonb,text) from public,anon,authenticated,service_role;
grant execute on function public.create_demo_order_v1(text,text,jsonb,text) to service_role;

-- Old Preview builds still share Staging. They cannot bypass the demo limiter
-- using the ordinary create_order RPC. Existing-order reads/replays are still
-- governed by the canonical contracts; obsolete deployments must be retired.
create function private.guard_super_tacos_demo_order_v1()
returns trigger language plpgsql set search_path='' as $$
begin
  if new.restaurant_id='20000000-0000-4000-8000-000000000001'::uuid
    and pg_catalog.current_setting('menu_man.demo_order_entry',true) is distinct from 'allowed'
  then raise exception 'MM_ORDERING_DISABLED|Use the current demo checkout.'; end if;
  return new;
end;
$$;
revoke all on function private.guard_super_tacos_demo_order_v1() from public,anon,authenticated,service_role;
create trigger guard_super_tacos_demo_order before insert on public.orders
for each row execute function private.guard_super_tacos_demo_order_v1();

-- Defense against future preference changes: no customer or owner order-email
-- record can enter the delivery queue for this fictional tenant.
create function private.suppress_super_tacos_demo_email_v1()
returns trigger language plpgsql set search_path='' as $$
begin
  if new.restaurant_id='20000000-0000-4000-8000-000000000001'::uuid then return null; end if;
  return new;
end;
$$;
revoke all on function private.suppress_super_tacos_demo_email_v1() from public,anon,authenticated,service_role;
create trigger suppress_super_tacos_demo_email before insert or update on public.notification_outbox
for each row execute function private.suppress_super_tacos_demo_email_v1();
