import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { JsxEmit, ModuleKind, transpileModule } from "typescript";
import { getBusinessPageHref, isBusinessPageAvailable, marketingBusinessPages } from "../src/lib/marketing-business-pages";
import { cancellationTopics } from "../src/app/business-review-content";
import { PUBLIC_CONTACT, PUBLIC_PRICING, faqs, includedServices } from "../src/app/marketing-content";
import "./marketing-m1.test";

test("business review routes and links open only in local development while unpublished", () => {
  for (const page of ["cancellation", "about"] as const) {
    assert.equal(marketingBusinessPages[page].published, false);
    assert.equal(isBusinessPageAvailable(page, { NODE_ENV: "development" }), true);
    assert.equal(getBusinessPageHref(page, { NODE_ENV: "development", MENU_MAN_ENV: "staging" }), marketingBusinessPages[page].href);
    for (const env of [
      {}, { NODE_ENV: "production" }, { NODE_ENV: "test" },
      { NODE_ENV: "development", VERCEL_ENV: "preview" },
      { NODE_ENV: "development", VERCEL_ENV: "production" },
      { NODE_ENV: "development", VERCEL_ENV: "development" },
      { NODE_ENV: "development", VERCEL_ENV: "unexpected" },
      { NODE_ENV: "development", MENU_MAN_ENV: "production" },
      { NODE_ENV: "development", MENU_MAN_ENV: "Production" },
      { NODE_ENV: "development", MENU_MAN_ENV: "unexpected" },
    ]) {
      assert.equal(isBusinessPageAvailable(page, env), false);
      assert.equal(getBusinessPageHref(page, env), null);
    }
  }
});

test("both pages fail before rendering when a business page is unavailable", () => {
  for (const path of ["cancellation", "about"]) {
    const source=readFileSync(`src/app/${path}/page.tsx`, "utf8");
    const compiled=transpileModule(source, { compilerOptions: { module: ModuleKind.CommonJS, jsx: JsxEmit.ReactJSX } }).outputText;
    const exports: Record<string, unknown>={};
    let rendered=0;
    const runtime={exports, require:(name:string)=>{
      if(name==="next/navigation")return {notFound:()=>{throw new Error("GATED_404");}};
      if(name==="@/lib/marketing-business-pages")return {isBusinessPageAvailable:()=>false};
      if(name==="react/jsx-runtime")return {jsx:()=>{rendered++;},jsxs:()=>{rendered++;}};
      return {};
    }};
    runInNewContext(compiled,runtime);
    assert.throws(()=> (exports.default as ()=>unknown)(), /GATED_404/);
    assert.equal(rendered,0);
    assert.match(source,/robots: \{ index: false, follow: false \}/);
  }
});

test("owner-approved working policy is concise without inventing deletion or suspension terms", () => {
  const topics=Object.fromEntries(cancellationTopics.map(topic=>[topic.id,topic]));
  assert.match(topics.export.copy,/within two weeks after cancellation/);
  assert.match(topics.export.copy,/standard export.*no additional fee/);
  assert.match(topics.cancellation.copy,/at any time, without a cancellation penalty/);
  assert.match(topics.domain.copy,/keep control of your restaurant-owned domain/);
  assert.match(topics.retention.copy,/does not set a deletion deadline for stored data or backups/);
  const page=readFileSync("src/app/cancellation/page.tsx","utf8");
  assert.match(page,/Custom migration work is separate from the standard export/);
  assert.match(page,/proprietary source code, hosted system and templates stay with Menu Man/);
  assert.match(page,/Working policy approved/);
  assert.doesNotMatch(JSON.stringify(cancellationTopics)+page,/nonpayment|suspension/i);
});

test("pricing/contact language stays consistent without fictional founder or phone details", () => {
  assert.equal(PUBLIC_CONTACT.email,"hello@getmenuman.com");
  assert.equal(PUBLIC_PRICING.monthly,"$99/month");
  assert.equal(PUBLIC_PRICING.startupFee,"$299");
  assert.ok(!includedServices.some(service=>/Menu Man pickup ordering/.test(service)));
  assert.match(String(faqs.find(faq=>faq.question==="Do I keep my domain?")?.answer),/should own and control/);
  for(const route of ["cancellation","about"]) {
    const page=readFileSync(`src/app/${route}/page.tsx`,"utf8");
    assert.ok(page.includes("PUBLIC_CONTACT.email"));
    assert.ok(!/tel:|linkedin\.com|https?:\/\/.*headshot/i.test(page));
  }
  assert.match(readFileSync("src/app/about/page.tsx","utf8"),/Founder name and introduction awaiting owner confirmation/);
});

test("draft business pages are absent from the sitemap and main navigation", () => {
  for(const path of ["src/app/sitemap.ts","src/app/MarketingInteractions.tsx"]) {
    assert.ok(!/href=["']\/(?:about|cancellation)["']/.test(readFileSync(path,"utf8")));
  }
  const services=readFileSync("src/app/services/page.tsx","utf8");
  const footer=readFileSync("src/app/MarketingComponents.tsx","utf8");
  assert.ok(services.includes('getBusinessPageHref("cancellation")'));
  assert.ok(footer.includes('getBusinessPageHref("cancellation")'));
  assert.ok(footer.includes('getBusinessPageHref("about")'));
});
