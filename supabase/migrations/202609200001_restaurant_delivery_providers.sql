-- Tenant-scoped delivery destinations managed through restaurant settings.

begin;

create table if not exists public.restaurant_delivery_providers (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  display_name text not null,
  provider_key text,
  destination_url text not null,
  image_url text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  constraint restaurant_delivery_providers_display_name_check check (
    btrim(display_name) <> '' and char_length(btrim(display_name)) <= 120
  ),
  constraint restaurant_delivery_providers_provider_key_check check (
    provider_key is null or (
      char_length(provider_key) <= 80
      and provider_key ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
    )
  ),
  constraint restaurant_delivery_providers_destination_url_check check (
    char_length(destination_url) <= 2048
    and destination_url ~ '^https?://[^[:space:]]+$'
    and destination_url !~* 'placeholder'
  ),
  constraint restaurant_delivery_providers_image_url_check check (
    image_url is null or (
      char_length(image_url) <= 2048
      and image_url ~ '^https://[^[:space:]]+$'
      and image_url !~* 'placeholder'
    )
  ),
  constraint restaurant_delivery_providers_sort_order_check check (sort_order >= 0),
  constraint restaurant_delivery_providers_restaurant_sort_key unique (restaurant_id, sort_order)
);

create unique index if not exists restaurant_delivery_providers_restaurant_name_key
  on public.restaurant_delivery_providers (restaurant_id, lower(btrim(display_name)));

create unique index if not exists restaurant_delivery_providers_restaurant_provider_key
  on public.restaurant_delivery_providers (restaurant_id, provider_key)
  where provider_key is not null;

create index if not exists restaurant_delivery_providers_restaurant_active_sort_idx
  on public.restaurant_delivery_providers (restaurant_id, is_active, sort_order, id);

alter table public.restaurant_delivery_providers enable row level security;
revoke all on table public.restaurant_delivery_providers from public, anon, authenticated, service_role;
grant select on table public.restaurant_delivery_providers to service_role;

-- Preserve valid legacy DoorDash destinations without deleting or rewriting the
-- historical restaurants.doordash_url value. The new table is the runtime source.
insert into public.restaurant_delivery_providers
  (restaurant_id, display_name, provider_key, destination_url, sort_order, is_active)
select restaurant.id, 'DoorDash', 'doordash', btrim(restaurant.doordash_url), 0, true
from public.restaurants restaurant
where restaurant.doordash_url is not null
  and btrim(restaurant.doordash_url) ~ '^https?://[^[:space:]]+$'
  and btrim(restaurant.doordash_url) !~* 'placeholder'
on conflict do nothing;

alter table public.restaurant_setting_events
  drop constraint if exists restaurant_setting_events_action_check;
alter table public.restaurant_setting_events
  add constraint restaurant_setting_events_action_check check (
    action in (
      'settings.restaurant_updated',
      'settings.ordering_updated',
      'settings.hours_updated',
      'settings.delivery_updated'
    )
  );

create or replace function private.delivery_settings_json_v1(p_restaurant_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'providers', coalesce(
      jsonb_agg(jsonb_build_object(
        'id', provider.id,
        'displayName', provider.display_name,
        'providerKey', provider.provider_key,
        'destinationUrl', provider.destination_url,
        'imageUrl', provider.image_url,
        'sortOrder', provider.sort_order,
        'isActive', provider.is_active
      ) order by provider.sort_order, provider.id),
      '[]'::jsonb
    )
  )
  from public.restaurant_delivery_providers provider
  where provider.restaurant_id = p_restaurant_id;
$$;

create or replace function public.get_managed_delivery_settings_v1(p_restaurant_slug text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare access_record record;
begin
  select * into strict access_record from private.require_restaurant_capability_v1(
    p_restaurant_slug, 'manage_restaurant_settings');
  return private.delivery_settings_json_v1(access_record.restaurant_id);
end;
$$;

create or replace function public.update_managed_delivery_settings_v1(
  p_restaurant_slug text, p_providers jsonb, p_client_action_id uuid
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  access_record record;
  previous_state jsonb;
  next_state jsonb;
  provider_value jsonb;
  provider_id uuid;
  provider_display_name text;
  provider_key_value text;
  provider_destination_url text;
  provider_image_url text;
  provider_sort_order integer;
  provider_is_active boolean;
begin
  select * into strict access_record from private.require_restaurant_capability_v1(
    p_restaurant_slug, 'manage_restaurant_settings');

  if p_client_action_id is null
    or p_providers is null
    or jsonb_typeof(p_providers) <> 'array'
    or jsonb_array_length(p_providers) > 25
  then
    raise exception using message = 'MM_MANAGEMENT_INVALID_REQUEST|Delivery providers are invalid.';
  end if;

  if exists (
    select 1 from public.restaurant_setting_events event
    where event.restaurant_id = access_record.restaurant_id
      and event.client_action_id = p_client_action_id
  ) then
    select event.next_state into next_state
    from public.restaurant_setting_events event
    where event.restaurant_id = access_record.restaurant_id
      and event.client_action_id = p_client_action_id
      and event.action = 'settings.delivery_updated';
    if next_state is null then
      raise exception using message = 'MM_MANAGEMENT_CONFLICT|This action identifier was already used.';
    end if;
    return next_state;
  end if;

  previous_state := private.delivery_settings_json_v1(access_record.restaurant_id);

  begin
    delete from public.restaurant_delivery_providers
    where restaurant_id = access_record.restaurant_id;

    for provider_value in select * from jsonb_array_elements(p_providers) loop
      if jsonb_typeof(provider_value) <> 'object'
        or not (provider_value ?& array[
          'id', 'displayName', 'providerKey', 'destinationUrl', 'imageUrl', 'sortOrder', 'isActive'
        ])
        or (select count(*) from jsonb_object_keys(provider_value)) <> 7
        or jsonb_typeof(provider_value -> 'id') <> 'string'
        or jsonb_typeof(provider_value -> 'displayName') <> 'string'
        or jsonb_typeof(provider_value -> 'providerKey') not in ('string', 'null')
        or jsonb_typeof(provider_value -> 'destinationUrl') <> 'string'
        or jsonb_typeof(provider_value -> 'imageUrl') not in ('string', 'null')
        or jsonb_typeof(provider_value -> 'sortOrder') <> 'number'
        or jsonb_typeof(provider_value -> 'isActive') <> 'boolean'
      then
        raise exception using message = 'MM_MANAGEMENT_INVALID_REQUEST|Delivery provider fields are invalid.';
      end if;

      begin
        provider_id := (provider_value ->> 'id')::uuid;
        provider_sort_order := (provider_value ->> 'sortOrder')::integer;
        provider_is_active := (provider_value ->> 'isActive')::boolean;
      exception when others then
        raise exception using message = 'MM_MANAGEMENT_INVALID_REQUEST|Delivery provider fields are invalid.';
      end;

      provider_display_name := btrim(provider_value ->> 'displayName');
      provider_key_value := nullif(btrim(coalesce(provider_value ->> 'providerKey', '')), '');
      provider_destination_url := btrim(provider_value ->> 'destinationUrl');
      provider_image_url := nullif(btrim(coalesce(provider_value ->> 'imageUrl', '')), '');

      if provider_display_name = '' or char_length(provider_display_name) > 120
        or provider_key_value is not null and (
          char_length(provider_key_value) > 80
          or provider_key_value !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
        )
        or char_length(provider_destination_url) > 2048
        or provider_destination_url !~ '^https?://[^[:space:]]+$'
        or provider_destination_url ~* 'placeholder'
        or provider_image_url is not null and (
          char_length(provider_image_url) > 2048
          or provider_image_url !~ '^https://[^[:space:]]+$'
          or provider_image_url ~* 'placeholder'
        )
        or provider_sort_order < 0
      then
        raise exception using message = 'MM_MANAGEMENT_INVALID_REQUEST|Delivery provider fields are invalid.';
      end if;

      insert into public.restaurant_delivery_providers (
        id, restaurant_id, display_name, provider_key, destination_url,
        image_url, sort_order, is_active
      ) values (
        provider_id, access_record.restaurant_id, provider_display_name,
        provider_key_value, provider_destination_url, provider_image_url,
        provider_sort_order, provider_is_active
      );
    end loop;
  exception
    when unique_violation then
      raise exception using message = 'MM_MANAGEMENT_INVALID_REQUEST|Provider names, keys, and display order must be unique.';
    when check_violation then
      raise exception using message = 'MM_MANAGEMENT_INVALID_REQUEST|Delivery provider fields are invalid.';
  end;

  next_state := private.delivery_settings_json_v1(access_record.restaurant_id);
  insert into public.restaurant_setting_events (
    restaurant_id, actor_user_id, actor_membership_id, client_action_id,
    action, previous_state, next_state
  ) values (
    access_record.restaurant_id, (select auth.uid()), access_record.membership_id,
    p_client_action_id, 'settings.delivery_updated', previous_state, next_state
  );
  return next_state;
end;
$$;

revoke all on function private.delivery_settings_json_v1(uuid) from public, anon, authenticated;
revoke all on function public.get_managed_delivery_settings_v1(text) from public, anon, authenticated, service_role;
revoke all on function public.update_managed_delivery_settings_v1(text, jsonb, uuid) from public, anon, authenticated, service_role;
grant execute on function public.get_managed_delivery_settings_v1(text) to authenticated;
grant execute on function public.update_managed_delivery_settings_v1(text, jsonb, uuid) to authenticated;

commit;
