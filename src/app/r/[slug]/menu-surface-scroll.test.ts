import assert from "node:assert/strict";
import test from "node:test";
import { getMenuPageScrollY, lockMenuPageScroll } from "./menu-surface-scroll";

test("stacked cart/item surfaces restore exact menu position and styles only after their last release", () => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
  const bodyStyle = { position: "relative", top: "", width: "", overflow: "auto" };
  const rootStyle = { overflow: "clip" };
  const scrolls: unknown[] = [];
  const fakeWindow = { innerWidth: 412, scrollY: 1243, scrollTo: (options: unknown) => scrolls.push(options) };
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

test("desktop lock retains native sticky positioning and the pre-lock scrollbar width", () => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
  const style = { position: "", top: "", width: "", overflow: "" };
  const root = { overflow: "" };
  const scrolls: unknown[] = [];
  Object.defineProperty(globalThis, "window", { configurable: true, value: { innerWidth: 1440, scrollY: 1243, scrollTo: (value: unknown) => scrolls.push(value) } });
  Object.defineProperty(globalThis, "document", { configurable: true, value: { body: { style, getBoundingClientRect: () => ({ width: 1425 }) }, documentElement: { style: root } } });
  try {
    const release = lockMenuPageScroll();
    assert.deepEqual(style, { position: "", top: "", width: "1425px", overflow: "clip" });
    assert.equal(root.overflow, "hidden");
    assert.equal(getMenuPageScrollY(), 1243);
    release();
    assert.deepEqual(style, { position: "", top: "", width: "", overflow: "" });
    assert.equal(root.overflow, "");
    assert.deepEqual(scrolls, [{ top: 1243, behavior: "instant" }]);
  } finally {
    if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
    else Reflect.deleteProperty(globalThis, "window");
    if (originalDocument) Object.defineProperty(globalThis, "document", originalDocument);
    else Reflect.deleteProperty(globalThis, "document");
  }
});
