-- STAGING ONLY. Never include this file in automatic production seeding.
-- Enables the test-only fake payment adapter for Armando's checkout.

begin;

insert into public.restaurant_payment_connections (
  restaurant_id,
  provider_key,
  environment,
  connection_status,
  is_payment_route,
  capabilities,
  provider_account_reference,
  provider_metadata,
  last_verified_at
)
select
  restaurant.id,
  'fake',
  'test',
  'active',
  true,
  array['accept_payments', 'refunds', 'manual_capture'],
  'fake_armandos',
  jsonb_build_object('stagingFixture', true),
  now()
from public.restaurants restaurant
where restaurant.slug = 'armandos'
on conflict (restaurant_id, provider_key, environment) do update set
  connection_status = excluded.connection_status,
  is_payment_route = excluded.is_payment_route,
  capabilities = excluded.capabilities,
  provider_account_reference = excluded.provider_account_reference,
  provider_metadata = excluded.provider_metadata,
  last_verified_at = excluded.last_verified_at,
  disconnected_at = null;

commit;
