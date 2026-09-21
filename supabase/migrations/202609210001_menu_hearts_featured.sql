begin;

create table public.menu_item_hearts (
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  item_id uuid not null,
  visitor_key text not null check (visitor_key ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now(),
  primary key (restaurant_id, item_id, visitor_key),
  foreign key (item_id) references public.menu_items(id) on delete cascade
);
create index menu_item_hearts_item_idx on public.menu_item_hearts (restaurant_id, item_id);
alter table public.menu_item_hearts enable row level security;
revoke all on public.menu_item_hearts from public, anon, authenticated;
grant select, insert, delete on public.menu_item_hearts to service_role;

create view public.menu_item_heart_counts with (security_invoker = true) as
select restaurant_id, item_id, count(*)::integer as heart_count
from public.menu_item_hearts group by restaurant_id, item_id;
revoke all on public.menu_item_heart_counts from public, anon, authenticated;
grant select on public.menu_item_heart_counts to service_role;

create table public.restaurant_featured_menu_items (
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  menu_id uuid not null,
  item_id uuid not null,
  sort_order integer not null check (sort_order between 0 and 19),
  primary key (menu_id, item_id),
  unique (menu_id, sort_order),
  foreign key (restaurant_id, menu_id) references public.menus(restaurant_id, id) on delete cascade,
  foreign key (item_id) references public.menu_items(id) on delete cascade
);
alter table public.restaurant_featured_menu_items enable row level security;
revoke all on public.restaurant_featured_menu_items from public, anon, authenticated;
grant select on public.restaurant_featured_menu_items to service_role;

alter table public.restaurant_setting_events drop constraint restaurant_setting_events_action_check;
alter table public.restaurant_setting_events add constraint restaurant_setting_events_action_check
  check (action in ('settings.restaurant_updated', 'settings.ordering_updated', 'settings.hours_updated', 'settings.delivery_updated', 'settings.featured_updated'));

create or replace function public.get_managed_featured_items_v1(p_restaurant_slug text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare access_record record; result jsonb;
begin
  select * into strict access_record from private.require_restaurant_capability_v1(p_restaurant_slug, 'manage_restaurant_settings');
  select jsonb_build_object(
    'items', coalesce((select jsonb_agg(jsonb_build_object('id', item.id, 'name', item.name) order by item.name, item.id)
      from public.menu_items item where
      exists (select 1 from public.menu_section_items placement join public.menu_sections section on section.id = placement.section_id
        join public.menus menu on menu.id = section.menu_id where placement.item_id = item.id and menu.restaurant_id = access_record.restaurant_id and menu.is_published and section.is_active)), '[]'::jsonb),
    'selectedItemIds', coalesce((select jsonb_agg(feature.item_id order by feature.sort_order)
      from public.restaurant_featured_menu_items feature join public.menus menu on menu.id = feature.menu_id
      where feature.restaurant_id = access_record.restaurant_id and menu.is_published), '[]'::jsonb)
  ) into result;
  return result;
end;
$$;

create or replace function public.update_managed_featured_items_v1(p_restaurant_slug text, p_item_ids jsonb, p_client_action_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare access_record record; target_menu_id uuid; previous_state jsonb; next_state jsonb; item_id uuid; position integer := 0;
begin
  select * into strict access_record from private.require_restaurant_capability_v1(p_restaurant_slug, 'manage_restaurant_settings');
  if p_client_action_id is null or p_item_ids is null or jsonb_typeof(p_item_ids) <> 'array' or jsonb_array_length(p_item_ids) > 20
  then raise exception using message = 'MM_MANAGEMENT_INVALID_REQUEST|Select at most 20 featured items.'; end if;
  select menu.id into target_menu_id from public.menus menu where menu.restaurant_id = access_record.restaurant_id and menu.is_published order by menu.id limit 1;
  if target_menu_id is null then raise exception using message = 'MM_MANAGEMENT_INVALID_REQUEST|No published menu exists.'; end if;
  if exists (select 1 from public.restaurant_setting_events event where event.restaurant_id = access_record.restaurant_id and event.client_action_id = p_client_action_id) then
    select event.next_state into next_state from public.restaurant_setting_events event
      where event.restaurant_id = access_record.restaurant_id and event.client_action_id = p_client_action_id and event.action = 'settings.featured_updated';
    if next_state is null then raise exception using message = 'MM_MANAGEMENT_CONFLICT|This action identifier was already used.'; end if;
    return next_state;
  end if;
  previous_state := public.get_managed_featured_items_v1(p_restaurant_slug);
  delete from public.restaurant_featured_menu_items where menu_id = target_menu_id;
  for item_id in select value::text::uuid from jsonb_array_elements_text(p_item_ids) loop
    if not exists (select 1 from public.menu_section_items placement join public.menu_sections section on section.id = placement.section_id
      where placement.item_id = item_id and section.menu_id = target_menu_id and section.is_active)
    then raise exception using message = 'MM_MANAGEMENT_INVALID_REQUEST|A selected item is not on this published menu.'; end if;
    insert into public.restaurant_featured_menu_items (restaurant_id, menu_id, item_id, sort_order)
      values (access_record.restaurant_id, target_menu_id, item_id, position);
    position := position + 1;
  end loop;
  next_state := public.get_managed_featured_items_v1(p_restaurant_slug);
  insert into public.restaurant_setting_events (restaurant_id, actor_user_id, actor_membership_id, client_action_id, action, previous_state, next_state)
    values (access_record.restaurant_id, (select auth.uid()), access_record.membership_id, p_client_action_id, 'settings.featured_updated', previous_state, next_state);
  return next_state;
exception when invalid_text_representation or unique_violation then
  raise exception using message = 'MM_MANAGEMENT_INVALID_REQUEST|Featured items must be unique valid menu item IDs.';
end;
$$;

revoke all on function public.get_managed_featured_items_v1(text) from public, anon, authenticated, service_role;
revoke all on function public.update_managed_featured_items_v1(text, jsonb, uuid) from public, anon, authenticated, service_role;
grant execute on function public.get_managed_featured_items_v1(text) to authenticated;
grant execute on function public.update_managed_featured_items_v1(text, jsonb, uuid) to authenticated;
commit;
