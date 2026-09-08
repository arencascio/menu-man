-- Apply manually in Supabase before enabling restaurant theme overrides.

alter table public.restaurants
  add column if not exists theme_preset text not null default 'classic-red',
  add column if not exists theme_overrides jsonb not null default '{}'::jsonb;

-- Theme overrides are validated by the application against a strict allowlist.
-- This constraint only enforces the storage shape; it does not permit arbitrary
-- CSS, HTML, selectors, URLs, or style blocks.
alter table public.restaurants
  drop constraint if exists restaurants_theme_overrides_object_check;

alter table public.restaurants
  add constraint restaurants_theme_overrides_object_check
  check (jsonb_typeof(theme_overrides) = 'object');
