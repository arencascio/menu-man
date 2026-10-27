import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const panel = readFileSync("src/app/r/[slug]/OrderItemPanel.tsx", "utf8");
const browser = readFileSync("src/app/r/[slug]/MenuBrowser.tsx", "utf8");
const menuPage = readFileSync("src/app/r/upper-crust/menu/page.tsx", "utf8");
const homePage = readFileSync("src/app/r/upper-crust/page.tsx", "utf8");
const aboutPage = readFileSync("src/app/r/upper-crust/about/page.tsx", "utf8");
const details = readFileSync("src/app/r/upper-crust/UpperCrustDetails.tsx", "utf8");
const cateringPage = readFileSync("src/app/r/upper-crust/catering/page.tsx", "utf8");
const siteContent = readFileSync("src/lib/upper-crust/site-content.ts", "utf8");

test("Upper Crust hides only the sample label while shared restaurant dialogs retain it", () => {
  assert.match(panel, /showSampleCustomizationLabel = true/);
  assert.match(panel, /showSampleCustomizationLabel \? "Customize a sample" : null/);
  assert.match(browser, /showSampleCustomizationLabel=\{displayStyle !== "upper-crust"\}/);
});

test("Upper Crust menu omits the obsolete price caveat and controls note plumbing", () => {
  assert.doesNotMatch(menuPage, /Prices reflect DoorDash Delivery listings viewed/);
  assert.doesNotMatch(menuPage, /controlsNote/);
  assert.doesNotMatch(browser, /controlsNote/);
});

test("protected Upper Crust pages expose requested contacts without excluded review content", () => {
  assert.match(aboutPage, /<UpperCrustLocationSection \/>/);
  assert.match(details, /Open directions in Google Maps/);
  assert.match(aboutPage, /upperCrustLinks\.facebook/);
  assert.match(aboutPage, /upperCrustLinks\.instagram/);
  assert.match(homePage, /Google Reviews/);
  assert.match(homePage, /Yelp Reviews/);
  assert.doesNotMatch(`${homePage}\n${aboutPage}\n${details}`, /googleusercontent|reviewId|4\.7|881 reviews|400 reviews|★★★★★/);
  assert.match(cateringPage, /Contact the restaurant for current options, quantities, prices, minimums, lead times and policies\./);
  assert.match(cateringPage, />Call the Restaurant<\/a>/);
  assert.match(cateringPage, /Monday–Saturday/);
  assert.match(siteContent, /day: "Sunday", hours: "11 AM–4 PM"/);
});
