-- DEVELOPMENT BRANCH ONLY. Invoked inside the guarded Node runner transaction.
-- Never a migration/automatic seed. Requires a fresh branch WITHOUT copied data.
do $$
begin
  if coalesce(current_setting('menu_man.isolated_branch', true), '') !~ '^[a-z]{20}$'
    or current_setting('menu_man.isolated_branch') in ('jjvongzvtnzlvwdfcnjk','fullaiodvmilkdxyxnln')
    or current_setting('menu_man.isolated_host', true) is distinct from
       'db.' || current_setting('menu_man.isolated_branch') || '.supabase.co'
    or current_setting('menu_man.isolated_approval', true) is distinct from
       'disposable-super-tacos:' || current_setting('menu_man.isolated_branch')
  then raise exception 'Isolated development branch confirmation required'; end if;
  if exists(select 1 from public.restaurants)
    or exists(select 1 from public.orders)
    or exists(select 1 from public.notification_outbox)
    or exists(select 1 from public.restaurant_payment_connections)
    or exists(select 1 from auth.users)
  then raise exception 'Fresh data-less branch required; discard this branch after testing'; end if;
end;
$$;

insert into public.restaurants(id,name,slug,currency,is_active,is_indexable,timezone)
values('20000000-0000-4000-8000-000000000001','Isolated quota test','super-tacos','USD',true,false,'UTC');
insert into public.menus(id,restaurant_id,name,is_published)
values('20000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001','Synthetic menu',true);
insert into public.menu_sections(id,menu_id,name)
values('20000000-0000-4000-8000-000000000101','20000000-0000-4000-8000-000000000002','Synthetic section');
insert into public.menu_items(id,restaurant_id,name,price_cents,is_orderable)
values('20000000-0000-4000-8000-000000000201','20000000-0000-4000-8000-000000000001','Synthetic taco',375,true);
insert into public.menu_section_items(id,section_id,item_id)
values('20000000-0000-4000-8000-000000000301','20000000-0000-4000-8000-000000000101','20000000-0000-4000-8000-000000000201');
insert into public.modifier_groups(id,restaurant_id,name) values
('20000000-0000-4000-8000-000000000501','20000000-0000-4000-8000-000000000001','Synthetic salsa'),
('20000000-0000-4000-8000-000000000503','20000000-0000-4000-8000-000000000001','Synthetic tortilla');
insert into public.modifier_options(id,restaurant_id,modifier_group_id,name) values
('20000000-0000-4000-8000-000000000601','20000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000501','Test salsa'),
('20000000-0000-4000-8000-000000000607','20000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000503','Test tortilla');
insert into public.menu_item_modifier_groups(restaurant_id,menu_item_id,modifier_group_id,min_selections,max_selections) values
('20000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000201','20000000-0000-4000-8000-000000000501',1,1),
('20000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000201','20000000-0000-4000-8000-000000000503',1,1);
insert into public.restaurant_business_hours(restaurant_id,day_of_week,open_time,close_time,is_closed,sort_order)
select '20000000-0000-4000-8000-000000000001',day,'00:00'::time,'23:59'::time,false,0 from generate_series(0,6) day;
insert into public.restaurant_ordering_settings(restaurant_id,pickup_enabled,asap_enabled,scheduled_pickup_enabled,
  pickup_lead_time_minutes,pickup_cutoff_minutes_before_close,pickup_slot_interval_minutes,advance_order_days,
  pickup_max_orders_per_interval,tax_strategy,tax_rate_basis_points,customer_name_required,customer_email_required,customer_phone_required)
values('20000000-0000-4000-8000-000000000001',true,false,true,0,0,15,2,1000,'restaurant_percentage',0,true,false,false);
insert into public.restaurant_notification_settings(restaurant_id,customer_order_confirmation_email,
  customer_ready_for_pickup_email,customer_refund_confirmation_email,internal_new_paid_order_email,
  internal_payment_refund_exception_email,internal_email_recipient)
values('20000000-0000-4000-8000-000000000001',false,false,false,false,false,null);
