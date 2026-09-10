-- Foundational restaurant and menu catalog schema. This migration is the
-- missing baseline that the historical scripts under scripts/ assume exists.

begin;

create table public.restaurants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null,
  currency text not null default 'USD',
  is_active boolean not null default true,
  constraint restaurants_name_check check (btrim(name) <> ''),
  constraint restaurants_slug_check check (
    slug = lower(slug)
    and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
  ),
  constraint restaurants_currency_check check (currency ~ '^[A-Z]{3}$'),
  constraint restaurants_slug_key unique (slug)
);

create table public.menus (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  name text not null,
  is_published boolean not null default false,
  constraint menus_name_check check (btrim(name) <> ''),
  constraint menus_restaurant_name_key unique (restaurant_id, name)
);

create index menus_restaurant_published_idx
  on public.menus (restaurant_id, is_published, id);

create table public.menu_sections (
  id uuid primary key default gen_random_uuid(),
  menu_id uuid not null references public.menus(id) on delete cascade,
  name text not null,
  description text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  constraint menu_sections_name_check check (btrim(name) <> ''),
  constraint menu_sections_sort_order_check check (sort_order >= 0),
  constraint menu_sections_menu_name_key unique (menu_id, name)
);

create index menu_sections_menu_active_sort_idx
  on public.menu_sections (menu_id, is_active, sort_order, id);

create table public.menu_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  price_cents integer not null,
  image_url text,
  constraint menu_items_name_check check (btrim(name) <> ''),
  constraint menu_items_price_check check (price_cents >= 0)
);

create table public.menu_section_items (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references public.menu_sections(id) on delete cascade,
  item_id uuid not null references public.menu_items(id) on delete cascade,
  sort_order integer not null default 0,
  constraint menu_section_items_sort_order_check check (sort_order >= 0),
  constraint menu_section_items_section_item_key unique (section_id, item_id)
);

create index menu_section_items_section_sort_idx
  on public.menu_section_items (section_id, sort_order, id);

create index menu_section_items_item_idx
  on public.menu_section_items (item_id, section_id);

alter table public.restaurants enable row level security;
alter table public.menus enable row level security;
alter table public.menu_sections enable row level security;
alter table public.menu_items enable row level security;
alter table public.menu_section_items enable row level security;

revoke all on table public.restaurants from anon, authenticated;
revoke all on table public.menus from anon, authenticated;
revoke all on table public.menu_sections from anon, authenticated;
revoke all on table public.menu_items from anon, authenticated;
revoke all on table public.menu_section_items from anon, authenticated;

grant usage on schema public to service_role;
grant select on table public.restaurants to service_role;
grant select, insert, update on table
  public.menus,
  public.menu_sections,
  public.menu_items,
  public.menu_section_items
to service_role;

commit;
