import assert from "node:assert/strict";
import test from "node:test";
import { createLeadEmailLinks } from "./email-links";

test("lead email links encode only the recipient and follow-up subject", () => {
  const links = createLeadEmailLinks("owner+west@example.com");
  const gmail = new URL(links.gmail);
  const mailto = new URL(links.mailto);

  assert.equal(gmail.origin, "https://mail.google.com");
  assert.equal(gmail.pathname, "/mail/");
  assert.equal(gmail.searchParams.get("view"), "cm");
  assert.equal(gmail.searchParams.get("fs"), "1");
  assert.equal(gmail.searchParams.get("to"), "owner+west@example.com");
  assert.equal(gmail.searchParams.get("su"), "Following up on your Menu Man inquiry");
  assert.equal(gmail.searchParams.has("body"), false);

  assert.equal(mailto.protocol, "mailto:");
  assert.equal(decodeURIComponent(mailto.pathname), "owner+west@example.com");
  assert.equal(mailto.searchParams.get("subject"), "Following up on your Menu Man inquiry");
  assert.equal(mailto.searchParams.has("body"), false);
});
