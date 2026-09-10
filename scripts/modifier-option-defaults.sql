-- Apply manually after scripts/ordering-v1-schema.sql and before deploying
-- application code that selects modifier_options.is_default.

begin;

alter table public.modifier_options
  add column if not exists is_default boolean not null default false;

comment on column public.modifier_options.is_default is
  'Explicit reusable default. Runtime applies active defaults only when the resulting item group selection satisfies its attachment min/max rules.';

commit;
