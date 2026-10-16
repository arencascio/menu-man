import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createLeadHandler, createLeadLimiter } from "./handler";
import { createLeadSubmitter, initialLeadState, leadFallback, leadFormReducer } from "./client";
import { normalizeWebsite } from "./website";
import { leadSchema } from "./contracts";

const id = "20000000-0000-4000-8000-000000000999";
const inquiry = { type: "website", submissionId: id, restaurantName: "Tacos <&>", email: "owner@example.com", help: "Build my first website", notes: "<script>sample</script>" };
const request = (body: unknown = inquiry, headers: Record<string, string> = {}) => new Request("https://getmenuman.com/api/marketing/leads", {
  method: "POST", headers: { origin: "https://getmenuman.com", "Content-Type": "application/json", ...headers }, body: JSON.stringify(body),
});

const validWebsites = [
  ["restaurant.com", "https://restaurant.com"],
  ["www.restaurant.com", "https://www.restaurant.com"],
  [" menu.restaurant.co.uk/food/tacos?day=Friday#specials ", "https://menu.restaurant.co.uk/food/tacos?day=Friday#specials"],
  ["tacos.restaurant/menu", "https://tacos.restaurant/menu"],
  ["café.com/menu", "https://café.com/menu"],
  ["http://restaurant.com/menu", "http://restaurant.com/menu"],
  ["https://www.restaurant.com/menu", "https://www.restaurant.com/menu"],
  ["", ""],
] as const;
const invalidWebsites = [
  "restaurant", "restaurant.c", "restaurant.", ".com", "restaurant..com", "-restaurant.com", "restaurant-.com",
  "https://", "https:///restaurant.com", "http:restaurant.com", "//restaurant.com",
  "ftp://restaurant.com", "javascript:alert(1)", "mailto:owner@restaurant.com", "owner@restaurant.com",
  "https://owner:password@restaurant.com", "restaurant .com", "restaurant.com/bad path", "restaurant.com/%zz",
  "restaurant.com\\menu", "https://localhost", "https://127.0.0.1", "restaurant.com:99999", `${"a".repeat(64)}.com`,
  `restaurant.com/${"a".repeat(500)}`,
];

test("shared website rules normalize ordinary domains and preserve explicit HTTP(S), paths and optional emptiness", () => {
  for (const [input, expected] of validWebsites) {
    assert.equal(normalizeWebsite(input), expected, input);
    const parsed = leadSchema.safeParse({ ...inquiry, website: input });
    assert.equal(parsed.success, true, input);
    if (parsed.success) assert.equal(parsed.data.website, expected);
  }
  assert.equal(leadSchema.safeParse({ ...inquiry, type: "review", noWebsite: true }).success, true);
  assert.equal(leadSchema.safeParse({ ...inquiry, type: "review", website: "" }).success, false);
});

test("malformed, incomplete and unsupported website addresses fail on both client and server", async () => {
  let calls = 0;
  const submit = createLeadSubmitter(async () => { calls++; return Response.json({ accepted: true }); }, () => id);
  const send = createLeadHandler({ apiKey: "mock-secret", from: "verified@example.com", allow: () => true,
    fetcher: async () => { calls++; return Response.json({ id: "unexpected" }); } });
  for (const website of invalidWebsites) {
    assert.equal(normalizeWebsite(website), null, website);
    assert.ok("error" in await submit({ website }, "review"), website);
    assert.equal((await send(request({ ...inquiry, type: "review", website }))).status, 400, website);
  }
  assert.equal(calls, 0);
});

test("both form types normalize before sending and retain raw website values after delivery failure", async () => {
  for (const type of ["website", "review"] as const) {
    const values = { restaurantName: "Tacos", email: "owner@example.com", help: "Website", website: "www.restaurant.com/menu" };
    const original = { ...values };
    const submit = createLeadSubmitter(async (_url, init) => {
      const body = JSON.parse(init!.body as string);
      assert.equal(body.website, "https://www.restaurant.com/menu");
      assert.equal(body.type, type);
      return Response.json({ error: "Temporary failure" }, { status: 502 });
    }, () => id);
    assert.ok("error" in await submit(values, type));
    assert.deepEqual(values, original);
    const state = leadFormReducer({ ...initialLeadState, values }, { type: "failed", error: "Retry" });
    assert.equal(state.values.website, original.website);
    assert.equal(state.accepted, false);
  }
});

test("server independently normalizes website addresses in delivered emails for both request types", async () => {
  const websites: string[] = [];
  const send = createLeadHandler({ apiKey: "mock-secret", from: "verified@example.com", allow: () => true,
    fetcher: async (_url, init) => {
      const message = JSON.parse(init!.body as string);
      websites.push(message.text.match(/Website: (.*)/)[1]);
      assert.equal(message.reply_to, inquiry.email);
      assert.deepEqual(message.to, ["hello@getmenuman.com"]);
      return Response.json({ id: "mock-message" });
    } });
  for (const type of ["website", "review"] as const) {
    for (const website of ["restaurant.com/menu", "http://restaurant.com/menu"]) {
      assert.equal((await send(request({ ...inquiry, type, website }))).status, 200);
    }
  }
  assert.deepEqual(websites, ["https://restaurant.com/menu", "http://restaurant.com/menu", "https://restaurant.com/menu", "http://restaurant.com/menu"]);
});

test("both submission types use customer Reply-To, the fixed recipient, escaped content, and stable provider keys", async () => {
  const keys: string[] = [];
  const subjects: string[] = [];
  const send = createLeadHandler({ apiKey: "mock-secret", from: "Menu Man <hello@getmenuman.com>", fetcher: async (_url, init) => {
    const message = JSON.parse(init!.body as string);
    assert.deepEqual(message.to, ["hello@getmenuman.com"]);
    assert.equal(message.from, "Menu Man <hello@getmenuman.com>");
    assert.equal(message.reply_to, "owner@example.com");
    assert.ok(message.text.includes("owner@example.com"));
    assert.match(message.html, /&lt;script&gt;sample&lt;\/script&gt;/);
    assert.doesNotMatch(message.html, /<script>/);
    assert.match(message.subject, /Build My Website inquiry|Free Website Review request/);
    subjects.push(message.subject);
    keys.push(new Headers(init!.headers).get("Idempotency-Key")!);
    return Response.json({ id: "mock-message" });
  } });
  for (const body of [inquiry, inquiry, { ...inquiry, submissionId: "20000000-0000-4000-8000-000000000998", type: "review", noWebsite: true }]) {
    const response = await send(request(body));
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { accepted: true });
  }
  assert.equal(keys[0], keys[1]);
  assert.notEqual(keys[0], keys[2]);
  assert.deepEqual(subjects, ["Menu Man: Build My Website inquiry", "Menu Man: Build My Website inquiry", "Menu Man: Free Website Review request"]);
});

test("missing configuration and provider/network/malformed failures never report acceptance", async () => {
  for (const configuration of [{}, { apiKey: "secret" }, { from: "verified@example.com" }]) {
    let called = false;
    const missing = createLeadHandler({ ...configuration, fetcher: async () => { called = true; throw Error("must not send"); } });
    assert.equal((await missing(request())).status, 503);
    assert.equal(called, false);
  }
  for (const fetcher of [
    async () => Response.json({ message: "private provider detail" }, { status: 500 }),
    async () => Response.json({}),
    async () => Response.json({ id: "" }),
    async () => { throw Error("private credential detail"); },
  ]) {
    const send = createLeadHandler({ apiKey: "secret", from: "verified@example.com", fetcher });
    const response = await send(request());
    assert.equal(response.status, 502);
    const text = await response.text();
    assert.doesNotMatch(text, /accepted|private|secret/);
  }
});

test("validation, origin, honeypot, body size and rate limits reject before provider delivery", async () => {
  let calls = 0;
  const send = createLeadHandler({ apiKey: "secret", from: "verified@example.com", allow: () => true, fetcher: async () => { calls++; return Response.json({ id: "unexpected" }); } });
  for (const body of [
    { ...inquiry, email: "bad" }, { ...inquiry, restaurantName: " " },
    { ...inquiry, notes: "x".repeat(2001) }, { ...inquiry, phone: "x".repeat(51) },
    { ...inquiry, to: "attacker@example.com" }, { ...inquiry, from: "attacker@example.com" },
    { ...inquiry, reply_to: "attacker@example.com" }, { ...inquiry, companyFax: "bot" },
    { ...inquiry, email: "owner@example.com\r\nBcc: attacker@example.com" },
    { ...inquiry, type: "review", website: "javascript:alert(1)" },
    { ...inquiry, type: "review", website: "", noWebsite: false },
  ]) assert.equal((await send(request(body))).status, 400);
  assert.equal((await send(request(inquiry, { origin: "https://attacker.example" }))).status, 403);
  assert.equal((await send(request(inquiry, { "Content-Type": "text/plain" }))).status, 415);
  assert.equal((await send(request({ ...inquiry, notes: "x".repeat(17000) }))).status, 413);
  assert.equal(calls, 0);
  const allow = createLeadLimiter();
  for (let i = 0; i < 5; i++) assert.equal(allow("ip", 0), true);
  assert.equal(allow("ip", 1), false);
  assert.equal(allow("ip", 900001), true);
  const limited = await createLeadHandler({ allow: () => false })(request());
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get("Retry-After"), "900");
});

test("client prevents concurrent duplicates and reuses retry identity for unchanged details", async () => {
  let release!: (value: Response) => void;
  const bodies: Array<{ submissionId: string }> = [];
  const submit = createLeadSubmitter(async (_url, init) => {
    bodies.push(JSON.parse(init!.body as string));
    if (bodies.length === 1) return new Promise<Response>((resolve) => { release = resolve; });
    return Response.json({ accepted: true });
  }, () => id);
  const values = { restaurantName: "Tacos", email: "owner@example.com", help: "Website" };
  const first = submit(values, "website");
  assert.deepEqual(await submit(values, "website"), { busy: true });
  release(Response.json({ error: "Temporary failure" }, { status: 502 }));
  assert.ok("error" in await first);
  assert.deepEqual(await submit(values, "website"), { accepted: true });
  assert.equal(bodies.length, 2);
  assert.equal(bodies[0].submissionId, bodies[1].submissionId);
});

test("failed submissions preserve form values and offer an encoded fallback; malformed success is rejected", async () => {
  const values = { restaurantName: "Tacos & More", email: "owner@example.com", notes: "Keep my details" };
  let state = leadFormReducer(initialLeadState, { type: "edit", values });
  state = leadFormReducer(state, { type: "start" });
  assert.equal(state.pending, true);
  const submit = createLeadSubmitter(async () => Response.json({}), () => id);
  const result = await submit(values, "website");
  assert.ok("error" in result);
  state = leadFormReducer(state, { type: "failed", error: "Retry" });
  assert.deepEqual(state.values, values);
  assert.equal(state.accepted, false);
  assert.equal(state.pending, false);
  const fallback = new URL(leadFallback("website", values));
  assert.equal(fallback.pathname, "hello@getmenuman.com");
  assert.match(fallback.searchParams.get("body")!, /Tacos & More[\s\S]*Keep my details/);
  state = leadFormReducer(state, { type: "accepted" });
  assert.equal(state.accepted, true);
  // Failed renders keep the same form mounted; only confirmed acceptance replaces it.
  const component = readFileSync("src/app/MarketingInteractions.tsx", "utf8");
  assert.match(component, /if \(lead.state.accepted\)/);
  assert.match(component, /disabled=\{lead.state.pending\}/);
  assert.doesNotMatch(component, /setSubmitted|Demo form|NominationForm/);
  assert.match(component, /Phone \(optional\)<input[^>]*name="phone"[^>]*>/);
  assert.doesNotMatch(component, /name="phone"[^>]*required/);
  const websiteInputs = component.match(/<input name="website"[^>]*>/g)!;
  assert.equal(websiteInputs.length, 2);
  for (const input of websiteInputs) {
    assert.match(input, /type="text"/);
    assert.match(input, /inputMode="url"/);
    assert.doesNotMatch(input, /pattern=/);
  }
  assert.match(websiteInputs[0], /disabled=\{noWebsite\} required=\{!noWebsite\}/);
  assert.doesNotMatch(websiteInputs[1], /required/);
});
