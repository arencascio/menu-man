import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";

const manifest=JSON.parse(readFileSync("docs/marketing-v1.2-assets.json","utf8")) as {
  migrated: {legacy:string;destination:string;sha256:string}[];
  providers: {file:string;sha256:string}[];
};
function digest(file:string) {
  const data=readFileSync(file);
  return createHash("sha256").update(file.endsWith(".svg")?data.toString("utf8").replaceAll("\r\n","\n"):data).digest("hex");
}

test("every baseline legacy image has an unchanged public replacement",()=>{
  assert.equal(manifest.migrated.length,154);
  assert.equal(existsSync("img"),false);
  for(const asset of manifest.migrated) {
    assert.ok(asset.destination.startsWith("public/"),asset.legacy);
    assert.equal(digest(asset.destination),asset.sha256,asset.legacy);
  }
});

test("all supplied provider variants remain intact and the six fullmarks have no active external content",()=>{
  assert.equal(manifest.providers.length,19);
  for(const asset of manifest.providers)assert.equal(digest(asset.file),asset.sha256,asset.file);
  const source=readFileSync("src/app/ProviderLogoStrip.tsx","utf8");
  const logos=[...source.matchAll(/src: "([^"]+)"/g)].map(match=>match[1]);
  assert.equal(logos.length,6);
  for(const url of logos) {
    const svg=readFileSync("public"+url,"utf8");
    assert.match(svg,/<svg\b/);
    assert.doesNotMatch(svg,/<\s*(?:script|foreignObject|iframe|image)\b|\son\w+\s*=|<!ENTITY|<!DOCTYPE|(?:href|src)\s*=\s*["'](?:https?:|data:|\/\/)/i);
  }
});

test("active source has no root image imports and static browser image URLs resolve",()=>{
  const files:string[]=[];
  function walk(dir:string) {for(const e of readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,e.name);if(e.isDirectory())walk(file);else if(/\.(?:tsx?|css)$/.test(file)&&! /\.(?:test|spec)\./.test(file))files.push(file)}}
  walk("src");files.push("next.config.ts");
  for(const file of files) {
    const source=readFileSync(file,"utf8");
    assert.doesNotMatch(source,/["'](?:\.\.\/)+img\//,file);
    for(const match of source.matchAll(/["'\x60]((?:\/img\/|\/brand\/)[^"'\x60\s]+)["'\x60]/g)) {
      if(match[1].includes("${"))continue;
      const url=decodeURIComponent(match[1].split(/[?#]/)[0]);
      assert.equal(existsSync(path.join("public",url)),true,file+": "+url);
    }
  }
});
