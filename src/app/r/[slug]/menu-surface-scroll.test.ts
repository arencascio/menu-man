import assert from "node:assert/strict";
import test from "node:test";
import { getMenuPageScrollY, lockMenuPageScroll } from "./menu-surface-scroll";

test("stacked cart/item surfaces restore exact menu position and styles only after their last release", () => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
  const bodyStyle = { position: "relative", top: "", width: "", overflow: "auto" };
  const rootStyle = { overflow: "clip" };
  const scrolls: unknown[] = [];
  const fakeWindow = { scrollY: 1243, scrollTo: (options: unknown) => scrolls.push(options) };
  Object.defineProperty(globalThis, "window", { configurable: true, value: fakeWindow });
  Object.defineProperty(globalThis, "document", { configurable: true, value: { body: { style: bodyStyle, getBoundingClientRect: () => ({ width: 412 }) }, documentElement: { style: rootStyle } } });
  try {
    for (const releaseCartFirst of [false, true]) {
      const cartUnlock = lockMenuPageScroll();
      fakeWindow.scrollY = 0;
      assert.equal(getMenuPageScrollY(), 1243);
      const itemUnlock = lockMenuPageScroll(0);
      assert.equal(bodyStyle.top, "-1243px");
      const first = releaseCartFirst ? cartUnlock : itemUnlock;
      const last = releaseCartFirst ? itemUnlock : cartUnlock;
      first(); first();
      assert.equal(bodyStyle.position, "fixed");
      const before = scrolls.length;
      last(); last();
      assert.deepEqual(bodyStyle, { position: "relative", top: "", width: "", overflow: "auto" });
      assert.equal(rootStyle.overflow, "clip");
      assert.equal(scrolls.length, before + 1);
      assert.deepEqual(scrolls.at(-1), { top: 1243, behavior: "instant" });
      fakeWindow.scrollY = 1243;
    }
  } finally {
    if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
    else Reflect.deleteProperty(globalThis, "window");
    if (originalDocument) Object.defineProperty(globalThis, "document", originalDocument);
    else Reflect.deleteProperty(globalThis, "document");
  }
});
