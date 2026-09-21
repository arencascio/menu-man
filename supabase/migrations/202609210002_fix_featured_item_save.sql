begin;

-- The update RPC reads this function again after writing selections. A fresh
-- snapshot is required for its returned state and audit event to include them.
alter function public.get_managed_featured_items_v1(text) volatile;

create or replace function public.update_managed_featured_items_v1(p_restaurant_slug text, p_item_ids jsonb, p_client_action_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  access_record record;
  target_menu_id uuid;
  previous_state jsonb;
  next_state jsonb;
  selected_item_id uuid;
  position integer := 0;
begin
  select * into strict access_record from private.require_restaurant_capability_v1(p_restaurant_slug, 'manage_restaurant_settings');
  if p_client_action_id is null or p_item_ids is null or jsonb_typeof(p_item_ids) <> 'array' or jsonb_array_length(p_item_ids) > 20
  then raise exception using message = 'MM_MANAGEMENT_INVALID_REQUEST|Select at most 20 featured items.'; end if;
  select menu.id into target_menu_id from public.menus menu
    where menu.restaurant_id = access_record.restaurant_id and menu.is_published order by menu.id limit 1;
  if target_menu_id is null then raise exception using message = 'MM_MANAGEMENT_INVALID_REQUEST|No published menu exists.'; end if;
  if exists (select 1 from public.restaurant_setting_events event where event.restaurant_id = access_record.restaurant_id and event.client_action_id = p_client_action_id) then
    select event.next_state into next_state from public.restaurant_setting_events event
      where event.restaurant_id = access_record.restaurant_id and event.client_action_id = p_client_action_id and event.action = 'settings.featured_updated';
    if next_state is null then raise exception using message = 'MM_MANAGEMENT_CONFLICT|This action identifier was already used.'; end if;
    return next_state;
  end if;
  previous_state := public.get_managed_featured_items_v1(p_restaurant_slug);
  delete from public.restaurant_featured_menu_items where menu_id = target_menu_id;
  for selected_item_id in select value::uuid from jsonb_array_elements_text(p_item_ids) loop
    if not exists (
      select 1 from public.menu_section_items placement
      join public.menu_sections section on section.id = placement.section_id
      where placement.item_id = selected_item_id and section.menu_id = target_menu_id and section.is_active
    ) then raise exception using message = 'MM_MANAGEMENT_INVALID_REQUEST|A selected item is not on this published menu.'; end if;
    insert into public.restaurant_featured_menu_items (restaurant_id, menu_id, item_id, sort_order)
      values (access_record.restaurant_id, target_menu_id, selected_item_id, position);
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

revoke all on function public.update_managed_featured_items_v1(text, jsonb, uuid) from public, anon, authenticated, service_role;
grant execute on function public.update_managed_featured_items_v1(text, jsonb, uuid) to authenticated;

commit;
