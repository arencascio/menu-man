-- Versioned application themes and canonical SEO domain metadata.

begin;

alter table public.restaurants
  add column theme_preset text not null default 'classic-red',
  add column theme_overrides jsonb not null default '{}'::jsonb,
  add column primary_domain text,
  add constraint restaurants_theme_overrides_object_check
    check (jsonb_typeof(theme_overrides) = 'object');

commit;
