-- Optional catering module. No tenant is enabled or given invented content.
begin;

insert into public.restaurant_capabilities (capability, description)
values ('manage_catering', 'Manage catering settings and customer inquiries');
insert into public.restaurant_role_capability_defaults (role, capability, allowed)
values ('owner', 'manage_catering', true), ('manager', 'manage_catering', false), ('staff', 'manage_catering', false);

create table public.restaurant_catering_settings (
  restaurant_id uuid primary key references public.restaurants(id) on delete restrict,
  settings jsonb not null,
  updated_at timestamptz not null default now()
);
create table public.catering_inquiries (
  id uuid primary key default extensions.gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete restrict,
  submission_id uuid not null,
  request_hash text not null,
  name text not null check (char_length(name) between 1 and 120),
  email text not null check (char_length(email) <= 320),
  phone text not null check (char_length(phone) <= 40),
  event_date date not null,
  guest_count integer not null check (guest_count between 1 and 100000),
  event_details text not null check (char_length(event_details) <= 1000),
  notes text not null check (char_length(notes) <= 2000),
  status text not null default 'new' check (status in ('new', 'contacted', 'closed')),
  notification_status text not null default 'disabled' check (notification_status in ('disabled', 'not_configured', 'pending', 'sent', 'failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_id, submission_id),
  check (email <> '' or phone <> '')
);
create index catering_inquiries_tenant_created_idx on public.catering_inquiries (restaurant_id, created_at desc, id desc);
create table public.catering_submission_windows (
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  source_hash text not null check (source_hash ~ '^[0-9a-f]{64}$'),
  window_start timestamptz not null,
  submission_count integer not null check (submission_count between 1 and 60),
  primary key (restaurant_id, source_hash, window_start)
);
alter table public.restaurant_catering_settings enable row level security;
alter table public.catering_inquiries enable row level security;
alter table public.catering_submission_windows enable row level security;
revoke all on public.restaurant_catering_settings, public.catering_inquiries, public.catering_submission_windows from public, anon, authenticated, service_role;
-- The public shell reads only presentation configuration. All writes use RPCs.
grant select on public.restaurant_catering_settings to service_role;

create function public.get_managed_catering_settings_v1(p_restaurant_slug text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare access_record record; result jsonb;
begin
  select * into strict access_record from private.require_restaurant_capability_v1(p_restaurant_slug, 'manage_catering');
  select settings into result from public.restaurant_catering_settings where restaurant_id = access_record.restaurant_id;
  return coalesce(result, '{}'::jsonb);
end;
$$;

create function public.update_managed_catering_settings_v1(p_restaurant_slug text, p_settings jsonb)
returns jsonb language plpgsql security definer set search_path = '' set lock_timeout = '2s' as $$
declare access_record record;
begin
  select * into strict access_record from private.require_restaurant_capability_v1(p_restaurant_slug, 'manage_catering');
  if p_settings is null or jsonb_typeof(p_settings) <> 'object'
    or (select count(*) from jsonb_object_keys(p_settings)) <> 7
    or jsonb_typeof(p_settings->'enabled') is distinct from 'boolean'
    or jsonb_typeof(p_settings->'notifyOwner') is distinct from 'boolean'
    or jsonb_typeof(p_settings->'heading') is distinct from 'string'
    or jsonb_typeof(p_settings->'description') is distinct from 'string'
    or jsonb_typeof(p_settings->'imageUrl') is distinct from 'string'
    or jsonb_typeof(p_settings->'imageAlt') is distinct from 'string'
    or jsonb_typeof(p_settings->'ctaLabel') is distinct from 'string'
    or char_length(btrim(p_settings->>'heading')) not between 1 and 120
    or char_length(p_settings->>'description') > 2000
    or char_length(p_settings->>'imageUrl') > 2048
    or char_length(p_settings->>'imageAlt') > 200
    or char_length(btrim(p_settings->>'ctaLabel')) not between 1 and 60
    or ((p_settings->>'imageUrl') <> '' and ((p_settings->>'imageUrl') !~ '^(https://|/[^/])' or btrim(p_settings->>'imageAlt') = ''))
  then raise exception 'MM_MANAGEMENT_INVALID_REQUEST|Catering settings are invalid.'; end if;
  insert into public.restaurant_catering_settings (restaurant_id, settings)
  values (access_record.restaurant_id, p_settings)
  on conflict (restaurant_id) do update set settings = excluded.settings, updated_at = now();
  return p_settings;
end;
$$;

create function public.submit_catering_inquiry_v1(p_restaurant_slug text, p_submission_id uuid, p_request jsonb, p_source_hash text)
returns jsonb language plpgsql security definer set search_path = '' set lock_timeout = '2s' as $$
declare
  tenant public.restaurants%rowtype;
  config jsonb;
  existing public.catering_inquiries%rowtype;
  fingerprint text;
  current_window timestamptz;
  accepted_count integer;
  recipient text;
  notification text;
  inquiry_id uuid;
  limiter_key text;
begin
  select * into tenant from public.restaurants where slug = p_restaurant_slug and is_active = true;
  if not found then raise exception 'MM_CATERING_NOT_FOUND'; end if;
  select settings into config from public.restaurant_catering_settings where restaurant_id = tenant.id for share;
  if coalesce((config->>'enabled')::boolean, false) = false then raise exception 'MM_CATERING_NOT_FOUND'; end if;
  if p_submission_id is null or p_request is null or jsonb_typeof(p_request) <> 'object'
    or jsonb_typeof(p_request->'name') is distinct from 'string'
    or jsonb_typeof(p_request->'email') is distinct from 'string'
    or jsonb_typeof(p_request->'phone') is distinct from 'string'
    or jsonb_typeof(p_request->'eventDate') is distinct from 'string'
    or jsonb_typeof(p_request->'guestCount') is distinct from 'number'
    or jsonb_typeof(p_request->'eventDetails') is distinct from 'string'
    or jsonb_typeof(p_request->'notes') is distinct from 'string'
    or char_length(btrim(p_request->>'name')) not between 1 and 120
    or char_length(p_request->>'email') > 320 or char_length(p_request->>'phone') > 40
    or (p_request->>'email' = '' and p_request->>'phone' = '')
    or (p_request->>'email' <> '' and p_request->>'email' !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')
    or (p_request->>'phone' <> '' and (p_request->>'phone' !~ '^[+()0-9 .-]+$' or char_length(regexp_replace(p_request->>'phone', '[^0-9]', '', 'g')) < 7))
    or p_request->>'guestCount' !~ '^[0-9]{1,6}$' or (p_request->>'guestCount')::integer not between 1 and 100000
    or char_length(p_request->>'eventDetails') > 1000 or char_length(p_request->>'notes') > 2000
    or p_request->>'eventDate' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
    or p_source_hash is null or p_source_hash !~ '^[0-9a-f]{64}$'
  then raise exception 'MM_CATERING_INVALID'; end if;
  fingerprint := encode(extensions.digest(p_request::text, 'sha256'), 'hex');
  -- Serialize only this tenant's small inquiry operation. Exact retries neither
  -- insert another lead nor consume the quota nor send another notification.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('catering:' || tenant.id::text, 0));
  select * into existing from public.catering_inquiries where restaurant_id = tenant.id and submission_id = p_submission_id;
  if found then
    if existing.request_hash <> fingerprint then raise exception 'MM_CATERING_CONFLICT'; end if;
    return jsonb_build_object('id', existing.id, 'replayed', true);
  end if;
  if (p_request->>'eventDate')::date < (now() at time zone coalesce(tenant.timezone, 'UTC'))::date then raise exception 'MM_CATERING_DATE'; end if;
  current_window := pg_catalog.date_bin('15 minutes'::interval, now(), '2000-01-01'::timestamptz);
  -- Cleanup is tenant-local and bounded by the global 60/15min creation quota.
  delete from public.catering_submission_windows where restaurant_id = tenant.id and window_start < now() - interval '1 day';
  foreach limiter_key in array array[p_source_hash, repeat('0', 64)] loop
    insert into public.catering_submission_windows as counter (restaurant_id, source_hash, window_start, submission_count)
    values (tenant.id, limiter_key, current_window, 1)
    on conflict (restaurant_id, source_hash, window_start) do update set submission_count = counter.submission_count + 1
      where counter.submission_count < case when limiter_key = repeat('0', 64) then 60 else 5 end
    returning submission_count into accepted_count;
    if accepted_count is null then raise exception 'MM_CATERING_RATE_LIMITED'; end if;
  end loop;
  if coalesce((config->>'notifyOwner')::boolean, false) then
    select internal_email_recipient into recipient from public.restaurant_notification_settings where restaurant_id = tenant.id;
    notification := case when recipient is null then 'not_configured' else 'pending' end;
  else notification := 'disabled'; end if;
  insert into public.catering_inquiries (restaurant_id, submission_id, request_hash, name, email, phone, event_date, guest_count, event_details, notes, notification_status)
  values (tenant.id, p_submission_id, fingerprint, btrim(p_request->>'name'), p_request->>'email', p_request->>'phone', (p_request->>'eventDate')::date,
    (p_request->>'guestCount')::integer, p_request->>'eventDetails', p_request->>'notes', notification)
  returning id into inquiry_id;
  return jsonb_build_object('id', inquiry_id, 'replayed', false, 'notificationRecipient', recipient);
end;
$$;

create function public.complete_catering_notification_v1(p_inquiry_id uuid, p_status text)
returns void language plpgsql security definer set search_path = '' set lock_timeout = '2s' as $$
begin
  if p_status not in ('sent', 'failed', 'not_configured') then raise exception 'MM_CATERING_INVALID'; end if;
  update public.catering_inquiries set notification_status = p_status where id = p_inquiry_id and notification_status = 'pending';
end;
$$;

create function public.list_managed_catering_inquiries_v1(p_restaurant_slug text, p_before timestamptz default null, p_before_id uuid default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare access_record record; result jsonb;
begin
  select * into strict access_record from private.require_restaurant_capability_v1(p_restaurant_slug, 'manage_catering');
  select coalesce(jsonb_agg(to_jsonb(page) order by page.created_at desc, page.id desc), '[]'::jsonb) into result from (
    select id, created_at, name, email, phone, event_date, guest_count, event_details, notes, status, notification_status
    from public.catering_inquiries
    where restaurant_id = access_record.restaurant_id
      and (p_before is null or (created_at, id) < (p_before, p_before_id))
    order by created_at desc, id desc limit 51
  ) page;
  return result;
end;
$$;

create function public.update_managed_catering_inquiry_v1(p_restaurant_slug text, p_inquiry_id uuid, p_status text, p_expected_status text)
returns void language plpgsql security definer set search_path = '' set lock_timeout = '2s' as $$
declare access_record record;
begin
  select * into strict access_record from private.require_restaurant_capability_v1(p_restaurant_slug, 'manage_catering');
  if p_status is null or p_status not in ('new', 'contacted', 'closed') then raise exception 'MM_MANAGEMENT_INVALID_REQUEST|Invalid lead status.'; end if;
  update public.catering_inquiries set status = p_status, updated_at = now()
    where restaurant_id = access_record.restaurant_id and id = p_inquiry_id and status in (p_expected_status, p_status);
  if not found then raise exception 'MM_MANAGEMENT_CONFLICT|The lead changed or is unavailable. Refresh before updating.'; end if;
end;
$$;

revoke all on function public.get_managed_catering_settings_v1(text), public.update_managed_catering_settings_v1(text, jsonb),
  public.list_managed_catering_inquiries_v1(text, timestamptz, uuid), public.update_managed_catering_inquiry_v1(text, uuid, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.get_managed_catering_settings_v1(text), public.update_managed_catering_settings_v1(text, jsonb),
  public.list_managed_catering_inquiries_v1(text, timestamptz, uuid), public.update_managed_catering_inquiry_v1(text, uuid, text, text) to authenticated;
revoke all on function public.submit_catering_inquiry_v1(text, uuid, jsonb, text), public.complete_catering_notification_v1(uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.submit_catering_inquiry_v1(text, uuid, jsonb, text), public.complete_catering_notification_v1(uuid, text) to service_role;
commit;
