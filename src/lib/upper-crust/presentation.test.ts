import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const panel = readFileSync("src/app/r/[slug]/OrderItemPanel.tsx", "utf8");
const browser = readFileSync("src/app/r/[slug]/MenuBrowser.tsx", "utf8");
const menuPage = readFileSync("src/app/r/upper-crust/menu/page.tsx", "utf8");
const reviews = readFileSync("src/app/r/upper-crust/UpperCrustReviews.tsx", "utf8");
const homePage = readFileSync("src/app/r/upper-crust/page.tsx", "utf8");
const social = readFileSync("src/app/r/upper-crust/about/page.tsx", "utf8");
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

test("protected Upper Crust pages match the original presentation where content rights allow", () => {
  assert.match(aboutPage, /<UpperCrustLocationSection \/>/);
  assert.match(details, /Map showing The Upper Crust Sandwich Shoppe in Riverside/);
  assert.match(social, /upperCrustLinks\.facebook/);
  assert.match(social, /upperCrustLinks\.instagram/);
  assert.match(social, /Google Reviews/);
  assert.match(social, /Yelp Reviews/);
  assert.doesNotMatch(`${reviews}\n${aboutPage}\n${details}\n${social}`, /googleusercontent|quote:/);
  assert.match(social, /400 reviews/);
  assert.match(social, /Checked October 24, 2026/);
  assert.match(aboutPage, /className=\{detailStyles\.socialStrip\}/);
  assert.doesNotMatch(reviews, /UpperCrustSocialBar/);
  assert.match(cateringPage, /Catering is listed in the Riverside Downtown Partnership directory/);
  assert.match(cateringPage, /Call \{upperCrust\.phone\}/);
  assert.match(cateringPage, /Hours, Contact & Directions/);
  assert.match(siteContent, /day: "Sunday", hours: "11 AM–4 PM"/);
});

test("homepage reviews are mounted in the original main-content sequence", () => {
  assert.match(homePage, /<UpperCrustReviews \/>/);
  assert.doesNotMatch(homePage, /UpperCrustSocialBar/);
});
