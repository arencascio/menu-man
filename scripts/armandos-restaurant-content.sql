-- Apply scripts/restaurant-content.sql first, then run this seed manually.
-- These values are intentionally labeled placeholders. Replace them with
-- verified restaurant-owned content before publishing this profile.

update public.restaurants
set
  timezone = 'America/Los_Angeles',
  logo_url = null,
  hero_image_url = null,
  tagline = 'PLACEHOLDER: Add a short restaurant tagline',
  description = 'PLACEHOLDER: Add verified restaurant and community information here.',
  phone = null,
  address_line1 = 'PLACEHOLDER: Add street address',
  city = 'PLACEHOLDER: Add city',
  state = 'PLACEHOLDER: Add state',
  postal_code = 'PLACEHOLDER: Add postal code',
  latitude = null,
  longitude = null,
  doordash_url = null,
  pickup_url = null,
  google_maps_url = null,
  instagram_url = null,
  facebook_url = null,
  primary_color = '#5b0000',
  accent_color = '#b70000'
where slug = 'armandos';

-- No business hours are asserted until verified. These closed rows make the
-- shell explicit without inventing operating hours.
insert into public.restaurant_business_hours
  (restaurant_id, day_of_week, open_time, close_time, is_closed, sort_order)
select id, days.day_of_week, null, null, true, 0
from public.restaurants
cross join (values (0), (1), (2), (3), (4), (5), (6)) as days(day_of_week)
where slug = 'armandos'
  and not exists (
    select 1
    from public.restaurant_business_hours existing
    where existing.restaurant_id = restaurants.id
      and existing.day_of_week = days.day_of_week
      and existing.sort_order = 0
  );
