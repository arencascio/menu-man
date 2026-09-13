-- STAGING ONLY. Never include this file in automatic production seeding.
-- Routes Armando's checkout to one fixed Square Sandbox seller and location.
-- The access token and webhook signature key remain in Vercel environment secrets.

begin;

select pg_catalog.set_config('menu_man.seed_environment', 'staging', false);

do $$
begin
  if pg_catalog.current_setting('menu_man.seed_environment') <> 'staging' then
    raise exception 'Square Sandbox bootstrap is restricted to staging';
  end if;
end;
$$;

update public.restaurant_payment_connections connection
set is_payment_route = false
from public.restaurants restaurant
where restaurant.id = connection.restaurant_id
  and restaurant.slug = 'armandos'
  and connection.is_payment_route;

insert into public.restaurant_payment_connections (
  restaurant_id,
  provider_key,
  environment,
  connection_status,
  is_payment_route,
  credential_secret_ref,
  capabilities,
  provider_account_reference,
  provider_metadata,
  last_verified_at
)
select
  restaurant.id,
  'square',
  'sandbox',
  'active',
  true,
  'vercel-env:SQUARE_SANDBOX_ACCESS_TOKEN',
  array['accept_payments', 'refunds', 'manual_capture'],
  'ML29DVYEHTPXP',
  jsonb_build_object(
    'bootstrap', 'fixed_sandbox_seller',
    'country', 'US',
    'currency', 'USD',
    'paymentMethods', jsonb_build_array('card')
  ),
  now()
from public.restaurants restaurant
where restaurant.slug = 'armandos'
on conflict (restaurant_id, provider_key, environment) do update set
  connection_status = excluded.connection_status,
  is_payment_route = excluded.is_payment_route,
  credential_secret_ref = excluded.credential_secret_ref,
  capabilities = excluded.capabilities,
  provider_account_reference = excluded.provider_account_reference,
  provider_metadata = excluded.provider_metadata,
  last_verified_at = excluded.last_verified_at,
  disconnected_at = null;

insert into public.payment_provider_references (
  connection_id,
  provider_key,
  environment,
  reference_kind,
  external_id,
  is_primary
)
select
  connection.id,
  'square',
  'sandbox',
  reference.reference_kind,
  reference.external_id,
  true
from public.restaurant_payment_connections connection
join public.restaurants restaurant
  on restaurant.id = connection.restaurant_id
cross join lateral (
  values
    ('merchant', 'ML29DVYEHTPXP'),
    ('location', 'LT10G4TQX39MM')
) reference(reference_kind, external_id)
where restaurant.slug = 'armandos'
  and connection.provider_key = 'square'
  and connection.environment = 'sandbox'
on conflict (connection_id, reference_kind) do update set
  external_id = excluded.external_id,
  is_primary = excluded.is_primary;

commit;