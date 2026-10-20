-- Read-only verification after separately approved Staging activation.
begin read only;
select id,slug,is_active,is_indexable,theme_preset from public.restaurants
where id='20000000-0000-4000-8000-000000000001';
select count(*) as expected_30_orderable_items from public.menu_items
where restaurant_id='20000000-0000-4000-8000-000000000001' and is_orderable;
select provider_key,environment,is_payment_route,connection_status,
  provider_metadata->>'publicDemo' as demo_marker,
  credential_secret_ref='vercel-env:SQUARE_DEMO_SANDBOX_ACCESS_TOKEN' as dedicated_credentials
from public.restaurant_payment_connections where restaurant_id='20000000-0000-4000-8000-000000000001';
select pg_get_userbyid(proowner) as function_owner,prosecdef,proconfig,
  has_function_privilege('anon',oid,'execute') as anon_must_be_false,
  has_function_privilege('authenticated',oid,'execute') as authenticated_must_be_false,
  has_function_privilege('service_role',oid,'execute') as service_must_be_true
from pg_proc where oid='public.create_demo_order_v1(text,text,jsonb,text)'::regprocedure;
select tgname,tgenabled from pg_trigger where tgname in ('suppress_super_tacos_demo_email','guard_super_tacos_demo_order');
select conname,pg_get_constraintdef(oid) from pg_constraint
where conname in ('super_tacos_demo_no_email','super_tacos_demo_sandbox_only');
select count(*) as must_be_zero_outbox_rows from public.notification_outbox
where restaurant_id='20000000-0000-4000-8000-000000000001';
rollback;
