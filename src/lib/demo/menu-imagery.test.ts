import assert from "node:assert/strict";
import test from "node:test";
import { existsSync } from "node:fs";
import { SUPER_TACOS_ID } from "./policy";
import { withDemoMenuImages } from "./menu-imagery";

const sections = [{ id: "section", items: [201, 202, 204, 205, 206, 210, 229].map((number) => ({
  id: `20000000-0000-4000-8000-${String(number).padStart(12, "0")}`,
  name: `Item ${number}`, price_cents: 495, image_url: "/old.jpg", modifierGroups: [{ id: "modifier" }],
})) }];

test("approved menu imagery is scoped to the exact demo tenant", () => {
  assert.equal(withDemoMenuImages("armandos", sections), sections);
  assert.equal(withDemoMenuImages(`${SUPER_TACOS_ID}x`, sections), sections);
});
test("demo photos replace only images and unmatched dishes retain placeholders", () => {
  const original = structuredClone(sections);
  const mapped = withDemoMenuImages(SUPER_TACOS_ID, sections);
  assert.equal(mapped[0].items[0].image_url, "/img/super-tacos/approved/carne-asada-tacos.webp");
  assert.equal(mapped[0].items[1].image_url, null);
  assert.equal(mapped[0].items[2].image_url, "/img/super-tacos/approved/burrito.webp");
  assert.equal(mapped[0].items[4].image_url, "/img/super-tacos/approved/black-bean-burrito.webp");
  assert.equal(mapped[0].items[5].image_url, "/img/super-tacos/approved/salsas.webp");
  assert.equal(mapped[0].items[6].image_url, "/img/super-tacos/approved/churros.webp");
  for (const [index, item] of mapped[0].items.entries()) {
    assert.deepEqual({ ...item, image_url: sections[0].items[index].image_url }, sections[0].items[index]);
    if (item.image_url) assert.ok(existsSync(`public${item.image_url}`));
  }
  assert.deepEqual(sections, original);
});
