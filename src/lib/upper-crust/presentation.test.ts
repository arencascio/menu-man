import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const panel = readFileSync("src/app/r/[slug]/OrderItemPanel.tsx", "utf8");
const browser = readFileSync("src/app/r/[slug]/MenuBrowser.tsx", "utf8");
const menuPage = readFileSync("src/app/r/upper-crust/menu/page.tsx", "utf8");
const reviews = readFileSync("src/app/r/upper-crust/UpperCrustReviews.tsx", "utf8");
const homePage = readFileSync("src/app/r/upper-crust/page.tsx", "utf8");
const social = readFileSync("src/app/r/upper-crust/UpperCrustSocialBar.tsx", "utf8");
const aboutPage = readFileSync("src/app/r/upper-crust/about/page.tsx", "utf8");
const details = readFileSync("src/app/r/upper-crust/UpperCrustDetails.tsx", "utf8");
const cateringPage = readFileSync("src/app/r/upper-crust/catering/page.tsx", "utf8");
const siteContent = readFileSync("src/lib/upper-crust/site-content.ts", "utf8");
const menuConfig = readFileSync("src/lib/upper-crust/config.ts", "utf8");
const protectedMedia = readFileSync("src/lib/upper-crust/protected-media.ts", "utf8");
const photoMap = readFileSync("docs/upper-crust-item-photo-map.md", "utf8");

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

test("About uses supplied amenity icons and keeps directions on the address", () => {
  assert.match(aboutPage, /<UpperCrustLocationSection \/>/);
  assert.match(aboutPage, /upperCrustLinks\.directions/);
  assert.match(details, /Map showing The Upper Crust Sandwich Shoppe in Riverside/);
  assert.doesNotMatch(details, /Open directions in Google Maps/);
  for (const icon of ["bird.svg", "face-slightly-smiling.svg", "paw-print.svg", "baby.svg", "user-round-group.svg", "parasol.svg", "vegan.svg"]) {
    assert.ok(details.includes(icon), icon);
  }
});

test("the original mixed review content is only rendered for the private Preview", () => {
  assert.equal((reviews.match(/quote:/g) ?? []).length, 11);
  assert.equal((reviews.match(/reviewId:/g) ?? []).length, 3);
  assert.match(reviews, /isUpperCrustPreviewPresentation/);
  assert.match(reviews, /Reviewer marketing-use permission is unresolved/);
  assert.match(reviews, /googleusercontent/);
  assert.match(reviews, /View on Google Maps/);
});

test("the dated social bar is shared above homepage reviews and on About", () => {
  assert.match(homePage, /<UpperCrustSocialBar \/>/);
  assert.ok(homePage.indexOf("<UpperCrustSocialBar") < homePage.indexOf("<UpperCrustReviews />"));
  assert.match(aboutPage, /<UpperCrustSocialBar showDisclosure=\{false\} \/>/);
  assert.match(social, /401 reviews/);
  assert.match(social, /881 reviews/);
  assert.match(social, /checked October 27, 2026/);
  assert.match(social, /facebook-wordmark\.svg/);
  assert.match(social, /instagram-2022\.svg/);
});

test("new menu images use item-specific protected assets", () => {
  for (const image of ["menu-bbq-beef.jpg", "menu-blt.jpg", "menu-dinner-salad.jpg", "menu-french-dip.jpg", "menu-grinder-for-one.png", "menu-grinder-for-two.png", "menu-half-custom-sandwich.jpg", "menu-italian-sub-for-one.jpg"]) {
    assert.ok(menuConfig.includes(`upperCrustProtectedMediaUrl("${image}")`), image);
    assert.ok(protectedMedia.includes(`"${image}"`), image);
  }
  assert.match(photoMap, /Twelve of the 26 fixture items/);
  assert.match(photoMap, /Fourteen fixture items remain/);
});

test("Catering retains the approved in-flow contact, hours, and protected photo", () => {
  assert.match(cateringPage, /Contact the restaurant for current options, quantities, prices, minimums, lead times and policies\./);
  assert.match(cateringPage, /Call the Restaurant/);
  assert.match(cateringPage, /10 AM–5 PM/);
  assert.match(cateringPage, /11 AM–4 PM/);
  assert.match(cateringPage, /upperCrustStorefrontPhoto/);
  assert.doesNotMatch(cateringPage, /heroActions/);
  assert.match(siteContent, /day: "Sunday", hours: "11 AM–4 PM"/);
});
