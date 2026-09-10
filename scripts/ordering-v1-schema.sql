-- Apply manually in Supabase before deploying the Ordering v1 application code.
-- This migration creates reusable modifiers and the server-only order foundation.

begin;

alter table public.menu_items
  add column if not exists is_orderable boolean not null default false;

create unique index if not exists menus_restaurant_id_id_idx
  on public.menus (restaurant_id, id);

create unique index if not exists menu_items_restaurant_id_id_idx
  on public.menu_items (restaurant_id, id);

create table if not exists public.modifier_groups (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  name text not null,
  description text,
  source_system text,
  source_group_id text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint modifier_groups_name_check check (btrim(name) <> ''),
  constraint modifier_groups_source_identity_check check (
    (source_system is null and source_group_id is null)
    or (source_system is not null and source_group_id is not null)
  ),
  constraint modifier_groups_restaurant_id_id_key unique (restaurant_id, id)
);

create unique index if not exists modifier_groups_source_identity_idx
  on public.modifier_groups (restaurant_id, source_system, source_group_id)
  where source_system is not null and source_group_id is not null;

create index if not exists modifier_groups_restaurant_active_idx
  on public.modifier_groups (restaurant_id, is_active, name, id);

create table if not exists public.modifier_options (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null,
  modifier_group_id uuid not null,
  name text not null,
  default_price_adjustment_cents integer not null default 0,
  sort_order integer not null default 0,
  source_system text,
  source_option_id text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint modifier_options_group_fkey
    foreign key (restaurant_id, modifier_group_id)
    references public.modifier_groups (restaurant_id, id)
    on delete cascade,
  constraint modifier_options_name_check check (btrim(name) <> ''),
  constraint modifier_options_default_price_check check (default_price_adjustment_cents >= 0),
  constraint modifier_options_sort_order_check check (sort_order >= 0),
  constraint modifier_options_source_identity_check check (
    (source_system is null and source_option_id is null)
    or (source_system is not null and source_option_id is not null)
  ),
  constraint modifier_options_restaurant_id_id_key unique (restaurant_id, id),
  constraint modifier_options_restaurant_group_id_id_key unique (restaurant_id, modifier_group_id, id)
);

create unique index if not exists modifier_options_source_identity_idx
  on public.modifier_options (modifier_group_id, source_system, source_option_id)
  where source_system is not null and source_option_id is not null;

create index if not exists modifier_options_group_active_sort_idx
  on public.modifier_options (modifier_group_id, is_active, sort_order, id);

create table if not exists public.menu_item_modifier_groups (
  restaurant_id uuid not null,
  menu_item_id uuid not null,
  modifier_group_id uuid not null,
  min_selections smallint not null default 0,
  max_selections smallint not null default 1,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (menu_item_id, modifier_group_id),
  constraint menu_item_modifier_groups_item_fkey
    foreign key (restaurant_id, menu_item_id)
    references public.menu_items (restaurant_id, id)
    on delete cascade,
  constraint menu_item_modifier_groups_group_fkey
    foreign key (restaurant_id, modifier_group_id)
    references public.modifier_groups (restaurant_id, id)
    on delete cascade,
  constraint menu_item_modifier_groups_min_check check (min_selections >= 0),
  constraint menu_item_modifier_groups_max_check check (max_selections >= 1),
  constraint menu_item_modifier_groups_range_check check (min_selections <= max_selections),
  constraint menu_item_modifier_groups_sort_order_check check (sort_order >= 0),
  constraint menu_item_modifier_groups_restaurant_item_group_key
    unique (restaurant_id, menu_item_id, modifier_group_id)
);

create index if not exists menu_item_modifier_groups_item_active_sort_idx
  on public.menu_item_modifier_groups (menu_item_id, is_active, sort_order, modifier_group_id);

create table if not exists public.menu_item_modifier_option_overrides (
  restaurant_id uuid not null,
  menu_item_id uuid not null,
  modifier_group_id uuid not null,
  modifier_option_id uuid not null,
  price_adjustment_cents integer,
  sort_order integer,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (menu_item_id, modifier_option_id),
  constraint menu_item_modifier_option_overrides_attachment_fkey
    foreign key (restaurant_id, menu_item_id, modifier_group_id)
    references public.menu_item_modifier_groups (restaurant_id, menu_item_id, modifier_group_id)
    on delete cascade,
  constraint menu_item_modifier_option_overrides_option_fkey
    foreign key (restaurant_id, modifier_group_id, modifier_option_id)
    references public.modifier_options (restaurant_id, modifier_group_id, id)
    on delete cascade,
  constraint menu_item_modifier_option_overrides_price_check
    check (price_adjustment_cents is null or price_adjustment_cents >= 0),
  constraint menu_item_modifier_option_overrides_sort_order_check
    check (sort_order is null or sort_order >= 0)
);

create index if not exists menu_item_modifier_option_overrides_item_idx
  on public.menu_item_modifier_option_overrides (menu_item_id, modifier_group_id, is_active, sort_order, modifier_option_id);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null,
  menu_id uuid not null,
  order_number bigint,
  idempotency_key text not null,
  order_status text not null default 'pending_payment',
  payment_status text not null default 'unpaid',
  customer_name text not null,
  customer_phone text,
  customer_email text,
  special_instructions text,
  pickup_mode text not null,
  pickup_at timestamptz,
  currency text not null,
  subtotal_cents integer not null,
  tax_cents integer not null default 0,
  tip_cents integer not null default 0,
  total_cents integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint orders_restaurant_fkey
    foreign key (restaurant_id) references public.restaurants(id) on delete restrict,
  constraint orders_menu_fkey
    foreign key (restaurant_id, menu_id) references public.menus (restaurant_id, id) on delete restrict,
  constraint orders_restaurant_id_id_key unique (restaurant_id, id),
  constraint orders_idempotency_key_check check (btrim(idempotency_key) <> '' and char_length(idempotency_key) <= 200),
  constraint orders_customer_name_check check (btrim(customer_name) <> '' and char_length(customer_name) <= 200),
  constraint orders_customer_phone_check check (customer_phone is null or char_length(customer_phone) <= 50),
  constraint orders_customer_email_check check (customer_email is null or char_length(customer_email) <= 320),
  constraint orders_special_instructions_check check (special_instructions is null or char_length(special_instructions) <= 1000),
  constraint orders_order_number_check check (order_number is null or order_number > 0),
  constraint orders_order_status_check check (order_status in ('pending_payment', 'placed', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled')),
  constraint orders_payment_status_check check (payment_status in ('unpaid', 'pending', 'paid', 'failed', 'partially_refunded', 'refunded')),
  constraint orders_pickup_mode_check check (pickup_mode in ('asap', 'scheduled')),
  constraint orders_scheduled_pickup_check check (pickup_mode = 'asap' or pickup_at is not null),
  constraint orders_currency_check check (currency ~ '^[A-Z]{3}$'),
  constraint orders_money_nonnegative_check check (
    subtotal_cents >= 0 and tax_cents >= 0 and tip_cents >= 0 and total_cents >= 0
  ),
  constraint orders_total_check check (total_cents = subtotal_cents + tax_cents + tip_cents)
);

create unique index if not exists orders_restaurant_order_number_idx
  on public.orders (restaurant_id, order_number)
  where order_number is not null;

create unique index if not exists orders_restaurant_idempotency_idx
  on public.orders (restaurant_id, idempotency_key);

create index if not exists orders_restaurant_created_idx
  on public.orders (restaurant_id, created_at desc);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null,
  order_id uuid not null,
  menu_item_id uuid not null,
  sort_order integer not null default 0,
  item_name text not null,
  base_price_cents integer not null,
  modifier_price_cents integer not null default 0,
  unit_price_cents integer not null,
  quantity integer not null,
  line_total_cents integer not null,
  special_instructions text,
  created_at timestamptz not null default now(),
  constraint order_items_order_fkey
    foreign key (restaurant_id, order_id) references public.orders (restaurant_id, id) on delete cascade,
  constraint order_items_menu_item_fkey
    foreign key (restaurant_id, menu_item_id) references public.menu_items (restaurant_id, id) on delete restrict,
  constraint order_items_restaurant_id_id_key unique (restaurant_id, id),
  constraint order_items_sort_order_check check (sort_order >= 0),
  constraint order_items_name_check check (btrim(item_name) <> ''),
  constraint order_items_quantity_check check (quantity > 0),
  constraint order_items_money_nonnegative_check check (
    base_price_cents >= 0 and modifier_price_cents >= 0 and unit_price_cents >= 0 and line_total_cents >= 0
  ),
  constraint order_items_unit_price_check check (unit_price_cents = base_price_cents + modifier_price_cents),
  constraint order_items_line_total_check check (line_total_cents = unit_price_cents * quantity),
  constraint order_items_special_instructions_check check (special_instructions is null or char_length(special_instructions) <= 1000),
  constraint order_items_order_sort_key unique (order_id, sort_order)
);

create index if not exists order_items_order_idx
  on public.order_items (order_id, sort_order, id);

create table if not exists public.order_item_modifiers (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null,
  order_item_id uuid not null,
  modifier_group_id uuid not null,
  modifier_option_id uuid not null,
  sort_order integer not null default 0,
  modifier_group_name text not null,
  modifier_option_name text not null,
  price_adjustment_cents integer not null,
  created_at timestamptz not null default now(),
  constraint order_item_modifiers_order_item_fkey
    foreign key (restaurant_id, order_item_id) references public.order_items (restaurant_id, id) on delete cascade,
  constraint order_item_modifiers_group_fkey
    foreign key (restaurant_id, modifier_group_id) references public.modifier_groups (restaurant_id, id) on delete restrict,
  constraint order_item_modifiers_option_fkey
    foreign key (restaurant_id, modifier_group_id, modifier_option_id)
    references public.modifier_options (restaurant_id, modifier_group_id, id)
    on delete restrict,
  constraint order_item_modifiers_sort_order_check check (sort_order >= 0),
  constraint order_item_modifiers_group_name_check check (btrim(modifier_group_name) <> ''),
  constraint order_item_modifiers_option_name_check check (btrim(modifier_option_name) <> ''),
  constraint order_item_modifiers_price_check check (price_adjustment_cents >= 0),
  constraint order_item_modifiers_item_option_key unique (order_item_id, modifier_option_id)
);

create index if not exists order_item_modifiers_order_item_idx
  on public.order_item_modifiers (order_item_id, sort_order, id);

create or replace function public.set_menu_man_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists modifier_groups_set_updated_at on public.modifier_groups;
create trigger modifier_groups_set_updated_at
before update on public.modifier_groups
for each row execute function public.set_menu_man_updated_at();

drop trigger if exists modifier_options_set_updated_at on public.modifier_options;
create trigger modifier_options_set_updated_at
before update on public.modifier_options
for each row execute function public.set_menu_man_updated_at();

drop trigger if exists menu_item_modifier_groups_set_updated_at on public.menu_item_modifier_groups;
create trigger menu_item_modifier_groups_set_updated_at
before update on public.menu_item_modifier_groups
for each row execute function public.set_menu_man_updated_at();

drop trigger if exists menu_item_modifier_option_overrides_set_updated_at on public.menu_item_modifier_option_overrides;
create trigger menu_item_modifier_option_overrides_set_updated_at
before update on public.menu_item_modifier_option_overrides
for each row execute function public.set_menu_man_updated_at();

drop trigger if exists orders_set_updated_at on public.orders;
create trigger orders_set_updated_at
before update on public.orders
for each row execute function public.set_menu_man_updated_at();

alter table public.modifier_groups enable row level security;
alter table public.modifier_options enable row level security;
alter table public.menu_item_modifier_groups enable row level security;
alter table public.menu_item_modifier_option_overrides enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_item_modifiers enable row level security;

revoke all on table public.modifier_groups from anon, authenticated;
revoke all on table public.modifier_options from anon, authenticated;
revoke all on table public.menu_item_modifier_groups from anon, authenticated;
revoke all on table public.menu_item_modifier_option_overrides from anon, authenticated;
revoke all on table public.orders from anon, authenticated;
revoke all on table public.order_items from anon, authenticated;
revoke all on table public.order_item_modifiers from anon, authenticated;

grant usage on schema public to service_role;
grant select on table
  public.modifier_groups,
  public.modifier_options,
  public.menu_item_modifier_groups,
  public.menu_item_modifier_option_overrides
to service_role;

grant select, insert, update on table
  public.orders,
  public.order_items,
  public.order_item_modifiers
to service_role;

commit;
