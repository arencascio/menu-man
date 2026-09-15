import assert from "node:assert/strict";
import test from "node:test";
import { csvLine, escapeCsvValue, orderHistoryCsvRow } from "./csv";

test("CSV values escape commas, quotes, newlines, and spreadsheet formulas", () => {
  assert.equal(escapeCsvValue('Doe, "Jane"\nKitchen'), '"Doe, ""Jane""\nKitchen"');
  assert.equal(escapeCsvValue("=1+1"), "'=1+1");
  assert.equal(csvLine(["plain", "comma,value"]), 'plain,"comma,value"\r\n');
});

test("order history CSV leaves customer name empty when the DB redacts it", () => {
  const line = orderHistoryCsvRow({
    orderId: "11111111-1111-4111-8111-111111111111",
    orderNumber: "1042",
    historyAt: "2026-09-14T18:00:00Z",
    placedAt: "2026-09-14T18:00:00Z",
    pickupAt: "2026-09-14T18:30:00Z",
    customerName: null,
    fulfillmentStatus: "completed",
    paymentStatus: "paid",
    refundStatus: null,
    itemCount: 2,
    subtotalCents: 1000,
    taxCents: 88,
    tipCents: 200,
    totalCents: 1288,
    refundAmountCents: 0,
    completedAt: "2026-09-14T19:00:00Z",
  });
  assert.equal(line, "1042,2026-09-14T18:00:00Z,2026-09-14T18:30:00Z,,completed,paid,,2,10.00,0.88,2.00,12.88,0.00,2026-09-14T19:00:00Z\r\n");
});
