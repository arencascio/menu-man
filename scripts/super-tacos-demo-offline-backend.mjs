import { armandoQaTable } from "./fixtures/sprint-d1-armandos.mjs";
// TEST PROCESS ONLY. Never imported by application code. Intercepts the exact
// staging/Square origins without making network requests; rejects other remotes.
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
if (process.env.MENU_MAN_OFFLINE_DEMO_QA !== 'true') throw new Error('Offline QA requires an explicit test process.');
const catalog=JSON.parse(readFileSync(new URL('../supabase/seeds/staging/super-tacos-demo.json',import.meta.url),'utf8'));
catalog.restaurant.theme_overrides=JSON.parse(readFileSync(new URL('../src/lib/demo/theme.json',import.meta.url),'utf8'));
const id=n=>`20000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const tenant=catalog.restaurant.id;
const connectionId=id(900);
const realFetch=globalThis.fetch;
const state=globalThis.__superTacosOfflineState ??= {orders:new Map(), payments:new Map(), attempts:new Map(),square:new Map()};
const items=catalog.items.map(i=>({...i,id:id(200+i.number),restaurant_id:tenant,price_cents:i.price,is_orderable:process.env.MENU_MAN_PUBLIC_SHOWCASE_QA!=='true',source_image_url:i.imageUrl??null,image_path:null}));
const groups=catalog.modifierGroups.map(g=>({...g,id:id(500+g.number),restaurant_id:tenant,is_active:true}));
const options=groups.flatMap(g=>g.options.map((o,n)=>({...o,id:id(600+o.number),restaurant_id:tenant,modifier_group_id:g.id,default_price_adjustment_cents:o.price,sort_order:n,is_active:true,is_default:o.default===true})));
const attachments=items.flatMap(i=>i.groups.map((n,sort)=>{const g=groups.find(v=>v.number===n);return {restaurant_id:tenant,menu_item_id:i.id,modifier_group_id:g.id,min_selections:g.min,max_selections:g.max,sort_order:sort,is_active:true};}));
const r={...catalog.restaurant,is_active:true,is_indexable:false,currency:'USD',primary_domain:null,google_maps_url:null,latitude:null,longitude:null,pickup_url:null,doordash_url:null,instagram_url:null,facebook_url:null};
const now=()=>new Date().toISOString();
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}});
const fail=(code,message)=>json({code:'P0001',message:`MM_${code}|${message}`},400);
function table(name){switch(name){
case 'restaurants':return[r];
case 'menus':return[{id:catalog.menuId,restaurant_id:tenant,name:'Super Tacos Demo Menu',is_published:true}];
case 'menu_sections':return catalog.sections.map(s=>({id:id(s.number),menu_id:catalog.menuId,name:s.name,description:s.description,sort_order:s.sort,is_active:true,menu_section_items:items.filter(i=>i.section===s.number).map(i=>({sort_order:i.number,menu_items:i}))}));
case 'modifier_groups':return groups;
case 'modifier_options':return options;
case 'menu_item_modifier_groups':return attachments;
case 'restaurant_business_hours':return Array.from({length:7},(_,day)=>({restaurant_id:tenant,day_of_week:day,open_time:'09:00:00',close_time:'22:00:00',is_closed:false,sort_order:0}));
case 'restaurant_ordering_settings':return[{restaurant_id:tenant,pickup_enabled:true,asap_enabled:true,scheduled_pickup_enabled:true,customer_name_required:true,customer_email_required:false,customer_phone_required:false}];
case 'restaurant_payment_connections':return[{id:connectionId,restaurant_id:tenant,provider_key:'square',environment:'sandbox',provider_metadata:{publicDemo:true,locationId:'offline-location'},provider_account_reference:'offline-merchant',is_payment_route:true,connection_status:'active'}];
case 'payment_attempts':return [...state.attempts.values()];
case 'orders':return [...state.orders.values()];
case 'restaurant_catering_settings':case 'restaurant_delivery_providers':case 'restaurant_featured_menu_items':case 'menu_item_heart_counts':case 'restaurant_special_hours':case 'menu_item_modifier_option_overrides':return[];
default:throw new Error(`Unhandled offline table ${name}`);
}}
function authorize(p){const order=state.orders.get(p.p_order_id);if(!order||order.token!==p.p_access_token_hash)throw new Error('INVALID_PAYMENT_SESSION');return order;}
function rpc(name,p){
 if(process.env.MENU_MAN_PUBLIC_SHOWCASE_QA==='true'&&!['get_pickup_availability_v1','get_checkout_notification_preferences_v1'].includes(name))throw new Error('Public showcase QA prohibits all state-changing RPCs');
 if(name==='get_pickup_availability_v1')return json({timezone:r.timezone,generatedAt:now(),currentlyOpen:true,asap:{enabled:true,available:true,estimatedPickupAt:new Date(Date.now()+20*60000).toISOString()},scheduled:{enabled:true,slots:Array.from({length:12},(_,n)=>({pickupAt:new Date(Date.now()+(30+n*15)*60000).toISOString()}))}});
 if(name==='get_checkout_notification_preferences_v1')return json({orderConfirmationEnabled:false,readyForPickupEnabled:false});
 if(name==='create_demo_order_v1'){
   const request=p.p_request; const existing=[...state.orders.values()].find(o=>o.key===p.p_idempotency_key);
   if(existing)return JSON.stringify(existing.request)===JSON.stringify(request)?json({...existing.response,replayed:true}):fail('IDEMPOTENCY_CONFLICT','Conflict');
   const lines=request.items.map(line=>{const item=items.find(i=>i.id===line.menuItemId);if(!item)throw new Error('ITEM_NOT_ON_MENU');const selected=line.modifierOptionIds.map(id=>options.find(o=>o.id===id));if(selected.some(o=>!o))throw new Error('INVALID_MODIFIERS');for(const a of attachments.filter(a=>a.menu_item_id===item.id)){const count=selected.filter(o=>o.modifier_group_id===a.modifier_group_id).length;if(count<a.min_selections||count>a.max_selections)throw new Error('INVALID_MODIFIERS');}if(selected.some(o=>!attachments.some(a=>a.menu_item_id===item.id&&a.modifier_group_id===o.modifier_group_id)))throw new Error('INVALID_MODIFIERS');const unit=item.price_cents+selected.reduce((v,o)=>v+o.price,0);return{orderItemId:randomUUID(),menuItemId:item.id,itemName:item.name,quantity:line.quantity,unitPriceCents:unit,lineTotalCents:unit*line.quantity,specialInstructions:line.specialInstructions??null,modifiers:selected.map(o=>({groupName:groups.find(g=>g.id===o.modifier_group_id).name,optionName:o.name,priceAdjustmentCents:o.price}))};});
   const subtotal=lines.reduce((s,l)=>s+l.lineTotalCents,0);const tax=Math.round(subtotal*.0825);const tip=request.tipChoice==='custom'?request.customTipCents||0:Math.round(subtotal*({none:0,'10_percent':.1,'15_percent':.15,'20_percent':.2}[request.tipChoice]??0));
   const orderId=randomUUID();const pickup={mode:request.pickup.mode,pickupAt:request.pickup.pickupAt||new Date(Date.now()+20*60000).toISOString(),timezone:r.timezone};
   const response={orderId,orderNumber:String(state.orders.size+1),orderStatus:'pending_payment',paymentStatus:'unpaid',currency:'USD',subtotalCents:subtotal,taxCents:tax,tipCents:tip,totalCents:subtotal+tax+tip,pickup,items:lines.map(({menuItemId,itemName,quantity,unitPriceCents,lineTotalCents})=>({menuItemId,itemName,quantity,unitPriceCents,lineTotalCents})),replayed:false};
   state.orders.set(orderId,{id:orderId,restaurant_id:tenant,key:p.p_idempotency_key,request,response,lines});return json(response);
 }
 if(name==='prepare_payment_v1'){
   const o=state.orders.get(p.p_order_id);if(!o)throw new Error('PAYMENT_NOT_FOUND');o.token=p.p_access_token_hash;
   const payment={paymentId:randomUUID(),orderId:o.id,connectionId,provider:'square',providerEnvironment:'sandbox',status:'requires_payment_method',orderStatus:'pending_payment',paymentStatus:'unpaid',captureMode:'automatic',amountCents:o.response.totalCents,currency:'USD',paymentDueAt:new Date(Date.now()+30*60000).toISOString(),paidAt:null,latestAttempt:null};state.payments.set(o.id,payment);return json({...payment,sessionExpiresAt:new Date(Date.now()+120*60000).toISOString()});
 }
 if(name==='authorize_payment_session_v1'){const o=authorize(p);return json(state.payments.get(o.id));}
 if(name==='get_order_payment_view_v1'){const o=authorize(p);if(p.p_restaurant_slug!=='super-tacos')throw new Error('PAYMENT_NOT_FOUND');return json({order:{...o.response,items:o.lines,customerEmail:'guest@example.invalid',cancellationReason:null},payment:state.payments.get(o.id)});}
 if(name==='reserve_payment_attempt_v1'){const o=authorize(p);const pay=state.payments.get(o.id);let a=[...state.attempts.values()].find(a=>a.key===p.p_client_attempt_key);if(!a){a={id:randomUUID(),key:p.p_client_attempt_key,order_id:o.id,connection_id:connectionId,created_at:now(),amount_cents:pay.amountCents,currency:'USD'};state.attempts.set(a.id,a);pay.status='processing';pay.latestAttempt={attemptId:a.id,status:'processing',failureCategory:null,failureCode:null,failureMessage:null};}return json({attemptId:a.id,paymentId:pay.paymentId,connectionId,provider:'square',providerEnvironment:'sandbox',providerIdempotencyKey:a.id,amountCents:pay.amountCents,currency:'USD',captureMode:'automatic',replayed:false});}
 if(name==='record_payment_command_result_v1'){const a=state.attempts.get(p.p_attempt_id);a.provider_payment_reference=p.p_provider_payment_reference;return json(null);}
 if(name==='drain_due_payment_webhooks_v1')return json({claimed:0,failed:0,quarantined:0});
 if(name==='ingest_payment_reconciliation_v1'){const a=state.attempts.get(p.p_normalized_event.attemptId);const o=state.orders.get(a.order_id);const pay=state.payments.get(o.id);Object.assign(pay,{status:'succeeded',orderStatus:'placed',paymentStatus:'paid',paidAt:now(),latestAttempt:{...pay.latestAttempt,status:'succeeded'}});Object.assign(o.response,{orderStatus:'placed',paymentStatus:'paid'});return json(null);}
 throw new Error(`Unhandled offline RPC ${name}`);
}
globalThis.fetch=async function(input,init){
 const url=new URL(typeof input==='string'||input instanceof URL?input:input.url);
 if(['localhost','127.0.0.1'].includes(url.hostname))return realFetch(input,init);
 const request=input instanceof Request?input:new Request(input,init);
 if(url.hostname==='jjvongzvtnzlvwdfcnjk.supabase.co'){
  try{if(url.pathname.startsWith('/rest/v1/rpc/'))return rpc(url.pathname.split('/').at(-1),await request.json());
   if(request.method!=='GET')throw new Error('Non-RPC writes prohibited in offline QA');
   const name=url.pathname.split('/').at(-1);
   let rows=(process.env.MENU_MAN_SPRINT_D1_QA==='true' ? armandoQaTable(name,url) : null) ?? table(name);
   for(const [key,val]of url.searchParams){if(val.startsWith('eq.'))rows=rows.filter(r=>String(r[key])===val.slice(3));}
   const accept=request.headers.get('accept')||'';return json(accept.includes('object')?(rows[0]??null):rows);
  }catch(error){return fail(error.message,'Offline test rejected request');}
 }
 if(url.hostname==='connect.squareupsandbox.com'){
  if(request.method==='POST'&&url.pathname==='/v2/payments'){
   const p=await request.json();if(p.source_id!=='cnon:card-nonce-ok')throw new Error('Unexpected demo payment source');
   const payment={id:'offline-'+p.reference_id,status:'COMPLETED',reference_id:p.reference_id,location_id:'offline-location',amount_money:p.amount_money,total_money:p.amount_money,created_at:now(),updated_at:now()};state.square.set(payment.id,payment);return json({payment});
  }
  if(request.method==='GET'&&url.pathname.startsWith('/v2/payments/'))return json({payment:state.square.get(url.pathname.split('/').at(-1))});
 }
 throw new Error(`Offline QA blocked remote request to ${url.hostname}`);
};
