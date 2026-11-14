// Builds a local pool of free-licence photos (Wikimedia Commons, CC0 only) per creator topic, for the
// fake portfolio of scripts/seed-staging-fake-profiles.ts. Nothing here touches a database or a
// Supabase project; nothing of INFLUX is sent to Commons (public search queries only).
//
//   node scripts/fake-profiles/build-photo-pool.ts --out=<dir> [--per-topic=10]
//
// Writes <dir>/<topic>/<n>.jpg and <dir>/manifest.json (title, author, licence, source URL of each
// file: CC0 asks for nothing, the manifest is kept for traceability). Re-runnable: a file already
// downloaded is kept.
import { mkdirSync, existsSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";

const { values } = parseArgs({
  args: process.argv.slice(2).filter((argument) => argument !== "--"),
  options: { out: { type: "string" }, "per-topic": { type: "string" } },
});
if (values.out === undefined) {
  throw new Error("--out=<directory> is required");
}
const out = values.out;
const perTopic = Number(values["per-topic"] ?? "10");

// Commons search phrases per topic code of reference.topics. Subjects are chosen to be objects,
// places, food, animals, sport and scenes rather than portraits.
const QUERIES: Readonly<Record<string, readonly string[]>> = {
  automotive: [
    "classic car",
    "sports car",
    "motorcycle",
    "electric car charging",
    "car interior",
  ],
  beauty: [
    "cosmetics",
    "perfume bottle",
    "lipstick",
    "nail polish",
    "hair salon",
    "skincare",
  ],
  business_finance: [
    "office desk laptop",
    "coworking space",
    "coins savings",
    "business meeting room",
    "stock market screen",
  ],
  culture: [
    "museum exhibition",
    "art gallery",
    "library books",
    "theatre stage",
    "sculpture",
  ],
  education: [
    "classroom",
    "university campus",
    "notebook study",
    "school books",
    "science laboratory",
  ],
  entertainment: [
    "cinema",
    "concert crowd",
    "festival stage",
    "board game",
    "popcorn film",
  ],
  family: [
    "playground",
    "family picnic",
    "children toys",
    "birthday cake",
    "stroller park",
  ],
  fashion: [
    "clothing",
    "sneakers",
    "handbag",
    "jewellery",
    "dress",
    "sunglasses",
    "vintage clothes",
  ],
  food: [
    "street food",
    "pastry",
    "pizza",
    "salad bowl",
    "coffee latte art",
    "sushi",
    "burger",
    "dessert",
  ],
  gaming: [
    "video game console",
    "gaming keyboard",
    "retro arcade",
    "gamepad",
    "esports",
  ],
  home: [
    "living room interior",
    "kitchen interior",
    "houseplants",
    "bedroom interior",
    "garden terrace",
  ],
  music: ["guitar", "piano", "vinyl records", "drum kit", "live band"],
  pets: ["cat", "dog", "puppy", "rabbit pet", "parrot"],
  sport_fitness: [
    "running",
    "yoga",
    "gym weights",
    "cycling",
    "swimming",
    "climbing",
  ],
  tech: [
    "smartphone",
    "laptop",
    "headphones",
    "drone",
    "circuit board",
    "smartwatch",
  ],
  travel: [
    "beach",
    "mountain landscape",
    "old town street",
    "lake sunset",
    "train station",
    "waterfall",
  ],
  wellness: [
    "spa",
    "meditation",
    "herbal tea",
    "wellness massage stones",
    "healthy breakfast",
  ],
};

const CC0 = "haswbstatement:P275=Q6938433";
const USER_AGENT = "InfluxStagingSeed/1.0 (photo pool for fake test data)";

type Candidate = {
  title: string;
  url: string;
  width: number;
  height: number;
  author: string;
  license: string;
};

function strip(html: string | undefined): string {
  return (html ?? "")
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function search(phrase: string): Promise<Candidate[]> {
  const url = new URL("https://commons.wikimedia.org/w/api.php");
  url.search = new URLSearchParams({
    action: "query",
    format: "json",
    generator: "search",
    gsrnamespace: "6",
    gsrsearch: `filetype:bitmap ${phrase} ${CC0}`,
    gsrlimit: "30",
    prop: "imageinfo",
    iiprop: "url|size|extmetadata",
    iiurlwidth: "1400",
  }).toString();
  let response: Response | null = null;
  for (let attempt = 0; attempt < 5 && response?.ok !== true; attempt += 1) {
    if (attempt > 0) {
      await new Promise((resolve) => setTimeout(resolve, 5_000 * attempt));
    }
    response = await fetch(url, {
      headers: { "user-agent": USER_AGENT },
      signal: AbortSignal.timeout(30_000),
    }).catch(() => null);
  }
  if (response?.ok !== true) {
    process.stdout.write(`  search failed after retries: ${phrase}\n`);
    return [];
  }
  const body = (await response.json()) as {
    query?: {
      pages?: Record<string, { title: string; imageinfo?: unknown[] }>;
    };
  };
  const found: Candidate[] = [];
  for (const page of Object.values(body.query?.pages ?? {})) {
    const info = page.imageinfo?.[0] as
      | {
          thumburl?: string;
          width: number;
          height: number;
          extmetadata?: Record<string, { value?: string }>;
        }
      | undefined;
    if (info?.thumburl === undefined) {
      continue;
    }
    const ratio = info.width / info.height;
    // landscape or portrait photos of real size; no panoramas, no tiny scans, JPEG only
    if (
      info.width < 1600 ||
      info.height < 1000 ||
      ratio < 0.6 ||
      ratio > 1.9 ||
      !/\.jpe?g$/i.test(page.title)
    ) {
      continue;
    }
    found.push({
      title: page.title,
      url: info.thumburl,
      width: info.width,
      height: info.height,
      author: strip(info.extmetadata?.Artist?.value) || "unknown",
      license: strip(info.extmetadata?.LicenseShortName?.value) || "CC0",
    });
  }
  return found;
}

async function download(url: string, file: string): Promise<boolean> {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(url, {
      headers: { "user-agent": USER_AGENT },
      signal: AbortSignal.timeout(60_000),
    }).catch(() => null);
    if (response?.ok === true) {
      writeFileSync(file, Buffer.from(await response.arrayBuffer()));
      return true;
    }
    // 429 / 5xx: wait, then again
    await new Promise((resolve) => setTimeout(resolve, 3_000 * (attempt + 1)));
  }
  return false;
}

mkdirSync(out, { recursive: true });
const manifestPath = join(out, "manifest.json");
const manifest: Record<string, (Candidate & { file: string })[]> = existsSync(
  manifestPath,
)
  ? (JSON.parse(readFileSync(manifestPath, "utf8")) as typeof manifest)
  : {};

for (const [topic, phrases] of Object.entries(QUERIES)) {
  const kept = manifest[topic] ?? [];
  if (kept.length >= perTopic) {
    continue;
  }
  const seen = new Set(kept.map((entry) => entry.title));
  mkdirSync(join(out, topic), { recursive: true });
  // round-robin over the phrases so that a topic is not ten photos of the same subject
  const perPhrase = phrases.map(() => [] as Candidate[]);
  for (const [index, phrase] of phrases.entries()) {
    perPhrase[index] = await search(phrase);
    await new Promise((resolve) => setTimeout(resolve, 1_500));
  }
  for (let round = 0; kept.length < perTopic && round < 6; round += 1) {
    for (const list of perPhrase) {
      const candidate = list[round];
      if (
        candidate === undefined ||
        seen.has(candidate.title) ||
        kept.length >= perTopic
      ) {
        continue;
      }
      seen.add(candidate.title);
      const file = join(topic, `${kept.length + 1}.jpg`);
      if (await download(candidate.url, join(out, file))) {
        kept.push({ ...candidate, file });
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }
  }
  manifest[topic] = kept;
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  process.stdout.write(`${topic}: ${kept.length} photos\n`);
}
