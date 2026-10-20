// Local fixture UI only; no real credentials, Supabase calls or Square payments.
import { spawn } from 'node:child_process';
const preload=new URL('./super-tacos-demo-offline-backend.mjs',import.meta.url).href;
const demoConfig={SQUARE_DEMO_SANDBOX_APPLICATION_ID:'offline-application',SQUARE_DEMO_SANDBOX_ACCESS_TOKEN:'offline-dummy-token',SQUARE_DEMO_SANDBOX_MERCHANT_ID:'offline-merchant',SQUARE_DEMO_SANDBOX_LOCATION_ID:'offline-location',SQUARE_DEMO_SANDBOX_WEBHOOK_SIGNATURE_KEY:'offline-webhook-key',SQUARE_DEMO_SANDBOX_WEBHOOK_NOTIFICATION_URL:'https://offline.invalid/api/webhooks/payments/square/demo-sandbox'};
const command=process.argv[2]==='build'?'build':'dev';
const child=spawn(process.execPath,['--import',preload,'node_modules/next/dist/bin/next',command,...(command==='dev'?['--hostname','127.0.0.1','--port','3000']:[])],{
 stdio:'inherit',env:{...process.env,...demoConfig,MENU_MAN_OFFLINE_DEMO_QA:'true',NEXT_PUBLIC_SUPABASE_URL:'https://jjvongzvtnzlvwdfcnjk.supabase.co',NEXT_PUBLIC_SUPABASE_ANON_KEY:'offline-public-key',NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'offline-public-key',SUPABASE_SERVICE_ROLE_KEY:'offline-only-dummy-service-role-key',MENU_MAN_ENV:'staging',MENU_MAN_ENABLE_PUBLIC_DEMO_PAYMENTS:'true',MENU_MAN_ENABLE_SQUARE_SANDBOX:'true',SQUARE_API_VERSION:'2026-08-19',SQUARE_SANDBOX_APPLICATION_ID:'offline-application',SQUARE_SANDBOX_ACCESS_TOKEN:'offline-dummy-token',SQUARE_SANDBOX_MERCHANT_ID:'offline-merchant',SQUARE_SANDBOX_LOCATION_ID:'offline-location',SQUARE_SANDBOX_WEBHOOK_SIGNATURE_KEY:'offline-webhook-key',SQUARE_SANDBOX_WEBHOOK_NOTIFICATION_URL:'https://offline.invalid/api/webhooks/payments/square/sandbox',VERCEL_ENV:'',RESEND_API_KEY:'',MENU_MAN_ORDER_EMAIL_FROM:''}
});
child.on('exit',code=>process.exit(code??1));
