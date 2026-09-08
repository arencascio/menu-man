-- Apply manually in Supabase before using the image audit/import tools.
-- Keep legacy image_url during rollout so original source data is recoverable.

alter table public.menu_items
  add column if not exists source_image_url text,
  add column if not exists image_path text;

update public.menu_items
set source_image_url = image_url
where source_image_url is null
  and image_url is not null;

-- New image writes should use source_image_url or image_path. Keep image_url
-- readable during rollout, but do not overwrite it with owned Storage paths.

insert into storage.buckets (id, name, public)
values ('restaurant-assets', 'restaurant-assets', true)
on conflict (id) do update set public = excluded.public;

-- Public menu pages need public reads. No public write policy is created;
-- server-side service_role operations bypass Storage object RLS.
drop policy if exists "restaurant assets public read" on storage.objects;
create policy "restaurant assets public read"
on storage.objects for select
to public
using (bucket_id = 'restaurant-assets');

-- Ensure the server role can resolve the bucket and existing table grants in
-- future environments. service_role remains the only writer in this project.
grant usage on schema storage to service_role;
grant select on table storage.buckets to service_role;
grant select, insert, update on table storage.objects to service_role;
