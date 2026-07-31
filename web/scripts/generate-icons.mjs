import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

/**
 * Regenerates the PWA icons from an inline SVG: `npm run icons`.
 * Uses the sharp that already ships with Next, so there is no extra dependency.
 * The blue matches --primary from the theme.
 */

const PRIMARY = "#4a7ef7";
const OUT_DIR = path.resolve(process.cwd(), "public/icons");

/** A target/crosshair mark — "the thing you are chasing". */
function svg({ size, padded }) {
  // Maskable icons must keep their art inside the safe zone, so they get more padding.
  const inset = padded ? size * 0.28 : size * 0.2;
  const r = (size - inset * 2) / 2;
  const cx = size / 2;
  const stroke = Math.max(2, size * 0.055);

  return Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${size * 0.18}" fill="${PRIMARY}"/>
  <g fill="none" stroke="#ffffff" stroke-width="${stroke}" stroke-linecap="round">
    <circle cx="${cx}" cy="${cx}" r="${r}"/>
    <circle cx="${cx}" cy="${cx}" r="${r * 0.55}"/>
  </g>
  <circle cx="${cx}" cy="${cx}" r="${r * 0.16}" fill="#ffffff"/>
</svg>`);
}

const TARGETS = [
  { file: "icon-192.png", size: 192, padded: false },
  { file: "icon-512.png", size: 512, padded: false },
  { file: "icon-maskable-192.png", size: 192, padded: true },
  { file: "icon-maskable-512.png", size: 512, padded: true },
  { file: "apple-touch-icon.png", size: 180, padded: false },
];

await mkdir(OUT_DIR, { recursive: true });

for (const target of TARGETS) {
  const png = await sharp(svg(target)).png().toBuffer();
  await writeFile(path.join(OUT_DIR, target.file), png);
  console.log(`wrote public/icons/${target.file} (${target.size}px)`);
}

// Keep a vector copy around for regenerating at other sizes.
await writeFile(path.join(OUT_DIR, "icon.svg"), svg({ size: 512, padded: false }));
console.log("wrote public/icons/icon.svg");
