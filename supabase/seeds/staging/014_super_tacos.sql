-- STAGING ONLY. Super Tacos Step 0A: browse-only demonstration data.
-- Manual psql invocation only; never include in supabase/seed.sql or migrations.
-- See SUPER_TACOS.md for target verification and the application procedure.
-- Reruns restore this fixture's sample content; unexpected data aborts the transaction.
\set ON_ERROR_STOP on
\if :{?menu_man_environment}
\else
  \set menu_man_environment ''
\endif
\if :{?menu_man_staging_project_ref}
\else
  \set menu_man_staging_project_ref ''
\endif

begin;

select pg_catalog.set_config('menu_man.seed_environment', :'menu_man_environment', true);
select pg_catalog.set_config('menu_man.seed_project_ref', :'menu_man_staging_project_ref', true);
select pg_catalog.set_config('menu_man.seed_connection_host', :'HOST', true);
select pg_catalog.set_config('menu_man.seed_connection_user', :'USER', true);

do $$
declare
  project_ref text := pg_catalog.current_setting('menu_man.seed_project_ref');
  connection_host text := pg_catalog.current_setting('menu_man.seed_connection_host');
  connection_user text := pg_catalog.current_setting('menu_man.seed_connection_user');
begin
  if pg_catalog.current_setting('menu_man.seed_environment') <> 'staging'
    or project_ref !~ '^[a-z0-9]+$'
  then
    raise exception 'Super Tacos requires staging and an independently verified staging project ref';
  end if;
  -- HOST and USER come from the actual psql connection, not caller-supplied seed flags.
  -- Direct Supabase connections identify the project in HOST; shared poolers use USER.
  if not (
    connection_host = 'db.' || project_ref || '.supabase.co'
    or (connection_host ~ '^[a-z0-9-]+[.]pooler[.]supabase[.]com$'
      and connection_user = 'postgres.' || project_ref)
  ) then
    raise exception 'Super Tacos connection does not match the verified staging project ref';
  end if;
end;
$$;

do $$
declare
  restaurant_uuid constant uuid := '20000000-0000-4000-8000-000000000001';
  menu_uuid constant uuid := '20000000-0000-4000-8000-000000000002';
  section_row record;
  item_row record;
begin
  -- Serialize this fixture's own reruns. Never adopt a pre-existing unrelated tenant.
  perform pg_catalog.pg_advisory_xact_lock(20000000, 14);
  if exists (
    select 1 from public.restaurants
    where (slug = 'super-tacos' and id <> restaurant_uuid)
      or (id = restaurant_uuid and slug <> 'super-tacos')
  ) then
    raise exception 'Super Tacos restaurant identity collision; review manually';
  end if;
  if exists (
    select 1 from public.menus
    where (id = menu_uuid and restaurant_id <> restaurant_uuid)
      or (restaurant_id = restaurant_uuid and id <> menu_uuid)
  ) then
    raise exception 'Super Tacos expects only its independent demonstration menu';
  end if;
  if exists (select 1 from public.restaurant_payment_connections where restaurant_id = restaurant_uuid)
    or exists (select 1 from public.restaurant_delivery_providers where restaurant_id = restaurant_uuid)
    or exists (select 1 from public.orders where restaurant_id = restaurant_uuid)
  then
    raise exception 'Super Tacos has operational data; refuse to repurpose or delete it';
  end if;

  insert into public.restaurants (
    id, name, slug, currency, is_active, timezone, tagline, description,
    logo_url, hero_image_url, phone, address_line1, city, state, postal_code,
    latitude, longitude, pickup_url, doordash_url, google_maps_url,
    instagram_url, facebook_url, primary_color, accent_color,
    theme_preset, theme_overrides, primary_domain, is_indexable
  ) values (
    restaurant_uuid, 'Super Tacos', 'super-tacos', 'USD', true,
    'America/Los_Angeles', 'Big flavor. A little taco inspiration.',
    'A Menu Man demonstration restaurant. All dishes, prices, and details are sample content. Ordering is unavailable.',
    null, null, null, null, null, null, null,
    null, null, null, null, null, null, null, null, null,
    'classic-red', '{}'::jsonb, null, false
  ) on conflict (id) do update set
    name = excluded.name, currency = excluded.currency, is_active = true,
    timezone = excluded.timezone, tagline = excluded.tagline, description = excluded.description,
    logo_url = null, hero_image_url = null, phone = null,
    address_line1 = null, city = null, state = null, postal_code = null,
    latitude = null, longitude = null, pickup_url = null, doordash_url = null,
    google_maps_url = null, instagram_url = null, facebook_url = null,
    primary_color = null, accent_color = null,
    theme_preset = excluded.theme_preset, theme_overrides = excluded.theme_overrides,
    primary_domain = null, is_indexable = false;

  insert into public.menus (id, restaurant_id, name, is_published)
  values (menu_uuid, restaurant_uuid, 'Super Tacos Demonstration Menu', true)
  on conflict (id) do update set name = excluded.name, is_published = true;

  for section_row in
    select * from (values
      ('20000000-0000-4000-8000-000000000101'::uuid, 'Street Tacos', 'Small tacos, big flavor. Sample menu.', 0),
      ('20000000-0000-4000-8000-000000000102'::uuid, 'Burritos', 'Wrapped favorites made for a hearty appetite. Sample menu.', 1),
      ('20000000-0000-4000-8000-000000000103'::uuid, 'Favorites', 'A few more ways to find your favorite. Sample menu.', 2),
      ('20000000-0000-4000-8000-000000000104'::uuid, 'Sides & Drinks', 'Round out your meal. Sample menu.', 3)
    ) as sections(id, name, description, sort_order)
  loop
    if exists (select 1 from public.menu_sections where id = section_row.id and menu_id <> menu_uuid) then
      raise exception 'Super Tacos section identity collision';
    end if;
    insert into public.menu_sections (id, menu_id, name, description, sort_order, is_active)
    values (section_row.id, menu_uuid, section_row.name, section_row.description, section_row.sort_order, true)
    on conflict (id) do update set
      name = excluded.name, description = excluded.description, sort_order = excluded.sort_order, is_active = true;
  end loop;

  -- Numeric suffixes allocate separate fixed IDs for items (2xx) and placements (3xx).
  for item_row in
    select * from (values
      (1, 101, 'carne-asada-taco', 'Carne Asada Street Taco', 'Grilled steak, onion, cilantro, and salsa on a warm corn tortilla.', 350, 0),
      (2, 101, 'al-pastor-taco', 'Al Pastor Street Taco', 'Chile-marinated pork with pineapple, onion, and cilantro.', 350, 1),
      (3, 101, 'mushroom-taco', 'Roasted Mushroom Taco', 'Roasted mushrooms, cabbage, avocado salsa, and lime.', 325, 2),
      (4, 102, 'california-burrito', 'California Burrito', 'Grilled steak, crispy fries, cheese, pico de gallo, and crema.', 1195, 0),
      (5, 102, 'chicken-burrito', 'Grilled Chicken Burrito', 'Grilled chicken, rice, beans, cheese, and roasted tomato salsa.', 1095, 1),
      (6, 102, 'bean-cheese-burrito', 'Bean & Cheese Burrito', 'Slow-cooked pinto beans and melted cheese in a flour tortilla.', 795, 2),
      (7, 103, 'quesabirria', 'Quesabirria Trio', 'Three crisp beef birria tacos with melted cheese and a side of consomme.', 1395, 0),
      (8, 103, 'loaded-nachos', 'Loaded Asada Nachos', 'Corn tortilla chips with steak, beans, cheese, guacamole, and pico de gallo.', 1245, 1),
      (9, 103, 'cheese-quesadilla', 'Cheese Quesadilla', 'A toasted flour tortilla filled with melted cheese, served with salsa.', 745, 2),
      (10, 104, 'chips-guacamole', 'Chips & Guacamole', 'Crisp corn tortilla chips with a scoop of fresh guacamole.', 595, 0),
      (11, 104, 'rice-beans', 'Rice & Beans', 'Mexican-style rice and slow-cooked pinto beans.', 395, 1),
      (12, 104, 'hibiscus-agua-fresca', 'Hibiscus Agua Fresca', 'A chilled, lightly sweet hibiscus drink. Sample 16 oz serving.', 350, 2)
    ) as items(number, section_number, source_id, name, description, price_cents, sort_order)
  loop
    declare
      item_uuid uuid := ('20000000-0000-4000-8000-' || lpad((200 + item_row.number)::text, 12, '0'))::uuid;
      section_uuid uuid := ('20000000-0000-4000-8000-' || lpad(item_row.section_number::text, 12, '0'))::uuid;
      placement_uuid uuid := ('20000000-0000-4000-8000-' || lpad((300 + item_row.number)::text, 12, '0'))::uuid;
    begin
      if exists (select 1 from public.menu_items where id = item_uuid and restaurant_id is distinct from restaurant_uuid) then
        raise exception 'Super Tacos item identity collision';
      end if;
      if exists (
        select 1 from public.menu_section_items
        where id = placement_uuid and (section_id <> section_uuid or item_id <> item_uuid)
      ) then
        raise exception 'Super Tacos placement identity collision';
      end if;
      insert into public.menu_items (
        id, restaurant_id, name, description, price_cents, source_system,
        source_item_id, is_orderable, image_url, source_image_url, image_path
      ) values (
        item_uuid, restaurant_uuid, item_row.name, item_row.description, item_row.price_cents,
        'menu-man-staging', item_row.source_id, false, null, null, null
      ) on conflict (id) do update set
        name = excluded.name, description = excluded.description, price_cents = excluded.price_cents,
        source_system = excluded.source_system, source_item_id = excluded.source_item_id,
        is_orderable = false, image_url = null, source_image_url = null, image_path = null;

      insert into public.menu_section_items (id, section_id, item_id, sort_order)
      values (placement_uuid, section_uuid, item_uuid, item_row.sort_order)
      on conflict (id) do update set sort_order = excluded.sort_order;
    end;
  end loop;

  -- Explicitly disabled rather than missing settings: no order can be created.
  -- Zero tax is sample configuration only; it is not a restaurant tax determination.
  insert into public.restaurant_ordering_settings (
    restaurant_id, pickup_enabled, asap_enabled, scheduled_pickup_enabled,
    tax_strategy, tax_rate_basis_points
  ) values (restaurant_uuid, false, false, false, 'restaurant_percentage', 0)
  on conflict (restaurant_id) do update set
    pickup_enabled = false, asap_enabled = false, scheduled_pickup_enabled = false,
    tax_strategy = excluded.tax_strategy, tax_rate_basis_points = excluded.tax_rate_basis_points;

  -- Fail closed on unexpected additions/cross-links; never trim an existing catalog.
  if (select count(*) from public.menus where restaurant_id = restaurant_uuid and is_published) <> 1
    or (select count(*) from public.menu_sections where menu_id = menu_uuid) <> 4
    or (select count(*) from public.menu_items where restaurant_id = restaurant_uuid) <> 12
    or (select count(*) from public.menu_section_items p join public.menu_sections s on s.id = p.section_id where s.menu_id = menu_uuid) <> 12
    or exists (
      select 1 from public.menu_section_items p
      join public.menu_items i on i.id = p.item_id
      join public.menu_sections s on s.id = p.section_id
      where (i.restaurant_id = restaurant_uuid and s.menu_id <> menu_uuid)
        or (s.menu_id = menu_uuid and i.restaurant_id is distinct from restaurant_uuid)
    )
  then
    raise exception 'Super Tacos fixture shape changed; transaction will roll back';
  end if;
end;
$$;

commit;
