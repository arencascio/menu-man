import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const panel = readFileSync("src/app/r/[slug]/OrderItemPanel.tsx", "utf8");
const browser = readFileSync("src/app/r/[slug]/MenuBrowser.tsx", "utf8");
const menuPage = readFileSync("src/app/r/upper-crust/menu/page.tsx", "utf8");

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
