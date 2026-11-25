// Image work of the fake-profile seed: the curated photo pool, the portfolio visuals (WebP, no
// metadata, 320 px and up, at most 8 MiB: 0242 portfolio_items checks) and the brand logos (WebP,
// 512 px at most, 1 MiB at most: 0204 brand_logo_objects checks).
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
// An operator script that makes test images; D80 (one image pipeline) concerns the uploads of members.
// eslint-disable-next-line no-restricted-imports -- see the line above
import sharp from "sharp";
import { int, pick, shuffle, type Rng } from "./random.ts";

// Photos kept after the visual review of the pool (brand names, artworks, diagrams, nudity and
// screens of the first download were dropped). 1-based: the N of <topic>/N.jpg in the manifest.
const KEPT: Readonly<Record<string, readonly number[]>> = {
  automotive: [1, 2, 3, 4, 7, 9],
  beauty: [3, 4, 8, 9],
  business_finance: [1, 2, 3, 5, 6, 8, 9],
  culture: [1, 2, 3, 7, 8, 10],
  education: [3, 4, 6, 8, 9],
  entertainment: [1, 2, 3, 5, 9, 10],
  family: [1, 3, 4, 5, 7, 9, 10],
  fashion: [1, 2, 3, 4, 6, 7, 9, 10],
  food: [2, 3, 4, 5, 6, 7, 8, 9, 10],
  gaming: [2, 6, 8, 10],
  home: [1, 2, 3, 4, 5, 7, 8],
  music: [1, 3, 6],
  pets: [1, 2, 4, 5, 7, 8],
  sport_fitness: [2, 4, 5, 6, 8, 10],
  tech: [1, 2, 4, 5, 6, 7, 8, 10],
  travel: [1, 2, 3, 4, 5, 7, 9],
  wellness: [3, 4, 5, 7, 8],
};

export type PhotoPool = Map<string, string[]>;

export function loadPhotoPool(dir: string): PhotoPool {
  const pool: PhotoPool = new Map();
  for (const [topic, kept] of Object.entries(KEPT)) {
    pool.set(
      topic,
      kept.map((n) => join(dir, topic, `${n}.jpg`)),
    );
  }
  return pool;
}

export type RenderedImage = {
  buffer: Buffer;
  width: number;
  height: number;
  byteSize: number;
  checksum: string;
};

const RATIOS = [1, 4 / 5, 3 / 2, 5 / 4, 16 / 10, 3 / 4] as const;

function describe(
  buffer: Buffer,
  width: number,
  height: number,
): RenderedImage {
  return {
    buffer,
    width,
    height,
    byteSize: buffer.byteLength,
    checksum: createHash("sha256").update(buffer).digest("hex"),
  };
}

/** One portfolio visual: a crop of a pool photo, lightly graded, re-encoded without metadata. */
export async function renderPortfolioImage(
  file: string,
  rng: Rng,
): Promise<RenderedImage> {
  const source = sharp(readFileSync(file)).rotate();
  const meta = await source.metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  if (width < 600 || height < 600) {
    throw new Error(`pool photo too small: ${file}`);
  }
  const ratio = pick(rng, RATIOS);
  // the largest crop of that ratio, shrunk a little for variety, at a random place
  let cropWidth = Math.min(width, Math.floor(height * ratio));
  const zoom = 0.72 + rng() * 0.28;
  cropWidth = Math.max(480, Math.floor(cropWidth * zoom));
  const cropHeight = Math.min(height, Math.floor(cropWidth / ratio));
  cropWidth = Math.min(width, Math.floor(cropHeight * ratio));
  const left = int(rng, 0, Math.max(0, width - cropWidth));
  const top = int(rng, 0, Math.max(0, height - cropHeight));
  const longSide = Math.max(cropWidth, cropHeight);
  const scale = Math.min(1, 1600 / longSide);
  const outWidth = Math.max(320, Math.round(cropWidth * scale));
  const outHeight = Math.max(320, Math.round(cropHeight * scale));
  // sharp drops every metadata block (EXIF, ICC, XMP) on output unless asked to keep it
  const { data, info } = await source
    .extract({ left, top, width: cropWidth, height: cropHeight })
    .resize(outWidth, outHeight, { fit: "fill" })
    .modulate({
      brightness: 0.94 + rng() * 0.14,
      saturation: 0.9 + rng() * 0.25,
    })
    .webp({ quality: 78 })
    .toBuffer({ resolveWithObject: true });
  return describe(data, info.width, info.height);
}

/** The pool photos of one creator: distinct sources first, a repeat (another crop) only if short. */
export function choosePhotos(
  pool: PhotoPool,
  topics: readonly string[],
  rng: Rng,
): string[] {
  const used = new Set<string>();
  const chosen: string[] = [];
  for (const topic of topics) {
    const candidates = pool.get(topic) ?? pool.get("travel") ?? [];
    const fresh = shuffle(rng, candidates).filter((file) => !used.has(file));
    const file = fresh[0] ?? pick(rng, candidates);
    used.add(file);
    chosen.push(file);
  }
  return chosen;
}

const PALETTES = [
  ["#0f766e", "#5eead4"],
  ["#1d4ed8", "#93c5fd"],
  ["#b45309", "#fcd34d"],
  ["#9d174d", "#f9a8d4"],
  ["#4338ca", "#c4b5fd"],
  ["#166534", "#86efac"],
  ["#9a3412", "#fdba74"],
  ["#0e7490", "#a5f3fc"],
  ["#7e22ce", "#e9d5ff"],
  ["#be123c", "#fda4af"],
  ["#374151", "#e5e7eb"],
  ["#854d0e", "#fde68a"],
] as const;

function logoSvg(seed: number, rng: Rng): string {
  const [dark, light] = PALETTES[seed % PALETTES.length] as readonly [
    string,
    string,
  ];
  const shape = Math.floor(rng() * 7);
  const background = rng() < 0.5 ? dark : "#111827";
  const ink = background === dark ? "#ffffff" : light;
  const accent =
    background === dark ? light : dark === "#374151" ? "#9ca3af" : light;
  let mark: string;
  switch (shape) {
    case 0:
      mark = `<circle cx="256" cy="256" r="130" fill="none" stroke="${ink}" stroke-width="28"/><circle cx="256" cy="256" r="52" fill="${accent}"/>`;
      break;
    case 1:
      mark = `<rect x="126" y="126" width="260" height="260" rx="56" fill="${ink}"/><path d="M126 386 L386 126 L386 386 Z" fill="${accent}"/>`;
      break;
    case 2:
      mark = `<path d="M256 112 L396 384 L116 384 Z" fill="${ink}"/><path d="M256 232 L326 372 L186 372 Z" fill="${background}"/>`;
      break;
    case 3:
      mark = [140, 226, 312]
        .map(
          (x, i) =>
            `<rect x="${x}" y="${150 + i * 18}" width="60" height="${210 - i * 36}" rx="30" fill="${i === 1 ? accent : ink}"/>`,
        )
        .join("");
      break;
    case 4:
      mark = `<circle cx="214" cy="256" r="104" fill="${ink}" fill-opacity="0.92"/><circle cx="298" cy="256" r="104" fill="${accent}" fill-opacity="0.88"/>`;
      break;
    case 5:
      mark = `<path d="M330 150 A120 120 0 1 0 330 362 A150 150 0 1 1 330 150 Z" fill="${ink}"/><circle cx="352" cy="190" r="26" fill="${accent}"/>`;
      break;
    default:
      mark = `<path d="M256 118 L376 187 L376 325 L256 394 L136 325 L136 187 Z" fill="none" stroke="${ink}" stroke-width="26" stroke-linejoin="round"/><circle cx="256" cy="256" r="34" fill="${accent}"/>`;
  }
  const rounded = rng() < 0.5 ? 96 : 0;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><rect width="512" height="512" rx="${rounded}" fill="${background}"/>${mark}</svg>`;
}

/** A brand logo: a geometric mark on a flat colour, 512 px, WebP. No text, no real trademark. */
export async function renderLogo(
  seed: number,
  rng: Rng,
): Promise<RenderedImage> {
  const { data, info } = await sharp(Buffer.from(logoSvg(seed, rng)))
    .resize(512, 512)
    .webp({ quality: 90 })
    .toBuffer({ resolveWithObject: true });
  return describe(data, info.width, info.height);
}
