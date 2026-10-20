import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import * as policy from "./policy";
import * as contracts from "../checkout/contracts";
import * as paymentContracts from "../payments/contracts";
import * as crypto from "node:crypto";

const env = { MENU_MAN_ENV: "staging", VERCEL_ENV: "preview", MENU_MAN_ENABLE_PUBLIC_DEMO_PAYMENTS: "true",
  MENU_MAN_ENABLE_SQUARE_SANDBOX: "true", NEXT_PUBLIC_SUPABASE_URL: "https://jjvongzvtnzlvwdfcnjk.supabase.co" };
const connection = { restaurant_id: policy.SUPER_TACOS_ID, provider_key: "square", environment: "sandbox", provider_metadata: { publicDemo: true } };

test("demo activation requires every staging and opt-in boundary", () => {
  assert.equal(policy.demoRuntimeAllowed(env), true);
  for (const key of Object.keys(env)) {
    const missing = { ...env, [key]: undefined };
    // A localhost staging server need not have VERCEL_ENV.
    assert.equal(policy.demoRuntimeAllowed(missing), key === "VERCEL_ENV", key);
  }
  for (const change of [
    { MENU_MAN_ENV: "production" }, { VERCEL_ENV: "production" },
    { NEXT_PUBLIC_SUPABASE_URL: "https://fullaiodvmilkdxyxnln.supabase.co" },
    { NEXT_PUBLIC_SUPABASE_URL: "https://jjvongzvtnzlvwdfcnjk.supabase.co.evil.test" },
    { NEXT_PUBLIC_SUPABASE_URL: "http://jjvongzvtnzlvwdfcnjk.supabase.co" },
    { NEXT_PUBLIC_SUPABASE_URL: "https://jjvongzvtnzlvwdfcnjk.supabase.co:9999" },
    { MENU_MAN_ENABLE_PUBLIC_DEMO_PAYMENTS: "false" },
  ]) assert.equal(policy.demoRuntimeAllowed({ ...env, ...change }), false);
});

test("demo payment requires the fixed tenant, explicit metadata, Square and Sandbox", () => {
  assert.equal(policy.demoConnectionPolicy(connection, env), true);
  for (const change of [{ environment: "production" }, { provider_key: "fake" }, { provider_metadata: {} }, { restaurant_id: "other-tenant" }]) {
    assert.throws(() => policy.demoConnectionPolicy({ ...connection, ...change }, env));
  }
  assert.throws(() => policy.demoConnectionPolicy(connection, { ...env, VERCEL_ENV: "production" }));
  assert.equal(policy.demoConnectionPolicy({ ...connection, restaurant_id: "other", provider_metadata: {} }, env), false);
});

test("only a fixed server-selected Square test source can pay the demo", () => {
  assert.equal(policy.paymentSourceForPolicy(true, policy.DEMO_PAYMENT_TOKEN), "cnon:card-nonce-ok");
  for (const source of ["cnon:card-nonce-ok", "cnon:real-token", "fake:success", "4111111111111111", ""]) {
    assert.throws(() => policy.paymentSourceForPolicy(true, source));
  }
  assert.throws(() => policy.paymentSourceForPolicy(false, policy.DEMO_PAYMENT_TOKEN));
  assert.equal(policy.paymentSourceForPolicy(false, "ordinary-payment-token"), "ordinary-payment-token");
});

function checkoutHarness(options: { env?: Record<string,string|undefined>; error?: {code:string;message:string}; configurationFailure?: boolean } = {}) {
  const calls: {name:string; args:Record<string,unknown>}[]=[];
  const exported: Record<string, (...args: unknown[]) => Promise<unknown>> = {};
  const code=ts.transpileModule(readFileSync("src/lib/checkout/server.ts","utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const modules: Record<string,unknown> = {"server-only":{},"./contracts":contracts,
    "@/lib/demo/policy":policy,"@/lib/demo/server":{verifyDemoCheckoutConfiguration:async()=>{if(options.configurationFailure)throw new Error("unconfigured");}},
    "@/lib/supabase/server":{supabaseServer:{rpc:async(name:string,args:Record<string,unknown>)=>{
      calls.push({name,args}); return options.error ? {error:options.error,data:null} : {error:null,data:{orderId:"20000000-0000-4000-8000-000000001001",orderNumber:"1",orderStatus:"pending_payment",paymentStatus:"unpaid",currency:"USD",subtotalCents:375,taxCents:31,tipCents:0,totalCents:406,pickup:{mode:"asap",pickupAt:"2026-10-20T20:00:00Z",timezone:"America/Los_Angeles"},items:[],replayed:false}};
    }}}};
  vm.runInNewContext(code,{exports:exported,require:(name:string)=>{if(!(name in modules))throw new Error(name);return modules[name];},process:{env:options.env??env},console:{error(){}}});
  return { calls, create:exported.createAuthoritativeOrder };
}
const request = {menuId:"20000000-0000-4000-8000-000000000002",items:[],customer:{name:"PRIVATE",phone:"PRIVATE",email:"PRIVATE"},pickup:{mode:"asap"},tipChoice:"none"};
test("disabled/misconfigured demo fails before creating any order", async()=>{
  for(const options of [{env:{...env,MENU_MAN_ENABLE_PUBLIC_DEMO_PAYMENTS:"false"}},{configurationFailure:true}]) {
    const h=checkoutHarness(options); await assert.rejects(h.create("super-tacos","key",request,"a".repeat(64)),/Demo/); assert.equal(h.calls.length,0);
  }
  const h=checkoutHarness();await assert.rejects(h.create("super-tacos","key",request,null),/source/);assert.equal(h.calls.length,0);
});
test("demo uses durable limiter and replaces entered contact data",async()=>{
  const h=checkoutHarness();await h.create("super-tacos","key",request,"a".repeat(64));
  assert.equal(h.calls[0].name,"create_demo_order_v1");
  assert.equal(h.calls[0].args.p_source_hash,"a".repeat(64));
  assert.deepEqual(JSON.parse(JSON.stringify(h.calls[0].args.p_request)).customer,policy.DEMO_CUSTOMER);
});
test("missing demo limiter never falls back to unbounded order creation",async()=>{
  const h=checkoutHarness({error:{code:"PGRST202",message:"missing RPC"}});
  await assert.rejects(h.create("super-tacos","key",request,"a".repeat(64)));
  assert.deepEqual(h.calls.map(c=>c.name),["create_demo_order_v1"]);
});
test("ordinary tenant checkout retains its original RPC and payload",async()=>{
  const h=checkoutHarness();await h.create("ordinary-tenant","key",request,null);
  assert.equal(h.calls[0].name,"create_order_v1");assert.equal(h.calls[0].args.p_request,request);
});
test("catalog is internally complete, uses preserved item identities and local real-photo assets",()=>{
  const data=JSON.parse(readFileSync("supabase/seeds/staging/super-tacos-demo.json","utf8"));
  assert.equal(data.restaurant.id,policy.SUPER_TACOS_ID);assert.equal(data.items.length,30);
  assert.equal(new Set(data.items.map((i:{number:number})=>i.number)).size,30);
  assert.equal(data.sections.length,6);
  for(const i of data.items){assert.ok(Number.isSafeInteger(i.price)&&i.price>0);assert.ok(data.sections.some((s:{number:number})=>s.number===i.section));for(const g of i.groups)assert.ok(data.modifierGroups.some((v:{number:number})=>v.number===g));if(i.image)assert.ok(existsSync(`public/img/super-tacos/${i.image}.jpg`));}
  assert.deepEqual(data.items.slice(0,3).map((i:{key:string})=>i.key),["carne-asada-taco","al-pastor-taco","mushroom-taco"]);
  const photos=JSON.parse(readFileSync("public/img/super-tacos/sources.json","utf8"));assert.equal(photos.length,8);
  for(const photo of photos){assert.match(photo.license,/pexels.com\/license|unsplash.com\/license/);assert.match(photo.sha256,/^[0-9a-f]{64}$/);}
});

function paymentHarness(demo: boolean, denied = false) {
  const calls: {name:string;args:Record<string,unknown>}[]=[];
  const gateway: Record<string,unknown>[]=[];
  const status={paymentId:"20000000-0000-4000-8000-000000001001",orderId:"20000000-0000-4000-8000-000000001002",connectionId:"20000000-0000-4000-8000-000000000900",provider:"square",providerEnvironment:"sandbox",status:"requires_payment_method",orderStatus:"pending_payment",paymentStatus:"unpaid",captureMode:"automatic",amountCents:595,currency:"USD",paymentDueAt:"2026-10-20T20:00:00Z",paidAt:null,latestAttempt:null};
  const reserved={attemptId:"20000000-0000-4000-8000-000000001003",paymentId:status.paymentId,connectionId:status.connectionId,provider:"square",providerEnvironment:"sandbox",providerIdempotencyKey:"server-key",amountCents:595,currency:"USD",captureMode:"automatic",replayed:false};
  const adapter=({createPayment:async(input:Record<string,unknown>)=>{gateway.push(input);return{status:"processing",providerStatus:"COMPLETED",providerPaymentReference:"sandbox-only"};},createBrowserSession:async()=>({mode:"embedded",provider:"square",publicConfig:{cardsOnly:true}})});
  const modules:Record<string,unknown>={"server-only":{},"node:crypto":crypto,"./contracts":paymentContracts,
    "./registry":{getPaymentProvider:()=>adapter},
    "./providers/fake/adapter":{},"./runtime":{isSquareSandboxRuntimeEnabled:()=>true},"./state":{shouldExpirePaymentOnStatusRead:()=>false},"./view-contracts":{},
    "@/lib/demo/policy":policy,"@/lib/demo/server":{demoSquareProvider:()=>adapter,isDemoPaymentConnection:async()=>{if(denied)throw new Error("unauthorized config");return demo;}},
    "@/lib/supabase/server":{supabaseServer:{rpc:async(name:string,args:Record<string,unknown>)=>{
      calls.push({name,args});if(name==="authorize_payment_session_v1")return{data:status,error:null};
      if(name==="reserve_payment_attempt_v1")return{data:reserved,error:null};
      return{data:null,error:null};
    }}}};
  const exported:Record<string,(...args:unknown[])=>Promise<unknown>>={};
  const code=ts.transpileModule(readFileSync("src/lib/payments/server.ts","utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  vm.runInNewContext(code,{exports:exported,require:(name:string)=>{if(!(name in modules))throw new Error(name);return modules[name];},process:{env},console});
  return{calls,gateway,submit:exported.submitPayment,session:exported.getPaymentSession};
}
test("demo payment validates before reservation and forwards only the authoritative amount/test source",async()=>{
  const h=paymentHarness(true);
  await h.submit("order","capability","client-key",policy.DEMO_PAYMENT_TOKEN);
  assert.equal(h.gateway.length,1);assert.equal(h.gateway[0].paymentMethodToken,policy.SQUARE_DEMO_SOURCE);
  assert.equal(h.gateway[0].amountCents,595);assert.equal(h.gateway[0].providerIdempotencyKey,"server-key");
  assert.equal(h.gateway[0].environment,"sandbox");
});
test("wrong demo sources, wrong tenant sentinel and configuration denial never reserve or contact Square",async()=>{
  for(const [demo,token,denied] of [[true,"real-token",false],[false,policy.DEMO_PAYMENT_TOKEN,false],[true,policy.DEMO_PAYMENT_TOKEN,true]] as const){
    const h=paymentHarness(demo,denied);await assert.rejects(h.submit("order","capability","client-key",token));
    assert.deepEqual(h.calls.map(c=>c.name),["authorize_payment_session_v1"]);assert.equal(h.gateway.length,0);
  }
});
test("demo browser session cannot expose the normal Square card-entry configuration",async()=>{
  const h=paymentHarness(true);const session=await h.session("order","capability") as {browserSession:{publicConfig:object}};
  assert.deepEqual(JSON.parse(JSON.stringify(session.browserSession.publicConfig)),{demoPayment:true});
  const ordinary=paymentHarness(false);const other=await ordinary.session("order","capability") as {browserSession:{publicConfig:object}};
  assert.deepEqual(JSON.parse(JSON.stringify(other.browserSession.publicConfig)),{cardsOnly:true});
});

test("demo Sandbox configuration never borrows another tenant's credentials",()=>{
  const exported:Record<string,()=>{accessToken:string;locationId:string}>={};
  const values:Record<string,string>={SQUARE_API_VERSION:"2026-08-19",SQUARE_SANDBOX_APPLICATION_ID:"original-app",SQUARE_SANDBOX_ACCESS_TOKEN:"original-token",SQUARE_SANDBOX_MERCHANT_ID:"original-merchant",SQUARE_SANDBOX_LOCATION_ID:"original-location",SQUARE_SANDBOX_WEBHOOK_SIGNATURE_KEY:"original-key",SQUARE_SANDBOX_WEBHOOK_NOTIFICATION_URL:"https://original.invalid/webhook"};
  const code=ts.transpileModule(readFileSync("src/lib/payments/providers/square/config.ts","utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  vm.runInNewContext(code,{exports:exported,require:()=>({isSquareSandboxRuntimeEnabled:()=>true}),process:{env:values}});
  assert.equal(exported.requireSquareSandboxConfig().accessToken,"original-token");
  assert.throws(()=>exported.requireSquareDemoSandboxConfig(),/SQUARE_DEMO_SANDBOX/);
  for(const [key,value]of Object.entries({...values}))if(key.startsWith("SQUARE_SANDBOX_"))values[key.replace("SQUARE_SANDBOX_","SQUARE_DEMO_SANDBOX_")]=value.replace("original","demo");
  assert.equal(exported.requireSquareDemoSandboxConfig().accessToken,"demo-token");
  assert.equal(exported.requireSquareSandboxConfig().locationId,"original-location");
});

function webhookHarness(enabled=true,invalid=false){
  const calls:unknown[][]=[];
  class SignatureError extends Error {}
  const exported:Record<string,(request:Request)=>Promise<Response>>={};
  const modules:Record<string,unknown>={"next/server":{NextResponse:class extends Response{static json=Response.json;}},
    "@/lib/demo/policy":{demoRuntimeAllowed:()=>enabled},
    "@/lib/payments/providers/square/webhook":{InvalidSquareWebhookError:SignatureError},
    "@/lib/payments/server":{acceptPaymentWebhook:async(...args:unknown[])=>{calls.push(args);if(invalid)throw new SignatureError();return[];},processDuePaymentEvents:async()=>null},
    "@/lib/payments/webhook-acknowledgement":{acknowledgeStoredPaymentWebhook:async(store:()=>Promise<unknown>,drain:()=>Promise<unknown>)=>{const result=await store();await drain();return result;}}};
  const code=ts.transpileModule(readFileSync("src/app/api/webhooks/payments/square/demo-sandbox/route.ts","utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  vm.runInNewContext(code,{exports:exported,require:(name:string)=>modules[name],process:{env},console,Buffer,Response,TextEncoder,setTimeout,clearTimeout});
  return{post:exported.POST,calls};
}
test("demo webhook stays hidden until explicit activation",async()=>{
  const h=webhookHarness(false);assert.equal((await h.post(new Request("https://preview.invalid/webhook",{method:"POST",body:"{}"}))).status,404);assert.equal(h.calls.length,0);
});
test("demo webhook bounds chunked bodies before signature verification",async()=>{
  const h=webhookHarness();assert.equal((await h.post(new Request("https://preview.invalid/webhook",{method:"POST",body:"x".repeat(70000)}))).status,413);assert.equal(h.calls.length,0);
});
test("demo webhook uses the dedicated verification scope and rejects invalid signatures",async()=>{
  const h=webhookHarness();assert.equal((await h.post(new Request("https://preview.invalid/webhook",{method:"POST",body:"{}"}))).status,200);assert.equal(h.calls[0][0],"square");assert.equal(h.calls[0][3],true);
  const bad=webhookHarness(true,true);assert.equal((await bad.post(new Request("https://preview.invalid/webhook",{method:"POST",body:"{}"}))).status,403);
});
