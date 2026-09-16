import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import CustomerEmailLine from "./CustomerEmailLine";

test("confirmation customer email line renders when present", () => {
  const html = renderToStaticMarkup(<CustomerEmailLine email="diner@example.com" />);
  assert.match(html, /Email on order:/);
  assert.match(html, /diner@example\.com/);
});

test("confirmation customer email line is omitted when absent", () => {
  assert.equal(renderToStaticMarkup(<CustomerEmailLine email={null} />), "");
});
