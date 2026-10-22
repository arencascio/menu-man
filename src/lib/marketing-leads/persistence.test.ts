import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createLeadHandler } from "./handler";
import { createLeadStore, leadContextSchema } from "./persistence";
import { leadSchema } from "./contracts";
import { memoryLeadStore } from "./test-store";
import { createLeadSubmitter } from "./client";
import { currentLeadContext } from "./context";

const inquiry = { type: "website", submissionId: "20000000-0000-4000-8000-000000000999", restaurantName: "Synthetic Restaurant", email: "synthetic@example.com", help: "Website" };
const request = (body: unknown = inquiry) => new Request("https://getmenuman.com/api/marketing/leads", {
  method: "POST", headers: { origin: "https://getmenuman.com", "Content-Type": "application/json" }, body: JSON.stringify(body),
});
const config = { apiKey: "test-secret", from: "Menu Man <hello@getmenuman.com>", allow: () => true };

test("valid legacy form payloads persist before email and completion, preserving form-specific details", async () => {
  for (const type of ["website", "review"]) {
    const memory = memoryLeadStore();
    const send = createLeadHandler({ ...config, store: memory.store, fetcher: async () => {
      assert.equal(memory.leads.size, 1);
      assert.deepEqual(memory.events, ["persist", "claim"]);
      memory.events.push("email");
      return Response.json({ id: "provider-id" });
    } });
    const response = await send(request({ ...inquiry, type, noWebsite: true, name: "Owner", phone: "5551234567", city: "Town", onlineOrdering: "yes", orderingProviders: "Square", notes: "Synthetic notes" }));
    assert.deepEqual(await response.json(), { accepted: true, recorded: true });
    assert.deepEqual(memory.events, ["persist", "claim", "email", "complete"]);
    assert.equal([...memory.outcomes.values()][0].state, "accepted");
    const stored = [...memory.leads.values()][0];
    assert.equal(stored.lead.orderingProviders, "Square");
    assert.equal(stored.lead.noWebsite, true);
  }
});

test("invalid, trapped and unsafe attribution submissions never persist or send", async () => {
  const memory = memoryLeadStore();
  const send = createLeadHandler({ ...config, store: memory.store, fetcher: async () => { throw Error("Unexpected email"); } });
  for (const body of [{ ...inquiry, email: "bad" }, { ...inquiry, companyFax: "bot" },
    { ...inquiry, context: { sourcePage: "/private?email=pii", attribution: {} } },
    { ...inquiry, context: { attribution: { utm_source: "private@example.com" } } },
    { ...inquiry, context: { attribution: { rawReferrer: "https://private/" } } }]) {
    assert.equal((await send(request(body))).status, 400);
  }
  assert.equal(memory.leads.size, 0);
  assert.deepEqual(memory.events, []);
});

test("email rejection, timeout and malformed success leave a saved lead and safe recovery state", async () => {
  for (const [fetcher, state] of [
    [async () => Response.json({ name: "PII owner@example.com credential" }, { status: 422 }), "failed"],
    [async () => { throw Error("test-secret owner@example.com"); }, "retryable"],
    [async () => Response.json({ id: "" }), "retryable"],
    [async () => Response.json({ id: "owner@example.com" }), "retryable"],
    [async () => Response.json({}), "retryable"],
  ] as const) {
    const memory = memoryLeadStore();
    const response = await createLeadHandler({ ...config, store: memory.store, fetcher })(request());
    assert.equal(response.status, 200);
    assert.equal((await response.json()).recorded, true);
    assert.equal(memory.leads.size, 1);
    const outcome = [...memory.outcomes.values()][0];
    assert.equal(outcome.state, state);
    assert.doesNotMatch(JSON.stringify(outcome), /owner@example|test-secret|PII/);
  }
});

test("unavailable storage never reports received success or sends email", async () => {
  let emails = 0;
  const memory = memoryLeadStore();
  const broken = { ...memory.store, persist: async () => { throw Error("private contact and database credentials"); } };
  for (const store of [undefined, broken]) {
    const response = await createLeadHandler({ ...config, store, fetcher: async () => { emails++; return Response.json({ id: "unexpected" }); } })(request());
    assert.equal(response.status, 503);
    assert.doesNotMatch(await response.text(), /accepted|recorded|private|credentials/);
  }
  assert.equal(emails, 0);
});

test("concurrent duplicates share one lead and email; changed content conflicts and independent IDs remain distinct", async () => {
  const memory = memoryLeadStore();
  let emails = 0;
  const send = createLeadHandler({ ...config, store: memory.store, fetcher: async () => { emails++; return Response.json({ id: "provider-id" }); } });
  const results = await Promise.all([send(request()), send(request())]);
  assert.ok(results.every(response => response.status === 200));
  assert.equal(memory.leads.size, 1); assert.equal(emails, 1);
  assert.equal((await send(request({ ...inquiry, notes: "Changed" }))).status, 409);
  assert.equal((await send(request({ ...inquiry, submissionId: "20000000-0000-4000-8000-000000000998" }))).status, 200);
  assert.equal(memory.leads.size, 2); assert.equal(emails, 2);
  assert.equal(new Set([...memory.leads.values()].map(x => x.id)).size, 2);
});

test("claim or completion DB failure does not lose the committed lead or leak/log sensitive exceptions", async () => {
  const original = console.error;
  const logs: unknown[] = [];
  console.error = (...args) => { logs.push(args); };
  try {
    for (const operation of ["claim", "complete"] as const) {
      const memory = memoryLeadStore();
      const store = { ...memory.store, [operation]: async () => { throw Error("secret owner@example.com database"); } };
      const response = await createLeadHandler({ ...config, store, fetcher: async () => Response.json({ id: "provider-id" }) })(request());
      assert.deepEqual(await response.json(), { accepted: true, recorded: true });
      assert.equal(memory.leads.size, 1);
    }
    assert.deepEqual(logs, []);
  } finally { console.error = original; }
});

test("RPC adapter strips honeypot/duplicate details, accepts only safe metadata and redacts errors", async () => {
  const lead = leadSchema.parse(inquiry);
  const store = createLeadStore(async (name, args) => {
    assert.equal(name, "record_marketing_lead_v1");
    const details = args.p_details as Record<string, unknown>;
    assert.equal("companyFax" in details, false);
    assert.equal("submissionId" in details, false);
    assert.equal("type" in details, false);
    return { data: inquiry.submissionId, error: null };
  });
  assert.equal(await store.persist(lead, { sourcePage: "/work", attribution: { utm_source: "owner-approved" } }), inquiry.submissionId);
  const broken = createLeadStore(async () => ({ data: null, error: { message: "credentials owner@example.com" } }));
  await assert.rejects(broken.persist(lead, { attribution: {} }), { message: "Lead storage unavailable" });
  assert.equal(leadContextSchema.safeParse({ attribution: { utm_source: "email@example.com" } }).success, false);
  assert.deepEqual(currentLeadContext(), { attribution: {} });
});

test("browser requires durable acknowledgment; email-only legacy acceptance cannot report success", async () => {
  const submit = createLeadSubmitter(async () => Response.json({ accepted: true }), () => inquiry.submissionId);
  assert.ok("error" in await submit({ restaurantName: "Synthetic" }, "website"));
  const component = readFileSync("src/app/MarketingLeadForm.tsx", "utf8");
  assert.match(component, /marketing_lead_recorded/);
  assert.match(component, /if \(state.accepted\) sender.current = null/);
  const route = readFileSync("src/app/api/marketing/leads/route.ts", "utf8");
  assert.doesNotMatch(route, /console\.|after\(|waitUntil/);
  const server = readFileSync("src/lib/marketing-leads/server.ts", "utf8");
  assert.match(server, /import "server-only"/);
  assert.doesNotMatch(readFileSync("src/lib/marketing-leads/client.ts", "utf8"), /SERVICE_ROLE|supabase\/server/);
});
