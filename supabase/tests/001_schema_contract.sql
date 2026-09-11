-- Run with psql after applying migrations. This test is read-only and may run
-- before or after staging data is seeded.

do $$
declare
  missing_tables text[];
  missing_columns text[];
begin
  select array_agg(required_table.name order by required_table.name)
  into missing_tables
  from (values
    ('restaurants'),
    ('menus'),
    ('menu_sections'),
    ('menu_items'),
    ('menu_section_items'),
    ('restaurant_business_hours'),
    ('modifier_groups'),
    ('modifier_options'),
    ('menu_item_modifier_groups'),
    ('menu_item_modifier_option_overrides'),
    ('orders'),
    ('order_items'),
    ('order_item_modifiers'),
    ('restaurant_ordering_settings'),
    ('restaurant_order_counters')
    ,('restaurant_payment_connections')
    ,('payment_provider_references')
    ,('payments')
    ,('payment_checkout_sessions')
    ,('payment_attempts')
    ,('payment_webhook_events')
    ,('refunds')
    ,('payment_state_transitions')
    ,('analytics_outbox')
  ) required_table(name)
  where to_regclass('public.' || required_table.name) is null;

  if missing_tables is not null then
    raise exception 'Missing Menu Man tables: %', missing_tables;
  end if;

  select array_agg(required_column.table_name || '.' || required_column.column_name)
  into missing_columns
  from (values
    ('restaurants', 'timezone'),
    ('restaurants', 'theme_preset'),
    ('restaurants', 'theme_overrides'),
    ('restaurants', 'primary_domain'),
    ('menu_items', 'restaurant_id'),
    ('menu_items', 'source_system'),
    ('menu_items', 'source_item_id'),
    ('menu_items', 'source_image_url'),
    ('menu_items', 'image_path'),
    ('menu_items', 'is_orderable'),
    ('modifier_options', 'is_default'),
    ('orders', 'request_fingerprint'),
    ('orders', 'pickup_timezone'),
    ('orders', 'tax_rate_basis_points'),
    ('orders', 'tip_basis_points')
    ,('orders', 'payment_due_at')
    ,('payments', 'connection_id')
    ,('payment_attempts', 'provider_idempotency_key')
    ,('payment_webhook_events', 'provider_event_id')
  ) required_column(table_name, column_name)
  where not exists (
    select 1
    from information_schema.columns existing_column
    where existing_column.table_schema = 'public'
      and existing_column.table_name = required_column.table_name
      and existing_column.column_name = required_column.column_name
  );

  if missing_columns is not null then
    raise exception 'Missing Menu Man columns: %', missing_columns;
  end if;

  if exists (
    select 1
    from pg_catalog.pg_class relation
    join pg_catalog.pg_namespace namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relname in (
        'restaurants', 'menus', 'menu_sections', 'menu_items', 'menu_section_items',
        'restaurant_business_hours', 'modifier_groups', 'modifier_options',
        'menu_item_modifier_groups', 'menu_item_modifier_option_overrides',
        'orders', 'order_items', 'order_item_modifiers',
        'restaurant_ordering_settings', 'restaurant_order_counters'
        ,'restaurant_payment_connections', 'payment_provider_references',
        'payments', 'payment_checkout_sessions', 'payment_attempts',
        'payment_webhook_events', 'refunds', 'payment_state_transitions',
        'analytics_outbox'
      )
      and not relation.relrowsecurity
  ) then
    raise exception 'One or more Menu Man tables do not have RLS enabled';
  end if;

  if to_regprocedure('public.get_pickup_availability_v1(text,timestamp with time zone)') is null
    or to_regprocedure('public.create_order_v1(text,text,jsonb)') is null
  then
    raise exception 'Required checkout functions are missing';
  end if;

  if to_regprocedure('public.prepare_payment_v1(uuid,text,boolean,integer,integer)') is null
    or to_regprocedure('public.reserve_payment_attempt_v1(uuid,text,uuid)') is null
    or to_regprocedure('public.apply_payment_event_v1(uuid)') is null
    or to_regprocedure('public.reserve_refund_v1(uuid,uuid,integer,text,text)') is null
  then
    raise exception 'Required payment functions are missing';
  end if;

  if has_function_privilege('anon', 'public.create_order_v1(text,text,jsonb)', 'EXECUTE')
    or has_function_privilege('authenticated', 'public.create_order_v1(text,text,jsonb)', 'EXECUTE')
  then
    raise exception 'Checkout RPC must not be executable by anon/authenticated';
  end if;

  if not has_function_privilege('service_role', 'public.create_order_v1(text,text,jsonb)', 'EXECUTE') then
    raise exception 'service_role cannot execute checkout RPC';
  end if;

  if has_table_privilege('service_role', 'public.orders', 'INSERT')
    or has_table_privilege('service_role', 'public.order_items', 'INSERT')
    or has_table_privilege('service_role', 'public.order_item_modifiers', 'INSERT')
  then
    raise exception 'service_role must not insert order snapshots directly';
  end if;

  if has_table_privilege('service_role', 'public.payments', 'INSERT')
    or has_table_privilege('service_role', 'public.payment_attempts', 'UPDATE')
    or has_table_privilege('service_role', 'public.payment_webhook_events', 'INSERT')
    or has_table_privilege('service_role', 'public.analytics_outbox', 'INSERT')
  then
    raise exception 'service_role must mutate payment state only through restricted functions';
  end if;

  if not has_table_privilege('service_role', 'public.menu_items', 'SELECT')
    or not has_table_privilege('service_role', 'public.menu_items', 'INSERT')
    or not has_table_privilege('service_role', 'public.menu_items', 'UPDATE')
  then
    raise exception 'service_role lacks menu importer permissions';
  end if;

  if not exists (
    select 1 from pg_catalog.pg_extension where extname = 'pgcrypto'
  ) then
    raise exception 'pgcrypto extension is missing';
  end if;

  if not exists (
    select 1 from storage.buckets where id = 'restaurant-assets' and public
  ) then
    raise exception 'restaurant-assets public bucket is missing';
  end if;
end;
$$;
