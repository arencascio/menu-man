import assert from "node:assert/strict";
import test from "node:test";
import {
  businessHourSchema,
  orderingSettingsSchema,
  updateRestaurantSettingsRequestSchema,
} from "./contracts";

test("restaurant settings trim values, null blanks, and require HTTPS links", () => {
  const base = {
    name: "  Test Kitchen  ", tagline: " ", description: "", phone: " ",
    addressLine1: "", city: "", state: "", postalCode: "",
    googleMapsUrl: "https://maps.google.com/example", instagramUrl: "", facebookUrl: "",
    clientActionId: "00000000-0000-4000-8000-000000000001",
  };
  const parsed = updateRestaurantSettingsRequestSchema.parse(base);
  assert.equal(parsed.name, "Test Kitchen");
  assert.equal(parsed.tagline, null);
  assert.equal(parsed.googleMapsUrl, "https://maps.google.com/example");
  assert.equal(updateRestaurantSettingsRequestSchema.safeParse({ ...base, googleMapsUrl: "javascript:alert(1)" }).success, false);
});

test("ordering settings enforce checkout-supported ranges and pickup mode invariants", () => {
  const valid = {
    pickupEnabled: true, asapEnabled: true, scheduledPickupEnabled: true,
    pickupLeadTimeMinutes: 15, pickupSlotIntervalMinutes: 15, advanceOrderDays: 7,
    customerNameRequired: true, customerEmailRequired: true, customerPhoneRequired: false,
    customTipAdditiveCapCents: 50000, refundWindowDays: 7,
  };
  assert.equal(orderingSettingsSchema.safeParse(valid).success, true);
  assert.equal(orderingSettingsSchema.safeParse({ ...valid, pickupSlotIntervalMinutes: 4 }).success, false);
  assert.equal(orderingSettingsSchema.safeParse({ ...valid, pickupEnabled: false }).success, false);
  assert.equal(orderingSettingsSchema.safeParse({ ...valid, customTipAdditiveCapCents: -1 }).success, false);
});

test("hours require valid same-day ranges only on open days", () => {
  assert.equal(businessHourSchema.safeParse({ dayOfWeek: 1, isClosed: true, openTime: null, closeTime: null }).success, true);
  assert.equal(businessHourSchema.safeParse({ dayOfWeek: 1, isClosed: false, openTime: "09:00", closeTime: "17:00" }).success, true);
  assert.equal(businessHourSchema.safeParse({ dayOfWeek: 1, isClosed: false, openTime: "17:00", closeTime: "09:00" }).success, false);
});
