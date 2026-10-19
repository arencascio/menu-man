-- Owner-requested erasure. No automatic retention period or tenant data changes.
begin;

-- Keep only the random request identity so retries cannot recreate erased PII.
create table public.catering_inquiry_deletions (
  restaurant_id uuid not null references public.restaurants(id) on delete restrict,
  submission_id uuid not null,
  deleted_at timestamptz not null default now(),
  primary key (restaurant_id, submission_id)
);
alter table public.catering_inquiry_deletions enable row level security;
revoke all on public.catering_inquiry_deletions from public, anon, authenticated, service_role;

create function private.reject_deleted_catering_submission_v1()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.catering_inquiry_deletions
    where restaurant_id = new.restaurant_id and submission_id = new.submission_id) then
    raise exception 'MM_CATERING_DELETED';
  end if;
  return new;
end;
$$;
revoke all on function private.reject_deleted_catering_submission_v1() from public, anon, authenticated, service_role;
create trigger reject_deleted_catering_submission
before insert on public.catering_inquiries
for each row execute function private.reject_deleted_catering_submission_v1();

create function public.delete_managed_catering_inquiry_v1(p_restaurant_slug text, p_inquiry_id uuid, p_expected_status text)
returns void language plpgsql security definer set search_path = '' set lock_timeout = '2s' as $$
declare access_record record; lead public.catering_inquiries%rowtype;
begin
  select * into strict access_record from private.require_restaurant_capability_v1(p_restaurant_slug, 'manage_catering');
  if access_record.member_role <> 'owner' then
    raise exception 'MM_MANAGEMENT_FORBIDDEN|Only restaurant owners can delete inquiries.';
  end if;
  if p_inquiry_id is null or p_expected_status is null or p_expected_status not in ('new', 'contacted', 'closed') then
    raise exception 'MM_MANAGEMENT_INVALID_REQUEST|Invalid deletion request.';
  end if;
  -- Same lock as submission: deletion and exact retries cannot race resurrection.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('catering:' || access_record.restaurant_id::text, 0));
  select * into lead from public.catering_inquiries
    where restaurant_id = access_record.restaurant_id and id = p_inquiry_id and status = p_expected_status
    for update;
  if not found then
    raise exception 'MM_MANAGEMENT_CONFLICT|The inquiry changed or is unavailable. Refresh before deleting.';
  end if;
  insert into public.catering_inquiry_deletions (restaurant_id, submission_id)
    values (access_record.restaurant_id, lead.submission_id);
  delete from public.catering_inquiries
    where restaurant_id = access_record.restaurant_id and id = lead.id;
end;
$$;
revoke all on function public.delete_managed_catering_inquiry_v1(text, uuid, text) from public, anon, authenticated, service_role;
grant execute on function public.delete_managed_catering_inquiry_v1(text, uuid, text) to authenticated;

commit;
