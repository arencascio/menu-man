import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { proxy } from "../../proxy";

const originalEnv = { ...process.env };
const previewEnv = {
  MENU_MAN_UPPER_CRUST_PREVIEW_ENABLED: "true",
  VERCEL: "1",
  VERCEL_ENV: "preview",
  VERCEL_GIT_COMMIT_REF: "feature/upper-crust-protected-preview-v1",
  VERCEL_URL: "menu-preview-123.vercel.app",
  NEXT_PUBLIC_SUPABASE_URL: "https://jjvongzvtnzlvwdfcnjk.supabase.co",
};

function setEnv(values: Record<string, string | undefined>) {
  for (const key of Object.keys(process.env)) if (!(key in values)) delete process.env[key];
  Object.assign(process.env, values);
}

async function request(path: string, method = "GET", host = previewEnv.VERCEL_URL) {
  const url = new URL(path, `https://${host}`);
  return proxy(new NextRequest(url, { method, headers: { host } }));
}

test("protected Preview permits only the allowlisted Upper Crust pages on its exact deployment host", async () => {
  setEnv(previewEnv);
  try {
    for (const path of ["/r/upper-crust", "/r/upper-crust/menu", "/r/upper-crust/checkout", "/r/upper-crust/about", "/r/upper-crust/catering"]) {
      assert.equal((await request(path)).headers.get("x-middleware-next"), "1", path);
      assert.equal((await request(path, "HEAD")).headers.get("x-middleware-next"), "1", path);
      assert.equal((await request(path, "POST")).status, 404, `${path} POST`);
    }
    for (const patch of [
      { VERCEL_ENV: "production" },
      { VERCEL_GIT_COMMIT_REF: "staging" },
      { NEXT_PUBLIC_SUPABASE_URL: "https://fullaiodvmilkdxyxnln.supabase.co" },
      { MENU_MAN_UPPER_CRUST_PREVIEW_ENABLED: "false" },
    ]) {
      setEnv({ ...previewEnv, ...patch });
      assert.equal((await request("/r/upper-crust/menu")).status, 404, JSON.stringify(patch));
    }
    setEnv(previewEnv);
    assert.equal((await request("/r/upper-crust/menu", "GET", "attacker.vercel.app")).status, 404);
  } finally { setEnv(originalEnv); }
});

test("Preview denies every Upper Crust API, reference photo, and unapproved static or optimized image request", async () => {
  setEnv(previewEnv);
  try {
    for (const [path, method] of [
      ["/api/restaurants/upper-crust/orders", "GET"],
      ["/api/restaurants/upper-crust/orders", "POST"],
      ["/api/restaurants/upper-crust/orders", "OPTIONS"],
      ["/api/restaurants/upper-crust/pickup-availability", "GET"],
      ["/r/upper-crust/reference-media/front.jpg", "GET"],
      ["/img/upper-crust/brickwall2.webp", "GET"],
      ["/img/sandwich-shop/storefront-crop.png", "GET"],
      ["/_next/image?url=%252Fimg%252Fupper-crust%252Fupper-crust.png&w=640&q=75", "GET"],
      ["/_next/image?url=%2Fimg%2Fsandwich-shop%2Fstorefront-crop.png&w=640&q=75", "GET"],
      ["/img/icons/Google_Symbol_0.svg", "GET"],
    ]) assert.equal((await request(path, method)).status, 404, `${method} ${path}`);
  } finally { setEnv(originalEnv); }
});

test("Upper Crust gate does not intercept shared restaurant routes", async () => {
  setEnv({ VERCEL: "1", VERCEL_ENV: "preview" });
  try {
    assert.equal((await request("/r/armandos/menu", "GET", "localhost:3000")).headers.get("x-middleware-next"), "1");
    for (const path of ["/img/super-tacos/approved/social/facebook.png", "/img/super-tacos/approved/social/instagram.png"]) {
      assert.equal((await request(path, "GET", "localhost:3000")).headers.get("x-middleware-next"), "1", path);
    }
  } finally { setEnv(originalEnv); }
});
