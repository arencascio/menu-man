-- External source identity and Menu Man-owned image storage.

begin;

alter table public.menu_items
  add column restaurant_id uuid references public.restaurants(id),
  add column source_system text,
  add column source_item_id text,
  add column source_image_url text,
  add column image_path text,
  add constraint menu_items_source_identity_check check (
    (source_system is null and source_item_id is null)
    or (restaurant_id is not null and source_system is not null and source_item_id is not null)
  );

update public.menu_items
set source_image_url = image_url
where source_image_url is null
  and image_url is not null;

create unique index menu_items_restaurant_source_identity_idx
  on public.menu_items (restaurant_id, source_system, source_item_id)
  where restaurant_id is not null
    and source_system is not null
    and source_item_id is not null;

create index menu_items_restaurant_idx
  on public.menu_items (restaurant_id, id);

insert into storage.buckets (id, name, public)
values ('restaurant-assets', 'restaurant-assets', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "restaurant assets public read" on storage.objects;
create policy "restaurant assets public read"
on storage.objects for select
to public
using (bucket_id = 'restaurant-assets');

grant usage on schema storage to service_role;
grant select on table storage.buckets to service_role;
grant select, insert, update on table storage.objects to service_role;

commit;
