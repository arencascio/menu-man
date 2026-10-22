begin;

create table private.ops_owners (
  user_id uuid primary key references auth.users(id),
  active boolean not null default true,
  require_aal2 boolean not null default true,
  created_at timestamptz not null default now()
);
alter table private.ops_owners enable row level security;
revoke all on private.ops_owners from public, anon, authenticated, service_role;
comment on table private.ops_owners is 'Explicit trusted Auth UUID provisioning only. No self-enrollment or restaurant membership inheritance.';

alter table public.marketing_leads
  add column internal_notes text not null default '' check (char_length(internal_notes) <= 8000),
  add column follow_up_at timestamptz,
  add column last_contacted_at timestamptz,
  add column revision integer not null default 1 check (revision > 0);
create index marketing_leads_open_follow_up_idx on public.marketing_leads(follow_up_at, id)
  where status in ('new','contacted','waiting');

create table private.marketing_lead_activity (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.marketing_leads(id),
  actor_id uuid not null references auth.users(id),
  kind text not null check (kind in ('lead_updated','notification_retry')),
  changes jsonb not null check (jsonb_typeof(changes)='object' and octet_length(changes::text)<=2000),
  created_at timestamptz not null default now()
);
create index marketing_lead_activity_history_idx on private.marketing_lead_activity(lead_id,created_at,id);
alter table private.marketing_lead_activity enable row level security;
revoke all on private.marketing_lead_activity from public, anon, authenticated, service_role;

-- Database authorization does not trust email, user_metadata, restaurant roles,
-- or a client-side gate. A revoked Auth session/owner fails on the next RPC.
create function private.ops_access_v1() returns text
language plpgsql stable security definer set search_path = '' as $$
declare owner_record private.ops_owners%rowtype;
begin
  if auth.uid() is null then return 'denied'; end if;
  if not exists (select 1 from auth.sessions s where s.id::text=auth.jwt()->>'session_id' and s.user_id=auth.uid())
    then return 'denied'; end if;
  select * into owner_record from private.ops_owners where user_id=auth.uid() and active;
  if not found then return 'denied'; end if;
  if owner_record.require_aal2 and coalesce(auth.jwt()->>'aal','') <> 'aal2' then return 'mfa_required'; end if;
  return 'authorized';
end;
$$;
create function private.require_ops_owner_v1() returns uuid
language plpgsql stable security definer set search_path = '' as $$
begin
  if private.ops_access_v1() <> 'authorized' then raise exception 'MM_OPS_DENIED' using errcode='42501'; end if;
  return auth.uid();
end;
$$;
create function public.get_ops_access_v1() returns text
language sql stable security definer set search_path = '' as $$ select private.ops_access_v1(); $$;

create function private.ops_notification_v1(p_item private.marketing_lead_notifications) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('state',p_item.state,'attemptCount',p_item.attempt_count,
    'lastAttemptAt',p_item.last_attempt_at,'nextAttemptAt',p_item.next_attempt_at,
    'acceptedAt',p_item.accepted_at,'errorCode',p_item.error_code,'httpStatus',p_item.last_http_status,
    'providerId',p_item.provider_message_id,'firstAttemptAt',p_item.first_attempt_at,
    'leaseExpiresAt',p_item.lease_expires_at,'hasSender',p_item.sender is not null,
    'retryBlock',case when p_item.state='accepted' then 'accepted' when p_item.state='unknown' then 'unknown'
      when p_item.attempt_count>=5 then 'limit' when p_item.sender is null then 'sender'
      when p_item.first_attempt_at<=now()-interval '23 hours' then 'expired'
      when p_item.state='sending' and p_item.lease_expires_at>now() then 'leased'
      when p_item.next_attempt_at>now() then 'backoff' else null end,
    'retryEligible', p_item.sender is not null and p_item.state in ('queued','retryable','failed','sending')
      and p_item.attempt_count < 5 and p_item.next_attempt_at <= now()
      and (p_item.first_attempt_at is null or p_item.first_attempt_at > now()-interval '23 hours')
      and (p_item.state<>'sending' or p_item.lease_expires_at <= now()));
$$;

create function public.list_ops_leads_v1(p_view text default 'open', p_status text default 'all',
  p_type text default 'all', p_sort text default 'newest', p_page integer default 1)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare result jsonb; counts jsonb;
begin
  perform private.require_ops_owner_v1();
  if p_view is null or p_view not in ('open','all','due','notifications') or p_status is null
    or p_status not in ('all','new','contacted','waiting','won','lost','spam')
    or p_type is null or p_type not in ('all','website','review')
    or p_sort is null or p_sort not in ('newest','oldest','follow_up') or p_page is null or p_page not between 1 and 10000
    then raise exception 'MM_OPS_INVALID'; end if;
  select jsonb_build_object(
    'new',count(*) filter (where l.status='new'),
    'due',count(*) filter (where l.status in ('new','contacted','waiting') and l.follow_up_at<=now()),
    'failed',count(*) filter (where n.state in ('failed','retryable','unknown') or (n.state='sending' and n.lease_expires_at<=now())))
    into counts from public.marketing_leads l join private.marketing_lead_notifications n on n.lead_id=l.id;
  select coalesce(jsonb_agg(item order by ordinal),'[]') into result from (
    select jsonb_build_object('id',l.id,'restaurant',l.details->>'restaurantName','contact',l.details->>'name',
      'type',l.inquiry_type,'createdAt',l.created_at,'status',l.status,'followUpAt',l.follow_up_at,
      'overdue',coalesce(l.status in ('new','contacted','waiting') and l.follow_up_at<=now(),false),
      'notification',private.ops_notification_v1(n)) item,
      row_number() over (order by
        case when p_sort='follow_up' then l.follow_up_at end asc nulls last,
        case when p_sort='oldest' then l.created_at end asc,
        case when p_sort<>'oldest' then l.created_at end desc,l.id desc) ordinal,
      count(*) over() total
    from public.marketing_leads l join private.marketing_lead_notifications n on n.lead_id=l.id
    where (p_view<>'open' or l.status in ('new','contacted','waiting'))
      and (p_view<>'due' or (l.status in ('new','contacted','waiting') and l.follow_up_at<=now()))
      and (p_view<>'notifications' or n.state in ('failed','retryable','unknown') or (n.state='sending' and n.lease_expires_at<=now()))
      and (p_status='all' or l.status=p_status) and (p_type='all' or l.inquiry_type=p_type)
    order by ordinal offset (p_page-1)*25 limit 26
  ) page;
  return jsonb_build_object('summary',counts,'items',result);
end;
$$;

create function public.get_ops_lead_v1(p_lead_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  perform private.require_ops_owner_v1();
  select jsonb_build_object('id',l.id,'submissionId',l.submission_id,'type',l.inquiry_type,'details',l.details,
    'createdAt',l.created_at,'updatedAt',l.updated_at,'sourcePage',l.source_page,'attribution',l.attribution,
    'status',l.status,'notes',l.internal_notes,'followUpAt',l.follow_up_at,'lastContactedAt',l.last_contacted_at,'revision',l.revision,
    'notification',private.ops_notification_v1(n),
    'attempts',(select coalesce(jsonb_agg(jsonb_build_object('number',a.attempt_number,'state',a.state,'httpStatus',a.http_status,
      'errorCode',a.error_code,'startedAt',a.started_at,'completedAt',a.completed_at) order by a.attempt_number desc),'[]')
      from private.marketing_lead_notification_attempts a where a.notification_id=n.id),
    'activity',(select coalesce(jsonb_agg(to_jsonb(history) order by history.created_at desc,history.id desc),'[]') from (
      select a.id,a.kind,a.changes,a.created_at from private.marketing_lead_activity a where a.lead_id=l.id
      order by a.created_at desc,a.id desc limit 50) history)) into result
    from public.marketing_leads l join private.marketing_lead_notifications n on n.lead_id=l.id where l.id=p_lead_id;
  return result;
end;
$$;

create function public.update_ops_lead_v1(p_lead_id uuid,p_revision integer,p_status text,p_notes text,p_follow_up_at timestamptz)
returns void language plpgsql security definer set search_path = '' set lock_timeout = '2s' as $$
declare actor uuid; previous public.marketing_leads%rowtype;
begin
  actor:=private.require_ops_owner_v1();
  if p_revision is null or p_revision<1 or p_status is null or p_status not in ('new','contacted','waiting','won','lost','spam')
    or p_notes is null or char_length(p_notes)>8000
    or (p_follow_up_at is not null and (not isfinite(p_follow_up_at) or p_follow_up_at<'1970-01-01'::timestamptz or p_follow_up_at>'2100-12-31'::timestamptz))
    then raise exception 'MM_OPS_INVALID'; end if;
  select * into previous from public.marketing_leads where id=p_lead_id for update;
  if not found then raise exception 'MM_OPS_NOT_FOUND'; end if;
  if previous.revision<>p_revision then raise exception 'MM_OPS_CONFLICT'; end if;
  if previous.status=p_status and previous.internal_notes=p_notes and previous.follow_up_at is not distinct from p_follow_up_at then return; end if;
  update public.marketing_leads set status=p_status,internal_notes=p_notes,follow_up_at=p_follow_up_at,
    last_contacted_at=case when p_status='contacted' and previous.status<>'contacted' then now() else last_contacted_at end,
    revision=revision+1,updated_at=now() where id=p_lead_id;
  insert into private.marketing_lead_activity(lead_id,actor_id,kind,changes) values(p_lead_id,actor,'lead_updated',jsonb_build_object(
    'previousStatus',previous.status,'status',p_status,'previousFollowUpAt',previous.follow_up_at,'followUpAt',p_follow_up_at,
    'notesChanged',previous.internal_notes<>p_notes,'revision',p_revision+1));
end;
$$;

create function public.claim_ops_lead_notification_v1(p_lead_id uuid) returns jsonb
language plpgsql security definer set search_path = '' set lock_timeout = '2s' as $$
declare actor uuid; item private.marketing_lead_notifications%rowtype; claim jsonb;
begin
  actor:=private.require_ops_owner_v1();
  select * into item from private.marketing_lead_notifications where lead_id=p_lead_id for update;
  if not found or coalesce((private.ops_notification_v1(item)->>'retryEligible')::boolean,false)=false then return null; end if;
  if item.state='failed' then
    update private.marketing_lead_notifications set state='retryable',updated_at=now() where id=item.id;
  end if;
  claim:=public.claim_marketing_lead_notification_v1(p_lead_id);
  if claim is not null then
    insert into private.marketing_lead_activity(lead_id,actor_id,kind,changes)
      values(p_lead_id,actor,'notification_retry',jsonb_build_object('attempt',item.attempt_count+1));
  end if;
  return claim;
end;
$$;
create function public.complete_ops_lead_notification_v1(p_notification_id uuid,p_token uuid,p_state text,p_provider_id text,p_error_code text,p_http_status integer)
returns boolean language plpgsql security definer set search_path = '' set lock_timeout = '2s' as $$
begin
  perform private.require_ops_owner_v1();
  return public.complete_marketing_lead_notification_v1(p_notification_id,p_token,p_state,p_provider_id,p_error_code,p_http_status);
end;
$$;

revoke all on function private.ops_access_v1(),private.require_ops_owner_v1(),private.ops_notification_v1(private.marketing_lead_notifications)
  from public,anon,authenticated,service_role;
revoke all on function public.get_ops_access_v1(),public.list_ops_leads_v1(text,text,text,text,integer),public.get_ops_lead_v1(uuid),
  public.update_ops_lead_v1(uuid,integer,text,text,timestamptz),public.claim_ops_lead_notification_v1(uuid),
  public.complete_ops_lead_notification_v1(uuid,uuid,text,text,text,integer) from public,anon,authenticated,service_role;
grant execute on function public.get_ops_access_v1(),public.list_ops_leads_v1(text,text,text,text,integer),public.get_ops_lead_v1(uuid),
  public.update_ops_lead_v1(uuid,integer,text,text,timestamptz),public.claim_ops_lead_notification_v1(uuid),
  public.complete_ops_lead_notification_v1(uuid,uuid,text,text,text,integer) to authenticated;

commit;
