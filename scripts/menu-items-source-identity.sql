-- Apply this migration in the Supabase SQL editor.
-- restaurant_id is nullable so existing/native menu items can remain unscoped
-- until they are intentionally associated with a restaurant.

alter table public.menu_items
  add column if not exists restaurant_id uuid references public.restaurants(id),
  add column if not exists source_system text,
  add column if not exists source_item_id text;

create unique index if not exists menu_items_restaurant_source_identity_idx
  on public.menu_items (restaurant_id, source_system, source_item_id)
  where restaurant_id is not null
    and source_system is not null
    and source_item_id is not null;