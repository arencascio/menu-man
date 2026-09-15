-- Run with psql after applying migrations. This test is read-only and may run
-- before or after staging data is seeded.

do $$
declare
  missing_tables text[];
  missing_columns text[];
  checkout_function_definition text;
  checkout_wrapper_definition text;
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
    ,('restaurant_notification_settings')
    ,('restaurant_notification_setting_events')
    ,('notification_outbox')
    ,('notification_delivery_attempts')
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
    ('restaurants', 'is_indexable'),
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
    ,('restaurant_ordering_settings', 'pickup_slot_interval_minutes')
    ,('restaurant_ordering_settings', 'advance_order_days')
    ,('orders', 'payment_due_at')
    ,('payments', 'connection_id')
    ,('payment_attempts', 'provider_idempotency_key')
    ,('payment_webhook_events', 'provider_event_id')
    ,('payment_webhook_events', 'event_source')
    ,('refunds', 'failure_category')
    ,('refunds', 'failure_code')
    ,('refunds', 'failure_message')
    ,('notification_outbox', 'idempotency_key')
    ,('notification_outbox', 'next_attempt_at')
    ,('notification_outbox', 'provider_message_id')
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
        'analytics_outbox', 'restaurant_notification_settings',
        'restaurant_notification_setting_events', 'notification_outbox',
        'notification_delivery_attempts'
      )
      and not relation.relrowsecurity
  ) then
    raise exception 'One or more Menu Man tables do not have RLS enabled';
  end if;

  if to_regprocedure('public.get_pickup_availability_v1(text,timestamp with time zone)') is null
    or to_regprocedure('public.create_order_v1(text,text,jsonb)') is null
    or to_regprocedure('public.create_order_base_v1(text,text,jsonb)') is null
  then
    raise exception 'Required checkout functions are missing';
  end if;

  select lower(pg_catalog.pg_get_functiondef(
    'public.create_order_base_v1(text,text,jsonb)'::regprocedure
  )) into checkout_function_definition;

  select lower(pg_catalog.pg_get_functiondef(
    'public.create_order_v1(text,text,jsonb)'::regprocedure
  )) into checkout_wrapper_definition;

  if position('v_request_fingerprint text' in checkout_function_definition) = 0
    or position('v_request_fingerprint := pg_catalog.encode' in checkout_function_definition) = 0
    or position('select o.id, o.request_fingerprint' in checkout_function_definition) = 0
    or position(
      'existing_order.request_fingerprint <> v_request_fingerprint'
      in checkout_function_definition
    ) = 0
  then
    raise exception 'Checkout fingerprint references are not explicitly disambiguated';
  end if;

  if position('customtipcents' in checkout_wrapper_definition) = 0
    or position('custom_tip_value' in checkout_wrapper_definition) = 0
    or position('least(authoritative_subtotal, 50000::bigint)' in checkout_wrapper_definition) = 0
  then
    raise exception 'Checkout wrapper does not authoritatively handle custom tips';
  end if;

  if to_regprocedure('public.prepare_payment_v1(uuid,text,boolean,integer,integer)') is null
    or to_regprocedure('public.reserve_payment_attempt_v1(uuid,text,uuid)') is null
    or to_regprocedure('public.apply_payment_event_v1(uuid)') is null
    or to_regprocedure('public.reserve_refund_v1(uuid,uuid,integer,text,text)') is null
    or to_regprocedure('public.reserve_fake_authorization_action_v1(uuid,text,text,uuid)') is null
    or to_regprocedure('public.reserve_fake_late_success_resolution_v1(uuid,text,text,uuid)') is null
    or to_regprocedure('public.accept_fake_late_success_v1(uuid,text)') is null
    or to_regprocedure('public.record_refund_command_result_v1(uuid,text,text,text,text,text,text,jsonb)') is null
    or to_regprocedure('public.ingest_payment_reconciliation_v1(text,text,text,uuid,jsonb,timestamp with time zone)') is null
    or to_regprocedure('public.touch_payment_reconciliation_v1(uuid,text)') is null
    or to_regprocedure('public.abandon_checkout_v1(uuid,text)') is null
    or to_regprocedure('public.get_restaurant_notification_settings_v1(text)') is null
    or to_regprocedure('public.update_restaurant_notification_settings_v1(text,jsonb,uuid)') is null
    or to_regprocedure('public.claim_notification_outbox_v1(integer)') is null
    or to_regprocedure('public.complete_notification_delivery_v1(uuid,uuid,boolean,boolean,integer,text,text,text)') is null
  then
    raise exception 'Required payment functions are missing';
  end if;

  if has_function_privilege('anon', 'public.create_order_v1(text,text,jsonb)', 'EXECUTE')
    or has_function_privilege('authenticated', 'public.create_order_v1(text,text,jsonb)', 'EXECUTE')
    or has_function_privilege('anon', 'public.create_order_base_v1(text,text,jsonb)', 'EXECUTE')
    or has_function_privilege('authenticated', 'public.create_order_base_v1(text,text,jsonb)', 'EXECUTE')
    or has_function_privilege('anon', 'public.reserve_fake_authorization_action_v1(uuid,text,text,uuid)', 'EXECUTE')
    or has_function_privilege('authenticated', 'public.reserve_fake_authorization_action_v1(uuid,text,text,uuid)', 'EXECUTE')
    or has_function_privilege('anon', 'public.reserve_fake_late_success_resolution_v1(uuid,text,text,uuid)', 'EXECUTE')
    or has_function_privilege('authenticated', 'public.reserve_fake_late_success_resolution_v1(uuid,text,text,uuid)', 'EXECUTE')
    or has_function_privilege('anon', 'public.accept_fake_late_success_v1(uuid,text)', 'EXECUTE')
    or has_function_privilege('authenticated', 'public.accept_fake_late_success_v1(uuid,text)', 'EXECUTE')
    or has_function_privilege('anon', 'public.record_refund_command_result_v1(uuid,text,text,text,text,text,text,jsonb)', 'EXECUTE')
    or has_function_privilege('authenticated', 'public.record_refund_command_result_v1(uuid,text,text,text,text,text,text,jsonb)', 'EXECUTE')
    or has_function_privilege('anon', 'public.ingest_payment_reconciliation_v1(text,text,text,uuid,jsonb,timestamp with time zone)', 'EXECUTE')
    or has_function_privilege('authenticated', 'public.ingest_payment_reconciliation_v1(text,text,text,uuid,jsonb,timestamp with time zone)', 'EXECUTE')
    or has_function_privilege('anon', 'public.touch_payment_reconciliation_v1(uuid,text)', 'EXECUTE')
    or has_function_privilege('authenticated', 'public.touch_payment_reconciliation_v1(uuid,text)', 'EXECUTE')
    or has_function_privilege('anon', 'public.abandon_checkout_v1(uuid,text)', 'EXECUTE')
    or has_function_privilege('authenticated', 'public.abandon_checkout_v1(uuid,text)', 'EXECUTE')
    or has_function_privilege('authenticated', 'public.claim_notification_outbox_v1(integer)', 'EXECUTE')
    or has_function_privilege('anon', 'public.get_restaurant_notification_settings_v1(text)', 'EXECUTE')
  then
    raise exception 'Checkout RPC must not be executable by anon/authenticated';
  end if;

  if not has_function_privilege('service_role', 'public.create_order_v1(text,text,jsonb)', 'EXECUTE')
    or not has_function_privilege('service_role', 'public.record_refund_command_result_v1(uuid,text,text,text,text,text,text,jsonb)', 'EXECUTE')
    or not has_function_privilege('service_role', 'public.ingest_payment_reconciliation_v1(text,text,text,uuid,jsonb,timestamp with time zone)', 'EXECUTE')
    or not has_function_privilege('service_role', 'public.touch_payment_reconciliation_v1(uuid,text)', 'EXECUTE')
    or not has_function_privilege('service_role', 'public.abandon_checkout_v1(uuid,text)', 'EXECUTE')
    or not has_function_privilege('service_role', 'public.claim_notification_outbox_v1(integer)', 'EXECUTE')
    or not has_function_privilege('service_role', 'public.complete_notification_delivery_v1(uuid,uuid,boolean,boolean,integer,text,text,text)', 'EXECUTE')
  then
    raise exception 'service_role cannot execute a required checkout/payment RPC';
  end if;

  if has_function_privilege('service_role', 'public.create_order_base_v1(text,text,jsonb)', 'EXECUTE') then
    raise exception 'service_role must not bypass the authoritative checkout wrapper';
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
