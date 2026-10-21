-- LOCAL ONLY. Synthetic 15-table Production-shaped baseline for Gate A.4.
-- This is a test fixture, not a migration and not a copy of Production data.
create table public.restaurants (
  id uuid primary key, slug text not null unique, name text not null,
  currency text not null default 'USD', is_active boolean not null default true,
  tagline text, description text, logo_url text, hero_image_url text,
  phone text, address_line1 text, city text, state text, postal_code text,
  timezone text, theme_preset text not null default 'classic-red',
  theme_overrides jsonb not null default '{}'::jsonb, primary_domain text,
  pickup_url text, doordash_url text, google_maps_url text,
  instagram_url text, facebook_url text, latitude numeric, longitude numeric,
  constraint restaurants_slug_check check (slug=lower(slug) and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);
create table public.menus (
  id uuid primary key, restaurant_id uuid not null references public.restaurants(id),
  name text not null, is_published boolean not null default false,
  unique(restaurant_id,name), unique(restaurant_id,id)
);
create table public.menu_sections (
  id uuid primary key, menu_id uuid not null references public.menus(id),
  name text not null, description text, sort_order integer not null default 0,
  is_active boolean not null default true, unique(menu_id,name)
);
create table public.menu_items (
  id uuid primary key, restaurant_id uuid not null references public.restaurants(id),
  name text not null, description text, price_cents integer not null check(price_cents>=0),
  is_active boolean not null default true, is_orderable boolean not null default false,
  source_system text, source_item_id text, image_url text, source_image_url text,
  image_path text, unique(restaurant_id,id)
);
create unique index menu_items_restaurant_source_identity_idx on public.menu_items
  (restaurant_id,source_system,source_item_id) where source_system is not null;
create table public.menu_section_items (
  section_id uuid not null references public.menu_sections(id),
  item_id uuid not null references public.menu_items(id),
  sort_order integer not null default 0, primary key(section_id,item_id)
);
create table public.modifier_groups (
  id uuid primary key, restaurant_id uuid not null references public.restaurants(id),
  name text not null, is_active boolean not null default true,
  unique(restaurant_id,id)
);
create table public.modifier_options (
  id uuid primary key, restaurant_id uuid not null,
  modifier_group_id uuid not null, name text not null,
  default_price_adjustment_cents integer not null default 0 check(default_price_adjustment_cents>=0),
  sort_order integer not null default 0, is_active boolean not null default true,
  is_default boolean not null default false,
  foreign key(restaurant_id,modifier_group_id) references public.modifier_groups(restaurant_id,id),
  unique(restaurant_id,modifier_group_id,id)
);
create table public.menu_item_modifier_groups (
  restaurant_id uuid not null, menu_item_id uuid not null,
  modifier_group_id uuid not null, min_selections smallint not null default 0,
  max_selections smallint not null default 1, sort_order integer not null default 0,
  is_active boolean not null default true, primary key(menu_item_id,modifier_group_id),
  foreign key(restaurant_id,menu_item_id) references public.menu_items(restaurant_id,id),
  foreign key(restaurant_id,modifier_group_id) references public.modifier_groups(restaurant_id,id),
  check(min_selections>=0 and max_selections>=1 and min_selections<=max_selections)
);
create table public.menu_item_modifier_option_overrides (
  restaurant_id uuid not null, menu_item_id uuid not null,
  modifier_group_id uuid not null, modifier_option_id uuid not null,
  price_adjustment_cents integer, sort_order integer,
  is_active boolean not null default true, primary key(menu_item_id,modifier_option_id),
  foreign key(restaurant_id,menu_item_id) references public.menu_items(restaurant_id,id),
  foreign key(restaurant_id,modifier_group_id,modifier_option_id)
    references public.modifier_options(restaurant_id,modifier_group_id,id)
);
create table public.orders (
  id uuid primary key, restaurant_id uuid not null references public.restaurants(id),
  menu_id uuid not null references public.menus(id), order_number bigint,
  idempotency_key text not null, order_status text not null default 'pending_payment',
  payment_status text not null default 'unpaid', customer_name text not null,
  customer_phone text, customer_email text, special_instructions text,
  pickup_mode text not null, pickup_at timestamptz, currency text not null,
  subtotal_cents integer not null, tax_cents integer not null default 0,
  tip_cents integer not null default 0, total_cents integer not null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(restaurant_id,id)
);
create table public.order_items (
  id uuid primary key, restaurant_id uuid not null, order_id uuid not null,
  menu_item_id uuid not null, sort_order integer not null default 0,
  item_name text not null, base_price_cents integer not null,
  modifier_price_cents integer not null default 0, unit_price_cents integer not null,
  quantity integer not null, line_total_cents integer not null,
  special_instructions text, created_at timestamptz not null default now(),
  foreign key(restaurant_id,order_id) references public.orders(restaurant_id,id),
  foreign key(restaurant_id,menu_item_id) references public.menu_items(restaurant_id,id),
  unique(restaurant_id,id)
);
create table public.order_item_modifiers (
  id uuid primary key, restaurant_id uuid not null, order_item_id uuid not null,
  modifier_group_id uuid not null, modifier_option_id uuid not null,
  sort_order integer not null default 0, modifier_group_name text not null,
  modifier_option_name text not null, price_adjustment_cents integer not null,
  created_at timestamptz not null default now(),
  foreign key(restaurant_id,order_item_id) references public.order_items(restaurant_id,id),
  foreign key(restaurant_id,modifier_group_id,modifier_option_id)
    references public.modifier_options(restaurant_id,modifier_group_id,id)
);
create table public.restaurant_business_hours (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id),
  day_of_week smallint not null check(day_of_week between 0 and 6),
  open_time time, close_time time, is_closed boolean not null default false,
  sort_order integer not null default 0,
  unique(restaurant_id,day_of_week,sort_order)
);
create table public.restaurant_ordering_settings (
  restaurant_id uuid primary key references public.restaurants(id),
  pickup_enabled boolean not null default false,
  asap_enabled boolean not null default false,
  scheduled_pickup_enabled boolean not null default false,
  tax_strategy text not null check(tax_strategy in ('provider','restaurant_percentage')),
  tax_rate_basis_points integer,
  check(pickup_enabled or (not asap_enabled and not scheduled_pickup_enabled))
);
create table public.restaurant_order_counters (
  restaurant_id uuid primary key references public.restaurants(id),
  last_order_number bigint not null default 1000,
  updated_at timestamptz not null default now()
);
create index menu_sections_menu_active_sort_idx on public.menu_sections(menu_id,is_active,sort_order,id);
create index menu_section_items_section_sort_idx on public.menu_section_items(section_id,sort_order,item_id);
create index modifier_options_group_active_sort_idx on public.modifier_options(modifier_group_id,is_active,sort_order,id);
insert into public.restaurants(id,slug,name) values
  ('10000000-0000-4000-8000-000000000001','armandos','Synthetic Armando');
insert into public.menus(id,restaurant_id,name,is_published) values
  ('10000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','Synthetic Menu',true);
insert into public.menu_sections(id,menu_id,name) values
  ('10000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000002','Synthetic Section');
insert into public.menu_items(id,restaurant_id,name,price_cents,is_orderable) values
  ('10000000-0000-4000-8000-000000000004','10000000-0000-4000-8000-000000000001','Synthetic Item',100,true);
insert into public.menu_section_items(section_id,item_id) values
  ('10000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000004');
insert into public.restaurant_ordering_settings(restaurant_id,pickup_enabled,asap_enabled,tax_strategy,tax_rate_basis_points) values
  ('10000000-0000-4000-8000-000000000001',true,true,'restaurant_percentage',800);
