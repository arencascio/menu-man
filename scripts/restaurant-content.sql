-- Apply this migration manually in the Supabase SQL editor.
-- This migration adds restaurant profile content and supports multiple hour
-- intervals per day through sort_order.

alter table public.restaurants
  add column if not exists timezone text,
  add column if not exists logo_url text,
  add column if not exists hero_image_url text,
  add column if not exists tagline text,
  add column if not exists description text,
  add column if not exists phone text,
  add column if not exists address_line1 text,
  add column if not exists city text,
  add column if not exists state text,
  add column if not exists postal_code text,
  add column if not exists latitude numeric,
  add column if not exists longitude numeric,
  add column if not exists doordash_url text,
  add column if not exists pickup_url text,
  add column if not exists google_maps_url text,
  add column if not exists instagram_url text,
  add column if not exists facebook_url text,
  add column if not exists primary_color text,
  add column if not exists accent_color text;

create table if not exists public.restaurant_business_hours (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  day_of_week smallint not null,
  open_time time,
  close_time time,
  is_closed boolean not null default false,
  sort_order integer not null default 0,
  constraint restaurant_business_hours_day_check
    check (day_of_week between 0 and 6),
  constraint restaurant_business_hours_interval_check
    check (
      is_closed
      or (open_time is not null and close_time is not null)
    ),
  constraint restaurant_business_hours_sort_order_check
    check (sort_order >= 0)
);

create unique index if not exists restaurant_business_hours_identity_idx
  on public.restaurant_business_hours (restaurant_id, day_of_week, sort_order);

create index if not exists restaurant_business_hours_restaurant_day_idx
  on public.restaurant_business_hours (restaurant_id, day_of_week, sort_order);

grant usage on schema public to service_role;
grant select on table public.restaurant_business_hours to service_role;
