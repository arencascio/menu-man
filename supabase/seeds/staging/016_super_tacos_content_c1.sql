-- PREPARED ONLY. Separate approval and verified fresh content backup required.
-- Content sync for installed 015 fixture; NEVER rerun 014/015. No schema or payment DML.
-- The operator wrapper requires PGSSLMODE=verify-full and confirms client TLS with psql \conninfo.
-- Session Pooler pg_stat_ssl describes its PostgreSQL backend hop; direct Staging also requires backend TLS.
-- Catalog SHA256: 71793802142f636c17fd3ab01330ff52738fbfd5918be6f0ad98e867e2046cd1
\set ON_ERROR_STOP on
\encoding UTF8
begin;
set local lock_timeout='2s';
set local statement_timeout='30s';
select set_config('menu_man.content_environment', :'menu_man_environment', true) as ignored \gset
select set_config('menu_man.content_project', :'menu_man_staging_project_ref', true) as ignored \gset
select set_config('menu_man.content_host', :'HOST', true) as ignored \gset
select set_config('menu_man.content_user', :'USER', true) as ignored \gset
select set_config('menu_man.content_client_tls', :'menu_man_client_tls_mode', true) as ignored \gset
select set_config('menu_man.content_approval', :'approve_super_tacos_content', true) as ignored \gset
select set_config('menu_man.content_backup', :'backup_sha256', true) as ignored \gset
do $sync$
#variable_conflict use_variable
declare
  tenant constant uuid := '20000000-0000-4000-8000-000000000001';
  menu constant uuid := '20000000-0000-4000-8000-000000000002';
  original constant jsonb := '{"restaurantId":"20000000-0000-4000-8000-000000000001","menuId":"20000000-0000-4000-8000-000000000002","sections":[{"number":101,"name":"Street Tacos","description":"Corn tortillas, bright salsa, and big flavor. Priced per taco.","sort":0},{"number":102,"name":"Burritos","description":"Wrapped warm and made your way. Add a little extra if you like.","sort":1},{"number":103,"name":"Griddle Favorites","description":"Golden, melty, and made for sharing.","sort":2},{"number":104,"name":"Sides & Refreshers","description":"Something crunchy. Something cool.","sort":4},{"number":105,"name":"Breakfast","description":"A sunny start to the day, made fresh and served all morning.","sort":3},{"number":106,"name":"Sweet Finish","description":"Save a little room for cinnamon and sugar.","sort":5}],"items":[{"number":1,"section":101,"key":"carne-asada-taco","name":"Carne Asada Street Taco","description":"Grilled steak, onion, cilantro, and salsa on a warm corn tortilla.","price":375,"image":"asada","groups":[1,2,3]},{"number":2,"section":101,"key":"al-pastor-taco","name":"Al Pastor Street Taco","description":"Chile-marinated pork with pineapple, onion, and cilantro.","price":375,"image":"tacos","groups":[1,2,3]},{"number":3,"section":101,"key":"mushroom-taco","name":"Roasted Mushroom Taco","description":"Roasted mushrooms, cabbage, avocado salsa, and a squeeze of lime.","price":350,"image":"tacos","groups":[1,2,3]},{"number":4,"section":102,"key":"california-burrito","name":"California Burrito","description":"Grilled steak, crispy fries, cheese, pico de gallo, and crema.","price":1295,"image":"burrito","groups":[1,2]},{"number":5,"section":102,"key":"chicken-burrito","name":"Grilled Chicken Burrito","description":"Citrus chicken, rice, pinto beans, cheese, and roasted tomato salsa.","price":1195,"image":"burrito","groups":[1,2]},{"number":6,"section":102,"key":"bean-cheese-burrito","name":"Bean & Cheese Burrito","description":"Slow-cooked pinto beans and melted cheese in a soft flour tortilla.","price":895,"image":"burrito","groups":[1,2]},{"number":7,"section":103,"key":"quesabirria","name":"Quesabirria Trio","description":"Three crisp beef birria tacos with melted cheese and a side of consomme.","price":1495,"image":"tacos","groups":[1,2]},{"number":8,"section":103,"key":"loaded-nachos","name":"Loaded Asada Nachos","description":"Tortilla chips with grilled steak, beans, cheese, guacamole, and pico de gallo.","price":1345,"image":"nachos","groups":[1,2]},{"number":9,"section":103,"key":"cheese-quesadilla","name":"Cheese Quesadilla","description":"A golden flour tortilla filled with melted cheese, served with salsa and crema.","price":845,"image":"quesadilla","groups":[1,2]},{"number":10,"section":104,"key":"chips-guacamole","name":"Chips & Guacamole","description":"Crisp tortilla chips and chunky guacamole with lime and cilantro.","price":695,"image":"guacamole","groups":[]},{"number":11,"section":104,"key":"rice-beans","name":"Rice & Beans","description":"A generous side of Mexican-style rice and slow-cooked pinto beans.","price":450,"image":null,"groups":[]},{"number":12,"section":104,"key":"hibiscus-agua-fresca","name":"Hibiscus Agua Fresca","description":"A chilled, lightly sweet hibiscus refresher. Regular 16 oz.","price":395,"image":null,"groups":[4]},{"number":13,"section":101,"key":"carnitas-taco","name":"Citrus Carnitas Taco","description":"Slow-braised pork, onion, cilantro, and tangy salsa verde.","price":375,"image":"asada","groups":[1,2,3]},{"number":14,"section":101,"key":"chicken-taco","name":"Citrus Chicken Taco","description":"Marinated grilled chicken, shredded cabbage, and fresh pico de gallo.","price":350,"image":"tacos","groups":[1,2,3]},{"number":15,"section":101,"key":"shrimp-taco","name":"Chile Lime Shrimp Taco","description":"Sauteed shrimp, crunchy slaw, lime crema, and cilantro.","price":475,"image":null,"groups":[1,2,3]},{"number":16,"section":101,"key":"potato-taco","name":"Crispy Potato Taco","description":"Golden potatoes, shredded lettuce, cotija cheese, and salsa roja.","price":325,"image":"tacos","groups":[1,2,3]},{"number":17,"section":102,"key":"carnitas-burrito","name":"Carnitas Burrito","description":"Citrus-braised pork, rice, pinto beans, onion, and cilantro.","price":1245,"image":"burrito","groups":[1,2]},{"number":18,"section":102,"key":"veggie-burrito","name":"Garden Burrito","description":"Roasted peppers, mushrooms, rice, black beans, guacamole, and pico.","price":1095,"image":"burrito","groups":[1,2]},{"number":19,"section":102,"key":"shrimp-burrito","name":"Coastal Shrimp Burrito","description":"Chile lime shrimp, rice, cabbage, pico de gallo, and creamy chipotle sauce.","price":1445,"image":"burrito","groups":[1,2]},{"number":20,"section":103,"key":"chicken-quesadilla","name":"Chicken Quesadilla","description":"Grilled chicken and melted cheese in a toasted flour tortilla with salsa.","price":1145,"image":"quesadilla","groups":[1,2]},{"number":21,"section":105,"key":"breakfast-burrito","name":"Sunrise Breakfast Burrito","description":"Scrambled eggs, crispy potatoes, cheese, and pico de gallo.","price":1045,"image":"burrito","groups":[1,2]},{"number":22,"section":105,"key":"chorizo-burrito","name":"Chorizo & Egg Burrito","description":"Spiced chorizo, scrambled eggs, potatoes, and melted cheese.","price":1145,"image":"burrito","groups":[1,2]},{"number":23,"section":105,"key":"breakfast-tacos","name":"Breakfast Taco Pair","description":"Two warm tortillas with scrambled eggs, potatoes, cheese, and salsa.","price":745,"image":"tacos","groups":[1,2,3]},{"number":24,"section":105,"key":"breakfast-quesadilla","name":"Breakfast Quesadilla","description":"Eggs, roasted peppers, potatoes, and cheese folded into a toasted tortilla.","price":995,"image":"quesadilla","groups":[1,2]},{"number":25,"section":105,"key":"asada-breakfast-burrito","name":"Steak & Egg Burrito","description":"Grilled steak, fluffy eggs, potatoes, cheese, and salsa roja.","price":1295,"image":"burrito","groups":[1,2]},{"number":26,"section":104,"key":"lime-lemonade","name":"Mint Lime Lemonade","description":"Fresh citrus lemonade with mint. Regular 16 oz.","price":395,"image":"lemonade","groups":[4]},{"number":27,"section":104,"key":"chips-salsa","name":"Chips & Salsa","description":"Crisp tortilla chips with your choice of house salsa.","price":450,"image":"guacamole","groups":[1]},{"number":28,"section":106,"key":"churros","name":"Cinnamon Churros","description":"Three crisp churros rolled in cinnamon sugar with chocolate dipping sauce.","price":595,"image":"churros","groups":[]},{"number":29,"section":106,"key":"churro-bites","name":"Churro Bites","description":"A small bag of cinnamon-sugar churro bites, perfect for a sweet finish.","price":395,"image":"churros","groups":[]},{"number":30,"section":106,"key":"churros-for-two","name":"Churros for Two","description":"Six cinnamon churros with chocolate and caramel dipping sauces.","price":995,"image":"churros","groups":[]}],"modifierGroups":[{"number":1,"name":"Choose your salsa","min":1,"max":1,"options":[{"number":1,"name":"Roja — medium","price":0,"default":true},{"number":2,"name":"Verde — mild","price":0},{"number":3,"name":"No salsa","price":0}]},{"number":2,"name":"A little extra","min":0,"max":3,"options":[{"number":4,"name":"Guacamole","price":150},{"number":5,"name":"Extra cheese","price":75},{"number":6,"name":"Crema","price":50}]},{"number":3,"name":"Choose your tortilla","min":1,"max":1,"options":[{"number":7,"name":"Corn tortilla","price":0,"default":true},{"number":8,"name":"Flour tortilla","price":25}]},{"number":4,"name":"Drink size","min":1,"max":1,"options":[{"number":9,"name":"Regular — 16 oz","price":0,"default":true},{"number":10,"name":"Large — 24 oz","price":100}]}]}'::jsonb;
  revised constant jsonb := '{"restaurant":{"id":"20000000-0000-4000-8000-000000000001","slug":"super-tacos","name":"Super Tacos","tagline":"Bright salsas. Bold taco flavor.","description":"Fresh tortillas, flame-grilled favorites, and house salsas bring a little sunshine to every bite. Find your new favorite, make it your own, and enjoy the good stuff.","logo_url":"/img/super-tacos/approved/supertacologo.svg","hero_image_url":"/img/super-tacos/approved/carnitas-tacos.webp","phone":"(951) 555-0147","address_line1":"0000 Magnolia Avenue","city":"Riverside","state":"CA","postal_code":"92503","timezone":"America/Los_Angeles","theme_preset":"classic-red","hours":{"open":"09:00","close":"22:00"}},"menuId":"20000000-0000-4000-8000-000000000002","sections":[{"number":101,"name":"Street Tacos","description":"Corn tortillas, bright salsa, and big flavor. Priced per taco.","sort":0},{"number":102,"name":"Burritos","description":"Wrapped warm and made your way. Add a little extra if you like.","sort":1},{"number":103,"name":"Clásicos Mexicanos","description":"Comforting classics, bright salsas, and generous plates.","sort":2},{"number":104,"name":"Sides & Refreshers","description":"Something crunchy. Something cool.","sort":4},{"number":105,"name":"Breakfast","description":"A sunny start to the day, made fresh and served all morning.","sort":3},{"number":106,"name":"Sweet Finish","description":"Save a little room for cinnamon and sugar.","sort":5}],"items":[{"number":1,"section":101,"key":"carne-asada-taco","name":"Street Taco","description":"One warm taco with your choice of filling, onion, cilantro and salsa.","price":350,"groups":[5,1,3,2],"imageUrl":"/img/super-tacos/approved/carne-asada-tacos.webp"},{"number":4,"section":102,"key":"california-burrito","name":"Super Burrito","description":"Grilled steak, rice, cheese, pico de gallo, and crema wrapped in a warm flour tortilla.","price":1295,"groups":[1,2],"imageUrl":"/img/super-tacos/approved/burrito.webp"},{"number":5,"section":102,"key":"chicken-burrito","name":"Burrito","description":"Your choice of filling with rice, beans, cheese and roasted tomato salsa.","price":1095,"groups":[6,1,2],"imageUrl":"/img/super-tacos/approved/chicken-burrito.webp"},{"number":6,"section":102,"key":"bean-cheese-burrito","name":"Black Bean Burrito","description":"Slow-cooked black beans and melted cheese in a soft flour tortilla.","price":895,"groups":[1,2],"imageUrl":"/img/super-tacos/approved/black-bean-burrito.webp"},{"number":8,"section":103,"key":"loaded-nachos","name":"Loaded Nachos","description":"Tortilla chips with beans, cheese, guacamole, pico and your choice of topping.","price":945,"groups":[7,1,2],"imageUrl":"/img/super-tacos/approved/loaded-nachos.webp"},{"number":9,"section":103,"key":"cheese-quesadilla","name":"Quesadilla","description":"A toasted flour tortilla with melted cheese and your choice of filling. Salsa and crema on the side.","price":845,"groups":[7,1,2],"imageUrl":"/img/super-tacos/approved/quesadilla.webp"},{"number":10,"section":104,"key":"chips-guacamole","name":"House Salsa Sampler","description":"A trio of fresh house salsas served with warm tortilla chips.","price":695,"groups":[],"imageUrl":"/img/super-tacos/approved/salsas.webp"},{"number":21,"section":105,"key":"breakfast-burrito","name":"Breakfast Burrito","description":"Scrambled eggs, potatoes, cheese and pico with your choice of breakfast filling.","price":1045,"groups":[8,1,2],"imageUrl":"/img/super-tacos/approved/breakfast-burrito.webp"},{"number":24,"section":105,"key":"breakfast-quesadilla","name":"Breakfast Quesadilla","description":"Eggs, roasted peppers, potatoes, and cheese folded into a toasted tortilla.","price":995,"groups":[1,2],"imageUrl":"/img/super-tacos/approved/breakfast-quesadilla.webp"},{"number":27,"section":104,"key":"chips-salsa","name":"Chips & Salsa","description":"Crisp tortilla chips with your choice of house salsa.","price":450,"groups":[1],"imageUrl":"/img/super-tacos/approved/chips-and-salsa.webp"},{"number":28,"section":106,"key":"churros","name":"Cinnamon Churros","description":"Cinnamon-sugar churros with chocolate dipping sauce. Choose a portion to share.","price":595,"groups":[9],"imageUrl":"/img/super-tacos/approved/churros.webp"},{"number":29,"section":106,"key":"churro-bites","name":"Two Cinnamon Churros","description":"Two cinnamon-sugar churros served warm with chocolate dipping sauce.","price":395,"groups":[],"imageUrl":"/img/super-tacos/approved/churros.webp"},{"number":31,"section":104,"key":"horchata","name":"Horchata","description":"Chilled rice and cinnamon drink. Regular 16 oz.","price":395,"groups":[4],"imageUrl":"/img/super-tacos/approved/horchata.webp"},{"number":32,"section":105,"key":"chilaquiles-divorciados","name":"Chilaquiles Divorciados","description":"Tortilla chips with red and green salsa, eggs, crema and cotija.","price":1295,"groups":[2],"imageUrl":"/img/super-tacos/approved/chilaquiles.webp"},{"number":33,"section":103,"key":"loaded-rolled-tacos","name":"Loaded Rolled Tacos","description":"Three crisp chicken rolled tacos topped with lettuce, crema, guacamole and cotija.","price":995,"groups":[1],"imageUrl":"/img/super-tacos/approved/loaded-taquitos.webp"},{"number":34,"section":103,"key":"chorizo-queso-fundido","name":"Chorizo Queso Fundido","description":"Warm melted cheese and chorizo, served with tortillas for sharing.","price":1095,"groups":[],"imageUrl":"/img/super-tacos/approved/queso-fundido.webp"},{"number":35,"section":103,"key":"sopes","name":"Sopes","description":"Two thick corn masa rounds topped with beans, lettuce, crema, cotija, and fresh salsa.","price":1095,"groups":[1,2],"imageUrl":"/img/super-tacos/approved/sopes.webp"},{"number":36,"section":105,"key":"huevos-divorciados","name":"Huevos Divorciados","description":"Two eggs with red and green salsas, beans, and warm tortillas.","price":1195,"groups":[],"imageUrl":"/img/super-tacos/approved/huevos-divorciados.webp"},{"number":37,"section":103,"key":"ranchero-plate","name":"Ranchero Plate","description":"Ranchero-style grilled steak with rice, beans, and warm tortillas.","price":1295,"groups":[],"imageUrl":"/img/super-tacos/approved/ranchero-plate.webp"},{"number":38,"section":101,"key":"fish-taco","name":"Fish Taco","description":"Seasoned fish in your choice of tortilla with crunchy slaw, crema, and lime.","price":525,"groups":[3,1],"imageUrl":"/img/super-tacos/approved/fish-taco.webp"},{"number":39,"section":103,"key":"menudo","name":"Menudo","description":"A warming bowl of traditional hominy and tripe soup with lime, onion, and oregano.","price":1395,"groups":[],"imageUrl":"/img/super-tacos/approved/menudo.webp"},{"number":40,"section":104,"key":"mexican-coke","name":"Mexican Coke","description":"A chilled half-liter glass bottle of Mexican Coca-Cola.","price":425,"groups":[],"imageUrl":"/img/super-tacos/approved/mexican-coke.webp"},{"number":41,"section":103,"key":"shrimp-cocktail","name":"Shrimp Cocktail","description":"Chilled shrimp in a bright tomato-citrus sauce with avocado and crisp vegetables.","price":1495,"groups":[],"imageUrl":"/img/super-tacos/approved/shrimp-cocktail.webp"},{"number":42,"section":104,"key":"tortillas","name":"Tortillas","description":"A warm side of tortillas. Choose corn or flour.","price":295,"groups":[3],"imageUrl":"/img/super-tacos/approved/tortillas.webp"},{"number":43,"section":101,"key":"super-taco","name":"Super Taco","description":"Two loaded crisp tacos with your choice of filling, beans, lettuce, pico, guacamole, cheese, and salsa.","price":795,"groups":[5,1],"imageUrl":"/img/super-tacos/approved/super-taco.webp"}],"modifierGroups":[{"number":1,"name":"Choose your salsa","min":0,"max":1,"options":[{"number":1,"name":"Roja — medium","price":0,"default":true},{"number":2,"name":"Verde — mild","price":0},{"number":3,"name":"No salsa","price":0}]},{"number":2,"name":"A little extra","min":0,"max":3,"options":[{"number":4,"name":"Guacamole","price":150},{"number":5,"name":"Extra cheese","price":75},{"number":6,"name":"Crema","price":50}]},{"number":3,"name":"Choose your tortilla","min":1,"max":1,"options":[{"number":7,"name":"Corn tortilla","price":0,"default":true},{"number":8,"name":"Flour tortilla","price":25}]},{"number":4,"name":"Drink size","min":1,"max":1,"options":[{"number":9,"name":"Regular — 16 oz","price":0,"default":true},{"number":10,"name":"Large — 24 oz","price":100}]},{"number":5,"name":"Taco filling","min":1,"max":1,"options":[{"number":11,"name":"Carne asada","price":25},{"number":12,"name":"Carnitas","price":25},{"number":13,"name":"Al pastor","price":25},{"number":14,"name":"Grilled chicken","price":0},{"number":15,"name":"Roasted mushrooms","price":0},{"number":16,"name":"Crispy potato","price":0},{"number":17,"name":"Grilled shrimp","price":125}]},{"number":6,"name":"Burrito filling","min":1,"max":1,"options":[{"number":18,"name":"Carne asada","price":200},{"number":19,"name":"Grilled chicken","price":100},{"number":20,"name":"Carnitas","price":150},{"number":21,"name":"Al pastor","price":100},{"number":23,"name":"Black bean & vegetables","price":0},{"number":24,"name":"Grilled shrimp","price":350}]},{"number":7,"name":"Choose your topping","min":1,"max":1,"options":[{"number":25,"name":"Cheese only","price":0},{"number":26,"name":"Grilled chicken","price":300},{"number":27,"name":"Carne asada","price":400},{"number":28,"name":"Carnitas","price":350},{"number":29,"name":"Roasted vegetables","price":250},{"number":30,"name":"Grilled shrimp","price":500}]},{"number":8,"name":"Breakfast filling","min":1,"max":1,"options":[{"number":31,"name":"Eggs & potatoes","price":0},{"number":32,"name":"Chorizo & eggs","price":100},{"number":33,"name":"Steak & eggs","price":250},{"number":34,"name":"Roasted vegetables & eggs","price":0}]},{"number":9,"name":"Churro portion","min":1,"max":1,"options":[{"number":35,"name":"Three churros","price":0},{"number":36,"name":"Six churros","price":400}]}],"contentVersion":"sprint-c3","retiredItems":[{"number":2,"replacement":1,"option":13,"reason":"Consolidated filling or portion variant; retain original row and engagement records."},{"number":3,"replacement":1,"option":15,"reason":"Consolidated filling or portion variant; retain original row and engagement records."},{"number":13,"replacement":1,"option":12,"reason":"Consolidated filling or portion variant; retain original row and engagement records."},{"number":14,"replacement":1,"option":14,"reason":"Consolidated filling or portion variant; retain original row and engagement records."},{"number":15,"replacement":1,"option":17,"reason":"Consolidated filling or portion variant; retain original row and engagement records."},{"number":16,"replacement":1,"option":16,"reason":"Consolidated filling or portion variant; retain original row and engagement records."},{"number":17,"replacement":5,"option":20,"reason":"Consolidated filling or portion variant; retain original row and engagement records."},{"number":18,"replacement":5,"option":23,"reason":"Consolidated filling or portion variant; retain original row and engagement records."},{"number":19,"replacement":5,"option":24,"reason":"Consolidated filling or portion variant; retain original row and engagement records."},{"number":20,"replacement":9,"option":26,"reason":"Consolidated filling or portion variant; retain original row and engagement records."},{"number":22,"replacement":21,"option":32,"reason":"Consolidated filling or portion variant; retain original row and engagement records."},{"number":25,"replacement":21,"option":33,"reason":"Consolidated filling or portion variant; retain original row and engagement records."},{"number":30,"replacement":28,"option":36,"reason":"Consolidated filling or portion variant; retain original row and engagement records."},{"number":7,"replacement":null,"option":null,"reason":"No approved photograph accurately represents quesabirria; retain historical row and order references."},{"number":11,"replacement":null,"option":null,"reason":"No approved photograph accurately represents rice and beans; retain historical row and order references."},{"number":12,"replacement":null,"option":null,"reason":"No approved photograph accurately represents hibiscus agua fresca; retain historical row and order references."},{"number":23,"replacement":null,"option":null,"reason":"No approved photograph accurately represents breakfast tacos; retain historical row and order references."},{"number":26,"replacement":null,"option":null,"reason":"No approved photograph accurately represents mint lime lemonade; retain historical row and order references."}]}'::jsonb;
  item jsonb; grp jsonb; opt jsonb; section jsonb; retired jsonb;
  item_id uuid; group_id uuid; option_id uuid; section_id uuid; group_number integer; ordinal integer;
  other_before text; other_after text;
begin
  if current_setting('menu_man.content_environment')<>'staging'
    or current_setting('menu_man.content_project')<>'jjvongzvtnzlvwdfcnjk'
    or current_setting('menu_man.content_client_tls')<>'verify-full'
    or not (
      (current_setting('menu_man.content_host')='db.jjvongzvtnzlvwdfcnjk.supabase.co'
        and current_setting('menu_man.content_user')='postgres'
        and exists(select 1 from pg_stat_ssl where pid=pg_backend_pid() and ssl))
      or (current_setting('menu_man.content_host')='aws-0-us-east-2.pooler.supabase.com'
        and current_setting('menu_man.content_user')='postgres.jjvongzvtnzlvwdfcnjk')
    )
    or current_database()<>'postgres'
  then raise exception 'Exact Staging target and transport guard required; no content changed.'; end if;
  if current_setting('menu_man.content_approval')<>'sync-super-tacos-sprint-c3'
    or current_setting('menu_man.content_backup') !~ '^[a-f0-9]{64}$'
  then raise exception 'Explicit content-sync approval and verified backup SHA256 required.'; end if;
  perform pg_advisory_xact_lock(hashtextextended('public-demo:'||tenant::text,0));
  perform 1 from public.restaurants where id=tenant for update;
  perform 1 from public.menu_items where restaurant_id=tenant for update;
  perform 1 from public.modifier_groups where restaurant_id=tenant for update;
  perform 1 from public.modifier_options where restaurant_id=tenant for update;
  perform 1 from public.menu_item_modifier_groups where restaurant_id=tenant for update;
  if not exists(select 1 from public.restaurants where id=tenant and slug='super-tacos' and not is_indexable
      and logo_url='/img/super-tacos/logo.svg' and phone is null and address_line1 is null
      and city is null and state is null and postal_code is null and google_maps_url is null)
    or (select count(*) from public.menus where restaurant_id=tenant)<>1
    or not exists(select 1 from public.menus where id=menu and restaurant_id=tenant and is_published)
    or (select count(*) from public.menu_items where restaurant_id=tenant)<>30
    or (select count(*) from public.menu_sections where menu_id=menu)<>6
    or (select count(*) from public.menu_section_items p join public.menu_sections s on s.id=p.section_id where s.menu_id=menu)<>30
    or (select count(*) from public.modifier_groups where restaurant_id=tenant)<>4
    or (select count(*) from public.modifier_options where restaurant_id=tenant)<>10
    or (select count(*) from public.restaurant_business_hours where restaurant_id=tenant and not is_closed
      and open_time='09:00'::time and close_time='22:00'::time)<>7
    or exists(select 1 from public.menu_item_modifier_option_overrides where restaurant_id=tenant)
    or exists(select 1 from public.orders where restaurant_id=tenant and order_status not in ('completed','cancelled'))
    or exists(select 1 from public.restaurant_catering_settings where restaurant_id=tenant and (coalesce((settings->>'enabled')::boolean,false) or coalesce((settings->>'notifyOwner')::boolean,false)))
  then raise exception 'Expected installed 30-item demo with no active orders not found. Stop for review.'; end if;
  -- Verify every existing identity and authoritative price before applying any DML.
  for section in select value from jsonb_array_elements(original->'sections') loop
    section_id:=('20000000-0000-4000-8000-'||lpad(section->>'number',12,'0'))::uuid;
    if not exists(select 1 from public.menu_sections s where s.id=section_id and s.menu_id=menu
      and s.name=section->>'name' and s.description is not distinct from section->>'description'
      and s.sort_order=(section->>'sort')::int and s.is_active)
    then raise exception 'Section drift; no content changed.'; end if;
  end loop;
  for item in select value from jsonb_array_elements(original->'items') loop
    item_id:=('20000000-0000-4000-8000-'||lpad(((item->>'number')::int+200)::text,12,'0'))::uuid;
    section_id:=('20000000-0000-4000-8000-'||lpad(item->>'section',12,'0'))::uuid;
    if not exists(select 1 from public.menu_items i where i.id=item_id and i.restaurant_id=tenant
      and i.name=item->>'name' and i.description is not distinct from item->>'description'
      and i.price_cents=(item->>'price')::int and i.source_system='menu-man-staging' and i.source_item_id=item->>'key' and i.is_orderable
      and i.image_path is null and i.source_image_url is not distinct from
        case when item->>'image' is null then null else '/img/super-tacos/'||(item->>'image')||'.jpg' end)
      or not exists(select 1 from public.menu_section_items p where p.id=('20000000-0000-4000-8000-'||lpad(((item->>'number')::int+300)::text,12,'0'))::uuid
        and p.item_id=item_id and p.section_id=section_id and p.sort_order=(item->>'number')::int)
      or (select count(*) from public.menu_item_modifier_groups a where a.menu_item_id=item_id and a.restaurant_id=tenant)<>jsonb_array_length(item->'groups')
    then raise exception 'Installed item or attachment identity drift: %',item_id; end if;
    for grp in select g from jsonb_array_elements(original->'modifierGroups') g where item->'groups' @> jsonb_build_array((g->>'number')::int) loop
      if not exists(select 1 from public.menu_item_modifier_groups a where a.menu_item_id=item_id and a.restaurant_id=tenant
        and a.modifier_group_id=('20000000-0000-4000-8000-'||lpad(((grp->>'number')::int+500)::text,12,'0'))::uuid
        and a.min_selections=(grp->>'min')::int and a.max_selections=(grp->>'max')::int and a.is_active)
      then raise exception 'Installed modifier attachment drift: %',item_id; end if;
    end loop;
  end loop;
  for grp in select value from jsonb_array_elements(original->'modifierGroups') loop
    group_id:=('20000000-0000-4000-8000-'||lpad(((grp->>'number')::int+500)::text,12,'0'))::uuid;
    if not exists(select 1 from public.modifier_groups g where g.id=group_id and g.restaurant_id=tenant and g.name=grp->>'name' and g.is_active)
    then raise exception 'Installed group drift.'; end if;
    for opt in select value from jsonb_array_elements(grp->'options') loop
      if not exists(select 1 from public.modifier_options o where o.id=('20000000-0000-4000-8000-'||lpad(((opt->>'number')::int+600)::text,12,'0'))::uuid
        and o.restaurant_id=tenant and o.modifier_group_id=group_id and o.name=opt->>'name'
        and o.default_price_adjustment_cents=(opt->>'price')::int and o.is_active and o.is_default=coalesce((opt->>'default')::boolean,false))
      then raise exception 'Installed option pricing/default drift.'; end if;
    end loop;
  end loop;
  -- Reject globally colliding IDs, including placements in a different menu.
  if exists(select 1 from public.menu_items i join jsonb_array_elements(revised->'items') n
      on i.id=('20000000-0000-4000-8000-'||lpad(((n->>'number')::int+200)::text,12,'0'))::uuid where i.restaurant_id<>tenant)
    or exists(select 1 from public.modifier_groups g join jsonb_array_elements(revised->'modifierGroups') n
      on g.id=('20000000-0000-4000-8000-'||lpad(((n->>'number')::int+500)::text,12,'0'))::uuid where g.restaurant_id<>tenant)
    or exists(select 1 from public.modifier_options o join jsonb_array_elements(revised->'modifierGroups') g on true cross join lateral jsonb_array_elements(g->'options') n
      where o.id=('20000000-0000-4000-8000-'||lpad(((n->>'number')::int+600)::text,12,'0'))::uuid and o.restaurant_id<>tenant)
    or exists(select 1 from public.menu_section_items p join jsonb_array_elements(revised->'items') n
      on p.id=('20000000-0000-4000-8000-'||lpad(((n->>'number')::int+300)::text,12,'0'))::uuid
      where p.item_id<>('20000000-0000-4000-8000-'||lpad(((n->>'number')::int+200)::text,12,'0'))::uuid
        or p.section_id<>('20000000-0000-4000-8000-'||lpad(n->>'section',12,'0'))::uuid)
  then raise exception 'Reserved ID collision; no identity adopted.'; end if;
  other_before:=(select md5(coalesce(string_agg(row_record,E'\n' order by row_record),'')) from (select jsonb_build_array('menu_items',to_jsonb(t))::text row_record from public.menu_items t where restaurant_id<>tenant
union all
select jsonb_build_array('modifier_groups',to_jsonb(t))::text row_record from public.modifier_groups t where restaurant_id<>tenant
union all
select jsonb_build_array('modifier_options',to_jsonb(t))::text row_record from public.modifier_options t where restaurant_id<>tenant
union all
select jsonb_build_array('menu_item_modifier_groups',to_jsonb(t))::text row_record from public.menu_item_modifier_groups t where restaurant_id<>tenant
union all
select jsonb_build_array('menu_item_modifier_option_overrides',to_jsonb(t))::text row_record from public.menu_item_modifier_option_overrides t where restaurant_id<>tenant
union all
select jsonb_build_array('restaurants',to_jsonb(t))::text row_record from public.restaurants t where id<>tenant
union all
select jsonb_build_array('menu_sections',to_jsonb(t))::text row_record from public.menu_sections t join public.menus m on m.id=t.menu_id where m.restaurant_id<>tenant
union all
select jsonb_build_array('menu_section_items',to_jsonb(t))::text row_record from public.menu_section_items t join public.menu_sections s on s.id=t.section_id join public.menus m on m.id=s.menu_id where m.restaurant_id<>tenant) all_rows);

  -- Retain retired rows, names, IDs and engagement history; remove only menu placements.
  for retired in select value from jsonb_array_elements(revised->'retiredItems') loop
    item_id:=('20000000-0000-4000-8000-'||lpad(((retired->>'number')::int+200)::text,12,'0'))::uuid;
    update public.menu_items set is_orderable=false,source_image_url=null,image_path=null where id=item_id and restaurant_id=tenant;
    update public.menu_item_modifier_groups set is_active=false where menu_item_id=item_id and restaurant_id=tenant;
    delete from public.menu_section_items p using public.menu_sections s where p.section_id=s.id and s.menu_id=menu and p.item_id=item_id;
  end loop;
  for section in select value from jsonb_array_elements(revised->'sections') loop
    section_id:=('20000000-0000-4000-8000-'||lpad(section->>'number',12,'0'))::uuid;
    update public.menu_sections set name=section->>'name',description=section->>'description'
      where id=section_id and menu_id=menu and sort_order=(section->>'sort')::int;
    if not found then raise exception 'Section identity or ordering drift.'; end if;
  end loop;
  for grp in select value from jsonb_array_elements(revised->'modifierGroups') loop
    group_id:=('20000000-0000-4000-8000-'||lpad(((grp->>'number')::int+500)::text,12,'0'))::uuid;
    insert into public.modifier_groups(id,restaurant_id,name,is_active) values(group_id,tenant,grp->>'name',true)
      on conflict(id) do update set name=excluded.name,is_active=true where modifier_groups.restaurant_id=tenant;
    ordinal:=0;
    for opt in select value from jsonb_array_elements(grp->'options') loop
      option_id:=('20000000-0000-4000-8000-'||lpad(((opt->>'number')::int+600)::text,12,'0'))::uuid;
      insert into public.modifier_options(id,restaurant_id,modifier_group_id,name,default_price_adjustment_cents,sort_order,is_active,is_default)
        values(option_id,tenant,group_id,opt->>'name',(opt->>'price')::int,ordinal,true,coalesce((opt->>'default')::boolean,false))
        on conflict(id) do update set name=excluded.name,default_price_adjustment_cents=excluded.default_price_adjustment_cents,
          sort_order=excluded.sort_order,is_active=true,is_default=excluded.is_default where modifier_options.restaurant_id=tenant and modifier_options.modifier_group_id=excluded.modifier_group_id;
      ordinal:=ordinal+1;
    end loop;
  end loop;
  for item in select value from jsonb_array_elements(revised->'items') loop
    item_id:=('20000000-0000-4000-8000-'||lpad(((item->>'number')::int+200)::text,12,'0'))::uuid;
    section_id:=('20000000-0000-4000-8000-'||lpad(item->>'section',12,'0'))::uuid;
    insert into public.menu_items(id,restaurant_id,name,description,price_cents,source_system,source_item_id,is_orderable,source_image_url,image_path)
      values(item_id,tenant,item->>'name',item->>'description',(item->>'price')::int,'menu-man-staging',item->>'key',true,item->>'imageUrl',null)
      on conflict(id) do update set name=excluded.name,description=excluded.description,price_cents=excluded.price_cents,
        is_orderable=true,source_image_url=excluded.source_image_url,image_path=null where menu_items.restaurant_id=tenant;
    insert into public.menu_section_items(id,section_id,item_id,sort_order)
      values(('20000000-0000-4000-8000-'||lpad(((item->>'number')::int+300)::text,12,'0'))::uuid,section_id,item_id,(item->>'number')::int)
      on conflict(id) do update set sort_order=excluded.sort_order where menu_section_items.section_id=section_id and menu_section_items.item_id=item_id;
    ordinal:=0;
    for group_number in select value::text::int from jsonb_array_elements(item->'groups') loop
      select g into grp from jsonb_array_elements(revised->'modifierGroups') g where (g->>'number')::int=group_number;
      group_id:=('20000000-0000-4000-8000-'||lpad((group_number+500)::text,12,'0'))::uuid;
      insert into public.menu_item_modifier_groups(restaurant_id,menu_item_id,modifier_group_id,min_selections,max_selections,sort_order,is_active)
        values(tenant,item_id,group_id,(grp->>'min')::int,(grp->>'max')::int,ordinal,true)
        on conflict(menu_item_id,modifier_group_id) do update set min_selections=excluded.min_selections,max_selections=excluded.max_selections,sort_order=excluded.sort_order,is_active=true
          where menu_item_modifier_groups.restaurant_id=tenant;
      ordinal:=ordinal+1;
    end loop;
  end loop;
  update public.restaurants set logo_url=revised->'restaurant'->>'logo_url',
    hero_image_url=revised->'restaurant'->>'hero_image_url',phone=revised->'restaurant'->>'phone',
    address_line1=revised->'restaurant'->>'address_line1',city=revised->'restaurant'->>'city',
    state=revised->'restaurant'->>'state',postal_code=revised->'restaurant'->>'postal_code'
    where id=tenant and slug='super-tacos';

  if (select count(*) from public.menu_items where restaurant_id=tenant)<>43
    or (select count(*) from public.menu_items where restaurant_id=tenant and is_orderable)<>25
    or (select count(*) from public.menu_section_items p join public.menu_sections s on s.id=p.section_id where s.menu_id=menu)<>25
    or (select count(*) from public.modifier_groups where restaurant_id=tenant and is_active)<>9
    or (select count(*) from public.modifier_options where restaurant_id=tenant and is_active)<>35
  then raise exception 'Content postconditions failed; transaction rolled back.'; end if;
  for section in select value from jsonb_array_elements(revised->'sections') loop
    section_id:=('20000000-0000-4000-8000-'||lpad(section->>'number',12,'0'))::uuid;
    if not exists(select 1 from public.menu_sections s where s.id=section_id and s.menu_id=menu
      and s.name=section->>'name' and s.description is not distinct from section->>'description'
      and s.sort_order=(section->>'sort')::int and s.is_active)
    then raise exception 'Section postcondition failed.'; end if;
  end loop;
  for item in select value from jsonb_array_elements(revised->'items') loop
    item_id:=('20000000-0000-4000-8000-'||lpad(((item->>'number')::int+200)::text,12,'0'))::uuid;
    if not exists(select 1 from public.menu_items i where i.id=item_id and i.restaurant_id=tenant and i.is_orderable
      and i.name=item->>'name' and i.description is not distinct from item->>'description'
      and i.price_cents=(item->>'price')::int and i.source_item_id=item->>'key'
      and i.source_image_url is not distinct from item->>'imageUrl' and i.image_path is null)
      or not exists(select 1 from public.menu_section_items p where p.id=('20000000-0000-4000-8000-'||lpad(((item->>'number')::int+300)::text,12,'0'))::uuid
        and p.item_id=item_id and p.section_id=('20000000-0000-4000-8000-'||lpad(item->>'section',12,'0'))::uuid)
      or (select count(*) from public.menu_item_modifier_groups a where a.menu_item_id=item_id and a.restaurant_id=tenant and a.is_active)<>jsonb_array_length(item->'groups')
    then raise exception 'Canonical item postcondition failed: %',item_id; end if;
    for group_number in select value::text::int from jsonb_array_elements(item->'groups') loop
      select g into grp from jsonb_array_elements(revised->'modifierGroups') g where (g->>'number')::int=group_number;
      group_id:=('20000000-0000-4000-8000-'||lpad((group_number+500)::text,12,'0'))::uuid;
      if not exists(select 1 from public.menu_item_modifier_groups a where a.restaurant_id=tenant and a.menu_item_id=item_id
        and a.modifier_group_id=group_id and a.is_active and a.min_selections=(grp->>'min')::int and a.max_selections=(grp->>'max')::int)
      then raise exception 'Required modifier postcondition failed: %',item_id; end if;
    end loop;
  end loop;
  other_after:=(select md5(coalesce(string_agg(row_record,E'\n' order by row_record),'')) from (select jsonb_build_array('menu_items',to_jsonb(t))::text row_record from public.menu_items t where restaurant_id<>tenant
union all
select jsonb_build_array('modifier_groups',to_jsonb(t))::text row_record from public.modifier_groups t where restaurant_id<>tenant
union all
select jsonb_build_array('modifier_options',to_jsonb(t))::text row_record from public.modifier_options t where restaurant_id<>tenant
union all
select jsonb_build_array('menu_item_modifier_groups',to_jsonb(t))::text row_record from public.menu_item_modifier_groups t where restaurant_id<>tenant
union all
select jsonb_build_array('menu_item_modifier_option_overrides',to_jsonb(t))::text row_record from public.menu_item_modifier_option_overrides t where restaurant_id<>tenant
union all
select jsonb_build_array('restaurants',to_jsonb(t))::text row_record from public.restaurants t where id<>tenant
union all
select jsonb_build_array('menu_sections',to_jsonb(t))::text row_record from public.menu_sections t join public.menus m on m.id=t.menu_id where m.restaurant_id<>tenant
union all
select jsonb_build_array('menu_section_items',to_jsonb(t))::text row_record from public.menu_section_items t join public.menu_sections s on s.id=t.section_id join public.menus m on m.id=s.menu_id where m.restaurant_id<>tenant) all_rows);
  if other_before is distinct from other_after then raise exception 'Other-tenant content changed; transaction rolled back.'; end if;
  if not exists(select 1 from public.restaurants where id=tenant and slug='super-tacos' and not is_indexable
    and logo_url=revised->'restaurant'->>'logo_url' and phone=revised->'restaurant'->>'phone'
    and address_line1=revised->'restaurant'->>'address_line1' and city=revised->'restaurant'->>'city'
    and state=revised->'restaurant'->>'state' and postal_code=revised->'restaurant'->>'postal_code'
    and google_maps_url is null)
  then raise exception 'Restaurant contact postcondition failed.'; end if;
  raise notice 'Super Tacos C.3 content verified; archived IDs and hearts preserved. Backup SHA256: %',current_setting('menu_man.content_backup');
end;
$sync$;
commit;
