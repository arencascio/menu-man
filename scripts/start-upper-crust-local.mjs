// Loopback only. No real credentials, database, payments, mail or analytics.
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const mode = process.argv[2] || 'dev';
if (!['dev', 'build', 'start'].includes(mode)) throw new Error('Expected dev, build or start');
const env = { ...process.env,
  MENU_MAN_UPPER_CRUST_LOCAL: 'true', MENU_MAN_ENV: 'staging',
  NEXT_PUBLIC_SUPABASE_URL: 'https://jjvongzvtnzlvwdfcnjk.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'local-concept-placeholder-not-a-credential',
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: '', NEXT_PUBLIC_SUPABASE_ANON_KEY: '',
  NEXT_PUBLIC_POSTHOG_KEY: '', NEXT_PUBLIC_GA_MEASUREMENT_ID: '', NEXT_PUBLIC_ANALYTICS_PROVIDER: '',
  RESEND_API_KEY: '', MENU_MAN_ORDER_EMAIL_FROM: '',
  MENU_MAN_ENABLE_PUBLIC_DEMO_PAYMENTS: 'false', MENU_MAN_ENABLE_SQUARE_SANDBOX: 'false',
  // Runtime only: keep reference photos out of the build trace/deployment bundle.
  MENU_MAN_UPPER_CRUST_MEDIA_ROOT: mode === 'build' ? '' : fileURLToPath(new URL('../.local-reference-media/upper-crust/', import.meta.url)),
};
if (env.VERCEL || env.VERCEL_ENV) throw new Error('Upper Crust concept is local only');
const child = spawn(process.execPath, ['--import', new URL('./upper-crust-offline-guard.mjs', import.meta.url).href, 'node_modules/next/dist/bin/next', mode, ...(mode === 'build' ? [] : ['--hostname', '127.0.0.1', '--port', '3212'])], { stdio: 'inherit', env });
child.on('exit', code => process.exit(code ?? 1));
