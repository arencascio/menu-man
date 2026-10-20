-- NOT executed by this task. Run only in an isolated test DB containing the
-- activated fixture, or after explicit approval of Staging synthetic writes.
-- Rolls back all order/quota data. Still requires write approval on shared DBs.
begin;
set local lock_timeout='2s';
set local statement_timeout='30s';
do $$
declare
  tenant constant uuid:='20000000-0000-4000-8000-000000000001';
  request jsonb;
  result jsonb;
  replay jsonb;
  key text:=extensions.gen_random_uuid()::text;
  source text:=repeat('b',64);
  slots jsonb;
  before_count integer;
  after_count integer;
begin
  if has_function_privilege('anon','public.create_demo_order_v1(text,text,jsonb,text)','execute')
    or has_function_privilege('authenticated','public.create_demo_order_v1(text,text,jsonb,text)','execute')
  then raise exception 'Public/authenticated access to service-only checkout detected'; end if;
  slots:=public.get_pickup_availability_v1('super-tacos');
  if slots#>>'{scheduled,slots,0,pickupAt}' is null then raise exception 'No demo pickup slot; stop'; end if;
  request:=jsonb_build_object('menuId','20000000-0000-4000-8000-000000000002',
    'items',jsonb_build_array(jsonb_build_object('menuItemId','20000000-0000-4000-8000-000000000201','quantity',1,
      'modifierOptionIds',jsonb_build_array('20000000-0000-4000-8000-000000000601','20000000-0000-4000-8000-000000000607'),'specialInstructions',null)),
    'customer',jsonb_build_object('name','Demo Guest','phone','+12025550142','email','guest@example.invalid'),
    'pickup',jsonb_build_object('mode','scheduled','pickupAt',slots#>>'{scheduled,slots,0,pickupAt}'),
    'tipChoice','none','customTipCents',null,'largeTipConfirmed',false,'largeTipConfirmedSubtotalCents',null,'orderNotes',null);
  result:=public.create_demo_order_v1('super-tacos',key,request,source);
  perform pg_catalog.set_config('menu_man.demo_order_entry','',true);
  begin
    perform public.create_order_v1('super-tacos',extensions.gen_random_uuid()::text,request);
    raise exception 'Legacy checkout bypass was accepted';
  exception when others then if sqlerrm not like '%MM_ORDERING_DISABLED%' then raise; end if; end;
  select sum(creation_count) into before_count from public.checkout_creation_windows where restaurant_id=tenant;
  replay:=public.create_demo_order_v1('super-tacos',key,request,source);
  if result->>'orderId'<>replay->>'orderId' or (replay->>'replayed')::boolean is not true then raise exception 'Replay failed'; end if;
  select sum(creation_count) into after_count from public.checkout_creation_windows where restaurant_id=tenant;
  if before_count<>after_count then raise exception 'Replay consumed quota'; end if;
  begin
    perform public.create_demo_order_v1('super-tacos',key,jsonb_set(request,'{items,0,quantity}','2'),source);
    raise exception 'Conflicting replay was accepted';
  exception when others then if sqlerrm not like '%MM_IDEMPOTENCY_CONFLICT%' then raise; end if; end;
  begin
    perform public.create_demo_order_v1('super-tacos',extensions.gen_random_uuid()::text,
      jsonb_set(request,'{items,0,menuItemId}','"ffffffff-ffff-4fff-8fff-ffffffffffff"'),source);
    raise exception 'Foreign catalog item was accepted';
  exception when others then if sqlerrm not like '%MM_ITEM_NOT_ON_MENU%' then raise; end if; end;
  select sum(creation_count) into after_count from public.checkout_creation_windows where restaurant_id=tenant;
  if before_count<>after_count then raise exception 'Failed order did not roll quota back'; end if;
  insert into public.notification_outbox(restaurant_id,order_id,notification_type,recipient,idempotency_key,payload)
  values(tenant,(result->>'orderId')::uuid,'customer.order_confirmed','nobody@example.invalid','demo-test-'||key,'{}');
  if exists(select 1 from public.notification_outbox where restaurant_id=tenant) then raise exception 'Demo email was queued'; end if;
end;
$$;
rollback;
