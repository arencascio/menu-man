// Explicit asset preparation only. No application/database credentials used.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
const directory = 'public/img/super-tacos';
mkdirSync(directory, { recursive: true });
const sources = [
  ['tacos', 'https://unsplash.com/photos/three-tacos-are-sitting-on-a-plate-next-to-a-glass-of-beer-5mpht0M5H0E', 'We The Creators'],
  ['asada', 'https://unsplash.com/photos/two-tacos-on-a-black-plate-with-a-lime-kDdYK9Jki7M', 'Andrea Lacasse'],
  ['burrito', 'https://unsplash.com/photos/a-white-plate-topped-with-a-burrito-and-rice-gBqlz19UlnI', 'Gaby Aziz'],
  ['churros', 'https://unsplash.com/photos/churros-on-chopping-board-ewylbQ9e6go', 'WantTo Create'],
  ['nachos', 'https://www.pexels.com/photo/close-up-of-cheesy-nachos-12557556/', 'Alejandro Aznar', 'https://images.pexels.com/photos/12557556/pexels-photo-12557556.jpeg?auto=compress&cs=tinysrgb&w=1200'],
  ['quesadilla', 'https://www.pexels.com/photo/close-up-photo-of-quesadilla-5840093/', 'ROMAN ODINTSOV', 'https://images.pexels.com/photos/5840093/pexels-photo-5840093.jpeg?auto=compress&cs=tinysrgb&w=1200'],
  ['guacamole', 'https://www.pexels.com/photo/a-flatlay-of-chips-beside-a-bowl-of-guacamole-7227467/', 'Suzy Hazelwood', 'https://images.pexels.com/photos/7227467/pexels-photo-7227467.jpeg?auto=compress&cs=tinysrgb&w=1200'],
  ['lemonade', 'https://www.pexels.com/photo/lemonade-in-glass-on-table-25409639/', 'Ebru DOĞAN', 'https://images.pexels.com/photos/25409639/pexels-photo-25409639.jpeg?auto=compress&cs=tinysrgb&w=1200'],
];
const manifest = [];
for (const [name, source, photographer, explicit] of sources) {
  let image = explicit;
  if (!image) {
    const html = execFileSync('curl.exe', ['-fLsS', '--max-time', '30', source], {maxBuffer: 12_000_000}).toString();
    const meta = html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/)
      || html.match(/<meta[^>]+content="([^"]+)"[^>]+property="og:image"/);
    if (!meta) throw new Error(`No image metadata: ${source}`);
    image = meta[1].replaceAll('&amp;', '&');
    const url = new URL(image);
    if (url.hostname !== 'images.unsplash.com') throw new Error('Unexpected photo host');
    url.search = '?auto=format&fit=crop&w=1600&q=85';
    image = url.href;
  }
  const path = `${directory}/${name}.jpg`;
  execFileSync('curl.exe', ['-fLsS', '--max-time', '30', image, '-o', path]);
  const bytes = readFileSync(path);
  if (bytes.length < 5000 || bytes[0] !== 0xff || bytes[1] !== 0xd8) throw new Error(`Not a JPEG: ${name}`);
  manifest.push({file: `${name}.jpg`, source, photographer, download: image,
    license: source.includes('unsplash.com') ? 'https://unsplash.com/license' : 'https://www.pexels.com/license/',
    retrieved: new Date().toISOString().slice(0,10), sha256: createHash('sha256').update(bytes).digest('hex')});
  console.log(`Prepared licensed photograph: ${name}`);
}
writeFileSync(`${directory}/sources.json`, JSON.stringify(manifest, null, 2)+'\n');
