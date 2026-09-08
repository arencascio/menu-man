-- Apply manually in Supabase before enabling canonical domain metadata.
-- This stores a canonical domain/base URL only; it does not enable hostname routing.

alter table public.restaurants
  add column if not exists primary_domain text;
