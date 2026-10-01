import assert from "node:assert/strict";
import test from "node:test";
import { acknowledgeStoredPaymentWebhook } from "./webhook-acknowledgement";

test("a stored webhook is acknowledged even when immediate application fails", async () => {
  const steps: string[] = [];
  const failure = new Error("database drain unavailable");
  const accepted = await acknowledgeStoredPaymentWebhook(
    async () => {
      steps.push("stored");
      return [{ webhookEventId: "event-1", inserted: true }];
    },
    async () => {
      steps.push("drain");
      throw failure;
    },
    (error) => {
      assert.equal(error, failure);
      steps.push("reported");
    },
  );
  assert.deepEqual(accepted, [{ webhookEventId: "event-1", inserted: true }]);
  assert.deepEqual(steps, ["stored", "drain", "reported"]);
});

test("a webhook is not acknowledged when durable ingestion fails", async () => {
  let drained = false;
  await assert.rejects(
    acknowledgeStoredPaymentWebhook(
      async () => { throw new Error("ingest failed"); },
      async () => { drained = true; },
      () => { throw new Error("unexpected drain report"); },
    ),
    /ingest failed/,
  );
  assert.equal(drained, false);
});
