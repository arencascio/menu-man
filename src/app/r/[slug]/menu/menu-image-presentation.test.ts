import assert from "node:assert/strict";
import test from "node:test";
import { getMenuImageFrameStyle } from "./menu-image-presentation";

test("menu image focal framing and zoom clamp independently supplied frames", () => {
  assert.deepEqual(getMenuImageFrameStyle({ focalPoint: { x: 0.2, y: 0.8 }, zoom: 1.25 }), {
    objectPosition: "20% 80%", transform: "scale(1.25)", transformOrigin: "20% 80%",
  });
  assert.deepEqual(getMenuImageFrameStyle({ focalPoint: { x: 2, y: -1 }, zoom: 0.5 }), {
    objectPosition: "100% 0%", transform: undefined, transformOrigin: "100% 0%",
  });
  assert.deepEqual(getMenuImageFrameStyle({ focalPoint: { x: 0.7, y: 0.3 } }), {
    objectPosition: "70% 30%", transform: undefined, transformOrigin: "70% 30%",
  });
});
