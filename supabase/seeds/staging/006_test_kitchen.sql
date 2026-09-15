-- STAGING ONLY. Deterministic, idempotent second-tenant fixture. Never include
-- this file in production seeding. Test Kitchen uses only the fake provider.

\if :{?menu_man_environment}
\else
  \echo 'Missing -v menu_man_environment=staging'
  \quit
\endif

begin;

select pg_catalog.set_config('menu_man.seed_environment', :'menu_man_environment', false);

do $$
begin
  if pg_catalog.current_setting('menu_man.seed_environment') <> 'staging' then
    raise exception 'Test Kitchen bootstrap is restricted to staging';
  end if;
end;
$$;

do $$
declare
  restaurant_uuid uuid;
  menu_uuid uuid;
  mains_section_uuid uuid;
  sides_section_uuid uuid;
  bowl_item_uuid uuid;
  sandwich_item_uuid uuid;
  fries_item_uuid uuid;
  cookie_item_uuid uuid;
  protein_group_uuid uuid;
  extras_group_uuid uuid;
begin
  insert into public.restaurants (
    id, name, slug, currency, is_active, timezone, tagline, description,
    phone, address_line1, city, state, postal_code, theme_preset,
    theme_overrides, primary_domain, is_indexable
  ) values (
    '10000000-0000-4000-8000-000000000001',
    'Menu Man Test Kitchen', 'test-kitchen', 'USD', true,
    'America/Los_Angeles', 'Staging checkout fixtures, made to order.',
    'A staging-only restaurant for tenant, checkout, and notification QA.',
    '555-0199', '10 Test Kitchen Way', 'Los Angeles', 'CA', '90001',
    'classic-red', '{}'::jsonb, null, false
  )
  on conflict (slug) do update set
    name = excluded.name, currency = excluded.currency,
    is_active = excluded.is_active, timezone = excluded.timezone,
    tagline = excluded.tagline, description = excluded.description,
    phone = excluded.phone, address_line1 = excluded.address_line1,
    city = excluded.city, state = excluded.state, postal_code = excluded.postal_code,
    theme_preset = excluded.theme_preset, theme_overrides = excluded.theme_overrides,
    primary_domain = null, is_indexable = false
  returning id into restaurant_uuid;

  insert into public.menus (id, restaurant_id, name, is_published)
  values ('10000000-0000-4000-8000-000000000002', restaurant_uuid, 'Test Kitchen Menu', true)
  on conflict (restaurant_id, name) do update set is_published = true
  returning id into menu_uuid;

  insert into public.menu_sections (id, menu_id, name, description, sort_order, is_active)
  values ('10000000-0000-4000-8000-000000000101', menu_uuid, 'Kitchen favorites', 'Built for deterministic staging checkout.', 0, true)
  on conflict (menu_id, name) do update set description = excluded.description, sort_order = excluded.sort_order, is_active = true
  returning id into mains_section_uuid;

  insert into public.menu_sections (id, menu_id, name, description, sort_order, is_active)
  values ('10000000-0000-4000-8000-000000000102', menu_uuid, 'Sides', null, 1, true)
  on conflict (menu_id, name) do update set sort_order = excluded.sort_order, is_active = true
  returning id into sides_section_uuid;

  insert into public.menu_items (
    id, restaurant_id, name, description, price_cents, source_system,
    source_item_id, is_orderable
  ) values (
    '10000000-0000-4000-8000-000000000201', restaurant_uuid,
    'Test Bowl', 'Rice, vegetables, and your choice of protein.', 1095,
    'menu-man-staging', 'test-bowl', true
  ) on conflict (restaurant_id, source_system, source_item_id)
    where restaurant_id is not null and source_system is not null and source_item_id is not null
  do update set name = excluded.name, description = excluded.description,
    price_cents = excluded.price_cents, is_orderable = true
  returning id into bowl_item_uuid;

  insert into public.menu_items (
    id, restaurant_id, name, description, price_cents, source_system,
    source_item_id, is_orderable
  ) values (
    '10000000-0000-4000-8000-000000000202', restaurant_uuid,
    'Test Sandwich', 'Toasted roll with a deterministic filling.', 895,
    'menu-man-staging', 'test-sandwich', true
  ) on conflict (restaurant_id, source_system, source_item_id)
    where restaurant_id is not null and source_system is not null and source_item_id is not null
  do update set name = excluded.name, description = excluded.description,
    price_cents = excluded.price_cents, is_orderable = true
  returning id into sandwich_item_uuid;

  insert into public.menu_items (
    id, restaurant_id, name, description, price_cents, source_system,
    source_item_id, is_orderable
  ) values (
    '10000000-0000-4000-8000-000000000203', restaurant_uuid,
    'Crispy Fries', 'Salted and served hot.', 395,
    'menu-man-staging', 'test-fries', true
  ) on conflict (restaurant_id, source_system, source_item_id)
    where restaurant_id is not null and source_system is not null and source_item_id is not null
  do update set name = excluded.name, description = excluded.description,
    price_cents = excluded.price_cents, is_orderable = true
  returning id into fries_item_uuid;

  insert into public.menu_items (
    id, restaurant_id, name, description, price_cents, source_system,
    source_item_id, is_orderable
  ) values (
    '10000000-0000-4000-8000-000000000204', restaurant_uuid,
    'Chocolate Chip Cookie', 'One large cookie.', 250,
    'menu-man-staging', 'test-cookie', true
  ) on conflict (restaurant_id, source_system, source_item_id)
    where restaurant_id is not null and source_system is not null and source_item_id is not null
  do update set name = excluded.name, description = excluded.description,
    price_cents = excluded.price_cents, is_orderable = true
  returning id into cookie_item_uuid;

  insert into public.menu_section_items (section_id, item_id, sort_order)
  values
    (mains_section_uuid, bowl_item_uuid, 0),
    (mains_section_uuid, sandwich_item_uuid, 1),
    (sides_section_uuid, fries_item_uuid, 0),
    (sides_section_uuid, cookie_item_uuid, 1)
  on conflict (section_id, item_id) do update set sort_order = excluded.sort_order;

  insert into public.modifier_groups (
    id, restaurant_id, name, description, source_system, source_group_id, is_active
  ) values (
    '10000000-0000-4000-8000-000000000301', restaurant_uuid,
    'Choose a protein', null, 'menu-man-staging', 'protein', true
  ) on conflict (restaurant_id, source_system, source_group_id)
    where source_system is not null and source_group_id is not null
  do update set name = excluded.name, description = excluded.description, is_active = true
  returning id into protein_group_uuid;

  insert into public.modifier_groups (
    id, restaurant_id, name, description, source_system, source_group_id, is_active
  ) values (
    '10000000-0000-4000-8000-000000000302', restaurant_uuid,
    'Add extras', 'Optional staging add-ons.', 'menu-man-staging', 'extras', true
  ) on conflict (restaurant_id, source_system, source_group_id)
    where source_system is not null and source_group_id is not null
  do update set name = excluded.name, description = excluded.description, is_active = true
  returning id into extras_group_uuid;

  insert into public.modifier_options (
    id, restaurant_id, modifier_group_id, name,
    default_price_adjustment_cents, sort_order, source_system,
    source_option_id, is_default, is_active
  ) values
    ('10000000-0000-4000-8000-000000000401', restaurant_uuid, protein_group_uuid, 'Chicken', 0, 0, 'menu-man-staging', 'chicken', true, true),
    ('10000000-0000-4000-8000-000000000402', restaurant_uuid, protein_group_uuid, 'Tofu', 0, 1, 'menu-man-staging', 'tofu', false, true),
    ('10000000-0000-4000-8000-000000000403', restaurant_uuid, protein_group_uuid, 'Steak', 250, 2, 'menu-man-staging', 'steak', false, true),
    ('10000000-0000-4000-8000-000000000404', restaurant_uuid, extras_group_uuid, 'Avocado', 150, 0, 'menu-man-staging', 'avocado', false, true),
    ('10000000-0000-4000-8000-000000000405', restaurant_uuid, extras_group_uuid, 'Extra sauce', 50, 1, 'menu-man-staging', 'extra-sauce', false, true)
  on conflict (modifier_group_id, source_system, source_option_id)
    where source_system is not null and source_option_id is not null
  do update set name = excluded.name,
    default_price_adjustment_cents = excluded.default_price_adjustment_cents,
    sort_order = excluded.sort_order, is_default = excluded.is_default, is_active = true;

  insert into public.menu_item_modifier_groups (
    restaurant_id, menu_item_id, modifier_group_id,
    min_selections, max_selections, sort_order, is_active
  ) values
    (restaurant_uuid, bowl_item_uuid, protein_group_uuid, 1, 1, 0, true),
    (restaurant_uuid, bowl_item_uuid, extras_group_uuid, 0, 2, 1, true),
    (restaurant_uuid, sandwich_item_uuid, protein_group_uuid, 1, 1, 0, true),
    (restaurant_uuid, sandwich_item_uuid, extras_group_uuid, 0, 2, 1, true)
  on conflict (menu_item_id, modifier_group_id) do update set
    min_selections = excluded.min_selections,
    max_selections = excluded.max_selections,
    sort_order = excluded.sort_order, is_active = true;

  delete from public.restaurant_business_hours
  where restaurant_id = restaurant_uuid;
  insert into public.restaurant_business_hours (
    restaurant_id, day_of_week, open_time, close_time, is_closed, sort_order
  ) values
    (restaurant_uuid, 0, time '10:00', time '16:00', false, 0),
    (restaurant_uuid, 1, time '09:30', time '18:30', false, 0),
    (restaurant_uuid, 2, time '09:30', time '18:30', false, 0),
    (restaurant_uuid, 3, time '09:30', time '18:30', false, 0),
    (restaurant_uuid, 4, time '09:30', time '18:30', false, 0),
    (restaurant_uuid, 5, time '09:30', time '20:00', false, 0),
    (restaurant_uuid, 6, time '10:00', time '16:00', false, 0);

  insert into public.restaurant_ordering_settings (
    restaurant_id, pickup_enabled, asap_enabled, scheduled_pickup_enabled,
    pickup_lead_time_minutes, pickup_cutoff_minutes_before_close,
    pickup_slot_interval_minutes, advance_order_days, tax_strategy,
    tax_rate_basis_points
  ) values (
    restaurant_uuid, true, true, true, 10, 10, 10, 1,
    'restaurant_percentage', 900
  ) on conflict (restaurant_id) do update set
    pickup_enabled = true, asap_enabled = true, scheduled_pickup_enabled = true,
    pickup_lead_time_minutes = 10,
    pickup_cutoff_minutes_before_close = 10,
    pickup_slot_interval_minutes = 10, advance_order_days = 1,
    tax_strategy = 'restaurant_percentage', tax_rate_basis_points = 900;

  update public.restaurant_payment_connections
  set is_payment_route = false
  where restaurant_id = restaurant_uuid and is_payment_route;
  insert into public.restaurant_payment_connections (
    restaurant_id, provider_key, environment, connection_status,
    is_payment_route, capabilities, provider_account_reference,
    provider_metadata, last_verified_at
  ) values (
    restaurant_uuid, 'fake', 'test', 'active', true,
    array['accept_payments', 'refunds', 'manual_capture'],
    'fake_test_kitchen', jsonb_build_object('stagingFixture', true), now()
  ) on conflict (restaurant_id, provider_key, environment) do update set
    connection_status = 'active', is_payment_route = true,
    capabilities = excluded.capabilities,
    provider_account_reference = excluded.provider_account_reference,
    provider_metadata = excluded.provider_metadata,
    last_verified_at = excluded.last_verified_at, disconnected_at = null;
end;
$$;

commit;
