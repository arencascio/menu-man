// Faithful crops of approved local recordings. No live restaurant/database access.
import { chromium } from "@playwright/test";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";

const folder = "public/brand/previews/featurettes";
const frames = [
  { id: "reel-poster", clip: "home", time: 1, crop: [0, 0, 700, 1516] },
  { id: "mobile", clip: "home", time: 1, crop: [0, 0, 700, 1390] },
  { id: "search", clip: "ordering", time: 20, crop: [0, 110, 700, 770] },
  { id: "ordering", clip: "home", time: 1, crop: [20, 1070, 660, 290] },
  { id: "information", clip: "home", time: 29, crop: [20, 435, 660, 1030] },
];
await mkdir(folder, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const page = await browser.newPage();
  await page.goto("http://localhost:3000/brand/previews/sources.json");
  for (const frame of frames) {
    const data = await page.evaluate(async ({ clip, time, crop }) => {
      const video = document.createElement("video");
      video.muted = true; video.src = `/brand/previews/super-tacos-${clip}.mp4`;
      await new Promise((resolve, reject) => { video.onloadedmetadata = resolve; video.onerror = reject; });
      video.currentTime = time;
      await new Promise((resolve) => { video.onseeked = resolve; });
      const [x, y, width, height] = crop;
      const canvas = document.createElement("canvas"); canvas.width = width; canvas.height = height;
      canvas.getContext("2d").drawImage(video, x, y, width, height, 0, 0, width, height);
      const output = canvas.toDataURL("image/webp", .9);
      video.removeAttribute("src"); video.load(); return output;
    }, frame);
    const image = Buffer.from(data.split(",")[1], "base64");
    const source = `public/brand/previews/super-tacos-${frame.clip}.mp4`;
    await writeFile(`${folder}/${frame.id}.webp`, image);
    Object.assign(frame, { source, sourceSha256: createHash("sha256").update(await readFile(source)).digest("hex"), file: `${frame.id}.webp`, bytes: image.length, sha256: createHash("sha256").update(image).digest("hex") });
  }
  await writeFile(`${folder}/sources.json`, JSON.stringify({ provenance: "Unretouched viewport crops from owner-approved product recordings; timestamps in seconds; crop is x/y/width/height in source pixels. No UI was generated.", frames }, null, 2));
  console.log(frames.map(({ id, bytes }) => ({ id, bytes })));
} finally { await browser.close(); }
