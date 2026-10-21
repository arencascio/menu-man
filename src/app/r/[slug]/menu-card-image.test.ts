import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import * as jsxRuntime from "react/jsx-runtime";

type Element = { props: { children: Element | string; src?: string; className?: string;
  ref?: (image: { complete: boolean; naturalWidth: number } | null) => void; onError?: () => void } };

function harness() {
  const state: unknown[] = [];
  let cursor = 0;
  const exports: { default?: (props: { name: string; url: string | null; priority: boolean }) => Element } = {};
  const code = ts.transpileModule(readFileSync("src/app/r/[slug]/MenuCardImage.tsx", "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(code, { exports, require(name: string) {
    if (name === "react/jsx-runtime") return jsxRuntime;
    if (name.endsWith(".css")) return { default: { image: "image", placeholder: "placeholder" } };
    if (name === "./menu/menu-image-presentation") return { getMenuImageFrameStyle: () => undefined };
    if (name === "react") return {
      useRef: () => ({ current: null }), useEffect: () => {},
      useState(initial: unknown) { const index = cursor++; if (state.length <= index) state.push(initial); return [state[index], (value: unknown) => { state[index] = value; }]; },
    };
    throw new Error(`Unmocked dependency: ${name}`);
  } });
  return (url: string | null) => { cursor = 0; return exports.default!({ name: "Street Taco", url, priority: true }).props.children as Element; };
}

test("menu images use the neutral placeholder for failures before hydration and recover on a new URL", () => {
  const render = harness();
  const image = render("/approved.webp");
  image.props.ref!({ complete: true, naturalWidth: 0 });
  assert.equal(render("/approved.webp").props.children, "S");
  assert.equal(render("/new-approved.webp").props.src, "/new-approved.webp");
});

test("menu images preserve successful/loading photos and handle later failures and missing URLs", () => {
  const render = harness();
  render("/approved.webp").props.ref!({ complete: false, naturalWidth: 0 });
  assert.equal(render("/approved.webp").props.src, "/approved.webp");
  render("/approved.webp").props.ref!({ complete: true, naturalWidth: 400 });
  assert.equal(render("/approved.webp").props.src, "/approved.webp");
  render("/approved.webp").props.onError!();
  assert.equal(render("/approved.webp").props.children, "S");
  assert.equal(render(null).props.children, "S");
});
