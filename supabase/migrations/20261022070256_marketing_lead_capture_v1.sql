begin;

-- Independent of restaurant, commerce, Auth membership, and existing outboxes.
create schema if not exists private;

create table public.marketing_leads (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null unique,
  inquiry_type text not null check (inquiry_type in ('website', 'review')),
  details jsonb not null check (jsonb_typeof(details) = 'object' and octet_length(details::text) <= 20000),
  payload_fingerprint text not null check (payload_fingerprint ~ '^[0-9a-f]{64}$'),
  source_page text check (source_page in ('/', '/services', '/work', '/build-my-website')),
  attribution jsonb not null default '{}' check (jsonb_typeof(attribution) = 'object' and octet_length(attribution::text) <= 1000),
  status text not null default 'new' check (status in ('new', 'contacted', 'waiting', 'won', 'lost', 'spam')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on column public.marketing_leads.details is 'Immutable normalized form details, stored once. No honeypot, raw referrer, or analytics identity.';
comment on column public.marketing_leads.created_at is 'Server submission timestamp; browser timestamps are not trusted.';
create index marketing_leads_status_created_idx on public.marketing_leads(status, created_at, id);

create table private.marketing_lead_notifications (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null unique references public.marketing_leads(id),
  template_version integer not null default 1 check (template_version = 1),
  sender text check (char_length(sender) between 1 and 320 and sender !~ E'[\r\n]'),
  delivery_key text not null unique,
  state text not null default 'queued' check (state in ('queued', 'sending', 'accepted', 'retryable', 'failed', 'unknown')),
  attempt_count integer not null default 0 check (attempt_count between 0 and 5),
  claim_token uuid,
  lease_expires_at timestamptz,
  first_attempt_at timestamptz,
  last_attempt_at timestamptz,
  next_attempt_at timestamptz not null default now(),
  provider_message_id text check (provider_message_id ~ '^[a-zA-Z0-9_-]{1,200}$'),
  error_code text check (error_code in ('configuration_missing', 'provider_rejected', 'provider_unavailable', 'unconfirmed', 'lease_expired', 'retry_window_expired', 'attempt_limit')),
  last_http_status integer check (last_http_status between 100 and 599),
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((state = 'sending') = (claim_token is not null and lease_expires_at is not null)),
  check (state <> 'accepted' or (provider_message_id is not null and accepted_at is not null))
);
create index marketing_lead_notifications_due_idx on private.marketing_lead_notifications(next_attempt_at, id)
  where state in ('queued', 'retryable', 'sending');

create table private.marketing_lead_notification_attempts (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references private.marketing_lead_notifications(id),
  attempt_number integer not null check (attempt_number between 1 and 5),
  claim_token uuid not null unique,
  state text not null check (state in ('sending', 'accepted', 'retryable', 'failed', 'unknown')),
  http_status integer check (http_status between 100 and 599),
  error_code text check (error_code in ('configuration_missing', 'provider_rejected', 'provider_unavailable', 'unconfirmed', 'lease_expired')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (notification_id, attempt_number)
);

alter table public.marketing_leads enable row level security;
alter table private.marketing_lead_notifications enable row level security;
alter table private.marketing_lead_notification_attempts enable row level security;
-- No client policies, even for authenticated restaurant owners. Only the bounded
-- service RPCs below have write access. Do not alter shared schema privileges.
revoke all on public.marketing_leads, private.marketing_lead_notifications,
  private.marketing_lead_notification_attempts from public, anon, authenticated, service_role;

create function public.record_marketing_lead_v1(p_submission_id uuid, p_type text, p_details jsonb, p_context jsonb, p_from text)
returns uuid language plpgsql security definer set search_path = '' set lock_timeout = '2s' as $$
declare
  lead public.marketing_leads%rowtype;
  fingerprint text;
  key text;
  bound integer;
begin
  if p_submission_id is null or p_type is null or p_type not in ('website', 'review')
    or p_details is null or jsonb_typeof(p_details) <> 'object'
    or p_context is null or jsonb_typeof(p_context) <> 'object'
    or octet_length(p_details::text) > 20000
    or exists (select 1 from jsonb_object_keys(p_details) k where k not in
      ('restaurantName','email','name','phone','city','website','noWebsite','onlineOrdering','orderingProviders','help','notes'))
  then raise exception 'MM_LEAD_INVALID'; end if;
  foreach key in array array['restaurantName','email','name','phone','city','website','onlineOrdering','orderingProviders','help','notes'] loop
    bound := case key when 'email' then 254 when 'phone' then 50 when 'website' then 500
      when 'orderingProviders' then 300 when 'notes' then 2000 else 160 end;
    if jsonb_typeof(p_details->key) is distinct from 'string' or char_length(p_details->>key) > bound then
      raise exception 'MM_LEAD_INVALID';
    end if;
  end loop;
  if char_length(btrim(p_details->>'restaurantName')) < 1
    or p_details->>'email' !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    or jsonb_typeof(p_details->'noWebsite') is distinct from 'boolean'
    or p_details->>'onlineOrdering' not in ('','yes','no','unsure')
    or (p_type = 'website' and p_details->>'help' = '')
    or (p_type = 'review' and p_details->>'noWebsite' = 'false' and p_details->>'website' = '')
    or exists (select 1 from jsonb_object_keys(p_context) k where k not in ('sourcePage','attribution'))
    or (p_context ? 'sourcePage' and (jsonb_typeof(p_context->'sourcePage') is distinct from 'string'
      or p_context->>'sourcePage' not in ('/','/services','/work','/build-my-website')))
    or jsonb_typeof(p_context->'attribution') is distinct from 'object'
    or octet_length(p_context::text) > 1200
    or (p_from is not null and (char_length(p_from) not between 1 and 320 or p_from ~ E'[\r\n]'))
  then raise exception 'MM_LEAD_INVALID'; end if;
  for key in select jsonb_object_keys(p_context->'attribution') loop
    if key not in ('utm_source','utm_medium','utm_campaign','utm_content','referrer')
      or jsonb_typeof(p_context->'attribution'->key) is distinct from 'string'
      or (key <> 'referrer' and p_context->'attribution'->>key !~ '^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$')
      or (key = 'referrer' and p_context->'attribution'->>key not in ('direct','internal','search','social','other'))
    then raise exception 'MM_LEAD_INVALID'; end if;
  end loop;
  fingerprint := encode(sha256(convert_to(jsonb_build_object('type',p_type,'details',p_details)::text,'UTF8')), 'hex');
  insert into public.marketing_leads(submission_id,inquiry_type,details,payload_fingerprint,source_page,attribution)
    values (p_submission_id,p_type,p_details,fingerprint,p_context->>'sourcePage',p_context->'attribution')
    on conflict (submission_id) do nothing;
  select * into strict lead from public.marketing_leads where submission_id = p_submission_id for update;
  if lead.payload_fingerprint <> fingerprint then raise exception 'MM_LEAD_CONFLICT'; end if;
  -- Attribution/sender on the first committed submission win; retries cannot edit
  -- stored contact data, alter the send payload, or create another outbox item.
  insert into private.marketing_lead_notifications(lead_id,sender,delivery_key)
    values (lead.id,p_from,'marketing-lead/' || p_submission_id::text)
    on conflict (lead_id) do nothing;
  return lead.id;
end;
$$;

create function public.claim_marketing_lead_notification_v1(p_lead_id uuid)
returns jsonb language plpgsql security definer set search_path = '' set lock_timeout = '2s' as $$
declare
  item private.marketing_lead_notifications%rowtype;
  lead public.marketing_leads%rowtype;
  token uuid := gen_random_uuid();
begin
  select * into item from private.marketing_lead_notifications where lead_id = p_lead_id for update;
  if not found or item.state in ('accepted','failed','unknown') then return null; end if;
  if (item.state = 'sending' and item.lease_expires_at > now()) or item.next_attempt_at > now() then return null; end if;
  if item.state = 'sending' then
    update private.marketing_lead_notification_attempts set state='unknown',error_code='lease_expired',completed_at=now()
      where claim_token=item.claim_token and state='sending';
  end if;
  -- Stay conservatively inside Resend's 24h key window, including network delays.
  if item.first_attempt_at <= now() - interval '23 hours' or item.attempt_count >= 5 then
    update private.marketing_lead_notifications set state='unknown',claim_token=null,lease_expires_at=null,
      error_code=case when item.attempt_count >= 5 then 'attempt_limit' else 'retry_window_expired' end,updated_at=now() where id=item.id;
    return null;
  end if;
  select * into strict lead from public.marketing_leads where id=p_lead_id;
  update private.marketing_lead_notifications set state='sending',claim_token=token,lease_expires_at=now()+interval '2 minutes',
    first_attempt_at=coalesce(first_attempt_at,now()),last_attempt_at=now(),attempt_count=attempt_count+1,updated_at=now()
    where id=item.id;
  insert into private.marketing_lead_notification_attempts(notification_id,attempt_number,claim_token,state)
    values(item.id,item.attempt_count+1,token,'sending');
  return jsonb_build_object('notificationId',item.id,'token',token,'from',item.sender,
    'lead',lead.details || jsonb_build_object('type',lead.inquiry_type,'submissionId',lead.submission_id));
end;
$$;

create function public.complete_marketing_lead_notification_v1(p_notification_id uuid, p_token uuid,
  p_state text, p_provider_id text, p_error_code text, p_http_status integer)
returns boolean language plpgsql security definer set search_path = '' set lock_timeout = '2s' as $$
declare item private.marketing_lead_notifications%rowtype;
begin
  if p_state is null or p_state not in ('accepted','retryable','failed')
    or (p_state='accepted' and (p_provider_id is null or p_provider_id !~ '^[a-zA-Z0-9_-]{1,200}$' or p_error_code is not null))
    or (p_state<>'accepted' and (p_provider_id is not null or p_error_code is null
      or p_error_code not in ('configuration_missing','provider_rejected','provider_unavailable','unconfirmed')))
    or (p_http_status is not null and p_http_status not between 100 and 599)
  then raise exception 'MM_LEAD_NOTIFICATION_INVALID'; end if;
  select * into item from private.marketing_lead_notifications where id=p_notification_id for update;
  if not found or item.state <> 'sending' or item.claim_token is distinct from p_token then return false; end if;
  update private.marketing_lead_notification_attempts set state=p_state,http_status=p_http_status,error_code=p_error_code,completed_at=now()
    where claim_token=p_token;
  update private.marketing_lead_notifications set state=p_state,provider_message_id=p_provider_id,error_code=p_error_code,
    last_http_status=p_http_status,claim_token=null,lease_expires_at=null,updated_at=now(),
    accepted_at=case when p_state='accepted' then now() else null end,
    next_attempt_at=now()+make_interval(secs => least(3600,60*power(2,item.attempt_count-1)::integer)) where id=item.id;
  update public.marketing_leads set updated_at=now() where id=item.lead_id;
  return true;
end;
$$;

revoke all on function public.record_marketing_lead_v1(uuid,text,jsonb,jsonb,text),
  public.claim_marketing_lead_notification_v1(uuid),
  public.complete_marketing_lead_notification_v1(uuid,uuid,text,text,text,integer) from public, anon, authenticated, service_role;
grant execute on function public.record_marketing_lead_v1(uuid,text,jsonb,jsonb,text),
  public.claim_marketing_lead_notification_v1(uuid),
  public.complete_marketing_lead_notification_v1(uuid,uuid,text,text,text,integer) to service_role;

commit;
