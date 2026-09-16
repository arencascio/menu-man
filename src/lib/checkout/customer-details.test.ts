import assert from "node:assert/strict";
import test from "node:test";
import {
  customerValidationError,
  isValidCustomerEmail,
  isValidCustomerName,
  isValidCustomerNotes,
  normalizeCustomerEmail,
  normalizeCustomerName,
  normalizeCustomerNotes,
  normalizeUsPhone,
} from "./customer-details";

const required = {
  customerNameRequired: true,
  customerEmailRequired: true,
  customerPhoneRequired: true,
};
const optional = {
  customerNameRequired: false,
  customerEmailRequired: false,
  customerPhoneRequired: false,
};

test("customer name normalization and required/optional behavior", () => {
  assert.equal(normalizeCustomerName("  Aren   Cascio  "), "Aren Cascio");
  assert.match(customerValidationError({ name: null, email: "a@b.co", phone: "+19515551234" }, required) || "", /name/i);
  assert.equal(customerValidationError({ name: null, email: null, phone: null }, optional), null);
  assert.equal(isValidCustomerName("123456", true), false);
  assert.equal(isValidCustomerName("!!!", true), false);
  assert.match(
    customerValidationError({ name: "A", email: "a@b.co", phone: "+19515551234" }, required) || "",
    /Latin-script names must be at least 2 characters; single-character non-Latin names are allowed/,
  );
});

test("customer names allow apostrophes, hyphens, accents, and non-Latin scripts", () => {
  for (const name of ["Aren", "D'Andre", "Anne-Marie", "José", "李"]) {
    assert.equal(isValidCustomerName(name, true), true, name);
  }
  assert.equal(isValidCustomerName("a".repeat(100), true), true);
  assert.equal(isValidCustomerName("a".repeat(101), true), false);
});

test("email normalization and pragmatic validation support required and optional email", () => {
  assert.equal(normalizeCustomerEmail("  DINER@Example.COM "), "diner@example.com");
  assert.equal(isValidCustomerEmail("diner@example.com"), true);
  for (const email of ["diner example.com", "diner@", "@example.com", "diner.example.com"]) {
    assert.equal(isValidCustomerEmail(email), false, email);
  }
  assert.match(customerValidationError({ name: "Aren", email: null, phone: "+19515551234" }, required) || "", /email/i);
  assert.equal(customerValidationError({ name: null, email: null, phone: null }, optional), null);
});

test("formatted US phones normalize to E.164 and alphabetic junk is rejected", () => {
  for (const phone of ["(951) 555-1234", "951-555-1234", "+1 951 555 1234"]) {
    assert.equal(normalizeUsPhone(phone), "+19515551234", phone);
  }
  assert.equal(normalizeUsPhone("call-me"), null);
  assert.match(customerValidationError({ name: "Aren", email: "a@b.co", phone: null }, required) || "", /phone/i);
  assert.equal(customerValidationError({ name: null, email: null, phone: null }, optional), null);
});

test("customer notes normalize line endings, trim, enforce 500 characters, and reject controls", () => {
  assert.equal(normalizeCustomerNotes("  Ring bell\r\nThank you\r  "), "Ring bell\nThank you");
  assert.equal(isValidCustomerNotes("a".repeat(500)), true);
  assert.equal(isValidCustomerNotes("a".repeat(501)), false);
  assert.equal(isValidCustomerNotes("hello\u0001world"), false);
  assert.equal(isValidCustomerNotes("Please leave by the side door; thank you!"), true);
});
