-- STAGING ONLY. Never include this file in automatic production seeding.
-- Creates the catalog parent required by data/armandos.json. Unknown profile
-- and contact values intentionally remain null.

begin;

insert into public.restaurants (
  name,
  slug,
  currency,
  is_active,
  timezone
)
values (
  'Armandos Mexican Food',
  'armandos',
  'USD',
  true,
  'America/Los_Angeles'
)
on conflict (slug) do update set
  name = excluded.name,
  currency = excluded.currency,
  is_active = excluded.is_active,
  timezone = excluded.timezone;

commit;
