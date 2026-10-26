-- A row lock does not refresh a REPEATABLE READ snapshot. Conditional
-- attachment writes therefore require READ COMMITTED visibility. PostgreSQL
-- implements READ UNCOMMITTED with the same visibility as READ COMMITTED.
begin;

-- Wait for existing attachment writers before inspecting the committed graph
-- and replacing its validator. Do not silently grandfather invalid hierarchies.
lock table public.menu_item_modifier_groups in share row exclusive mode;

do $$
begin
  if pg_catalog.current_setting('transaction_isolation') not in
    ('read committed', 'read uncommitted') then
    raise exception using errcode = '0A000',
      message = 'MM_MODIFIER_WRITE_ISOLATION|Apply this migration in a READ COMMITTED transaction.';
  end if;
  if exists (
    select 1
    from public.menu_item_modifier_groups child
    left join public.menu_item_modifier_groups parent
      on parent.restaurant_id = child.restaurant_id
      and parent.menu_item_id = child.menu_item_id
      and parent.modifier_group_id = child.parent_modifier_group_id
    where child.parent_modifier_group_id is not null
      and (parent.modifier_group_id is null or parent.parent_modifier_group_id is not null)
  ) then
    raise exception using errcode = '23514',
      message = 'MM_INVALID_MODIFIER_HIERARCHY|Repair existing modifier hierarchies before applying the isolation guard.';
  end if;
end;
$$;

create or replace function private.enforce_modifier_depth_v1()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  -- Check BEFORE waiting for the item lock. Acquiring a lock cannot make an
  -- older transaction snapshot safe. Flat/root writes do not add graph edges.
  if new.parent_modifier_group_id is not null
    and pg_catalog.current_setting('transaction_isolation') not in
      ('read committed', 'read uncommitted') then
    raise exception using errcode = '0A000',
      message = 'MM_MODIFIER_WRITE_ISOLATION|Conditional modifier attachment writes require READ COMMITTED.',
      hint = 'Start a new READ COMMITTED transaction; do not retry within the old snapshot.';
  end if;

  -- Keep the existing per-item serialization and fresh-snapshot validation.
  perform 1 from public.menu_items where id = new.menu_item_id
    and restaurant_id = new.restaurant_id for update;
  if new.parent_modifier_group_id is not null then
    if not exists (
      select 1 from public.menu_item_modifier_groups parent
      where parent.restaurant_id = new.restaurant_id and parent.menu_item_id = new.menu_item_id
        and parent.modifier_group_id = new.parent_modifier_group_id
        and parent.parent_modifier_group_id is null
    ) or exists (
      select 1 from public.menu_item_modifier_groups child
      where child.restaurant_id = new.restaurant_id and child.menu_item_id = new.menu_item_id
        and child.parent_modifier_group_id = new.modifier_group_id
    ) then
      raise exception 'Conditional modifiers support exactly one level of nesting.';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function private.enforce_modifier_depth_v1() from public, anon, authenticated, service_role;
commit;
