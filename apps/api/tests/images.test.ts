// The re-encoding of the logo (D80, jalons/l2b/stockage.md §1; 18 T9.4, T9.5; E1-6, E1-9, I-1):
// the type read from the first bytes, the refusals, the 512 × 512 WebP square, and above all the
// metadata GONE, proved on the bytes of the output, never on a flag (T9.5). The three fixtures of
// tests/fixtures carry what a phone or an editor leaves in a file, checked here first (the
// witnesses): a geotagged JPEG (EXIF GPS 48°51'29.64"N 2°17'40.32"E, device, dates, XMP, EXIF
// orientation 6), a PNG with an ICC profile (iCCP) and a text chunk (tEXt), a WebP with EXIF, XMP
// and ICC. logo-geotagged.jpg is also the file of the recipe on staging (L2B line 14).
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import {
  createImageSlots,
  IMAGE_MAX_CONCURRENT,
  reencodeEvidence,
  reencodeLogo,
  sniffImageType,
} from "../src/platform/images.ts";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(HERE, "../src");

function fixture(name: string): Buffer {
  return readFileSync(path.join(HERE, "fixtures", name));
}

const FIXTURES = [
  "logo-geotagged.jpg",
  "logo-metadata.png",
  "logo-metadata.webp",
] as const;

/** What the fixtures carry in clear, which no output may (T9.5). */
const KNOWN_VALUES = [
  "Exif",
  "GPS",
  "xmpmeta",
  "INFLUX-TEST",
  "48.858233",
  "48,51.494N",
  "2,17.672E",
  "ICC_PROFILE",
  "iCCP",
  "tEXt",
];

/** The chunks of a RIFF WebP, checked to end exactly where the file ends (no trailing bytes). */
function webpChunks(bytes: Buffer): { fourcc: string; data: Buffer }[] {
  expect(bytes.subarray(0, 4).toString("latin1")).toBe("RIFF");
  expect(bytes.subarray(8, 12).toString("latin1")).toBe("WEBP");
  expect(bytes.readUInt32LE(4) + 8).toBe(bytes.length);
  const chunks: { fourcc: string; data: Buffer }[] = [];
  let offset = 12;
  while (offset < bytes.length) {
    const fourcc = bytes.subarray(offset, offset + 4).toString("latin1");
    const size = bytes.readUInt32LE(offset + 4);
    chunks.push({
      fourcc,
      data: bytes.subarray(offset + 8, offset + 8 + size),
    });
    offset += 8 + size + (size % 2);
  }
  expect(offset).toBe(bytes.length);
  return chunks;
}

/** T9.5 on the bytes: only image chunks, VP8X announcing neither ICC, EXIF nor XMP, no known value. */
function expectNoMetadata(output: Buffer): void {
  const chunks = webpChunks(output);
  for (const chunk of chunks) {
    expect(["VP8X", "VP8 ", "VP8L", "ALPH"]).toContain(chunk.fourcc);
  }
  const extended = chunks.find((chunk) => chunk.fourcc === "VP8X");
  if (extended !== undefined) {
    const flags = extended.data[0] ?? 0;
    // ICC 0x20, EXIF 0x08, XMP 0x04 (RFC 9649 §2.7)
    expect(flags & (0x20 | 0x08 | 0x04)).toBe(0);
  }
  const text = output.toString("latin1");
  for (const value of KNOWN_VALUES) {
    expect(text.includes(value), value).toBe(false);
  }
}

/** The GPS IFD of a TIFF/EXIF block: its latitude, as rationals, or null (the witness of T9.5). */
function gpsLatitudeOf(exif: Buffer): number[] | null {
  // sharp's metadata().exif starts with "Exif\0\0", then the TIFF header
  const tiff = exif.subarray(exif.indexOf("Exif\0\0", 0, "latin1") + 6);
  const little = tiff.subarray(0, 2).toString("latin1") === "II";
  const u16 = (at: number) =>
    little ? tiff.readUInt16LE(at) : tiff.readUInt16BE(at);
  const u32 = (at: number) =>
    little ? tiff.readUInt32LE(at) : tiff.readUInt32BE(at);
  const entriesOf = (ifd: number) =>
    Array.from({ length: u16(ifd) }, (_, index) => ifd + 2 + index * 12);
  const gpsEntry = entriesOf(u32(4)).find((entry) => u16(entry) === 0x8825);
  if (gpsEntry === undefined) {
    return null;
  }
  const latitude = entriesOf(u32(gpsEntry + 8)).find(
    (entry) => u16(entry) === 0x0002,
  );
  if (latitude === undefined) {
    return null;
  }
  const values = u32(latitude + 8);
  return [0, 1, 2].map(
    (index) => u32(values + index * 8) / u32(values + index * 8 + 4),
  );
}

async function png(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 40, g: 90, b: 160 },
    },
  })
    .png()
    .toBuffer();
}

describe("the fixtures carry the metadata T9.5 must remove (witnesses)", () => {
  it("logo-geotagged.jpg: EXIF GPS at the known latitude, device, XMP, orientation 6", async () => {
    const bytes = fixture("logo-geotagged.jpg");
    const metadata = await sharp(bytes).metadata();
    expect(metadata.format).toBe("jpeg");
    expect(metadata.orientation).toBe(6);
    expect(metadata.exif).toBeDefined();
    expect(gpsLatitudeOf(metadata.exif as Buffer)).toEqual([48, 51, 29.64]);
    expect(bytes.toString("latin1")).toContain("INFLUX-TEST-CAMERA");
    expect(metadata.xmp?.toString("utf8")).toContain("48,51.494N");
  });

  it("logo-metadata.png: an ICC profile and a text chunk", async () => {
    const bytes = fixture("logo-metadata.png");
    const metadata = await sharp(bytes).metadata();
    expect(metadata.format).toBe("png");
    expect(metadata.icc).toBeDefined();
    expect(bytes.toString("latin1")).toContain("iCCP");
    expect(metadata.comments?.[0]?.text).toContain("INFLUX-TEST-PNG-TEXT");
  });

  it("logo-metadata.webp: EXIF with GPS, XMP and ICC", async () => {
    const bytes = fixture("logo-metadata.webp");
    const metadata = await sharp(bytes).metadata();
    expect(metadata.format).toBe("webp");
    expect(gpsLatitudeOf(metadata.exif as Buffer)).toEqual([48, 51, 29.64]);
    expect(metadata.xmp).toBeDefined();
    expect(metadata.icc).toBeDefined();
  });
});

describe("T9.5: no metadata in the bytes re-encoded (I-1, E1-6)", () => {
  it.each(FIXTURES)(
    "%s: a 512 × 512 WebP without EXIF, GPS, XMP, ICC nor text",
    async (name) => {
      const outcome = await reencodeLogo(fixture(name));
      expect(outcome.ok).toBe(true);
      if (!outcome.ok) {
        return;
      }
      const { bytes, width, height } = outcome.value;
      expect([width, height]).toEqual([512, 512]);
      expectNoMetadata(bytes);
      const metadata = await sharp(bytes).metadata();
      expect(metadata.format).toBe("webp");
      expect(metadata.exif).toBeUndefined();
      expect(metadata.xmp).toBeUndefined();
      expect(metadata.icc).toBeUndefined();
      expect(metadata.orientation).toBeUndefined();
    },
  );

  it("drops the bytes written after the end of the image", async () => {
    const trailer = Buffer.from("INFLUX-TEST-TRAILER geo 48.858233", "latin1");
    const outcome = await reencodeLogo(
      Buffer.concat([fixture("logo-geotagged.jpg"), trailer]),
    );
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expectNoMetadata(outcome.value.bytes);
    }
  });

  it("applies the orientation, then squares by transparent margins, never cropping", async () => {
    // 600 × 300 stored, orientation 6: a 300 × 600 portrait, i.e. 256 × 512 in the square
    const outcome = await reencodeLogo(fixture("logo-geotagged.jpg"));
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) {
      return;
    }
    const { data, info } = await sharp(outcome.value.bytes)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const alphaAt = (x: number, y: number) =>
      data[(y * info.width + x) * info.channels + 3];
    expect(alphaAt(256, 4)).toBe(255); // top centre: the picture
    expect(alphaAt(256, 507)).toBe(255); // bottom centre: the picture
    expect(alphaAt(8, 256)).toBe(0); // left margin
    expect(alphaAt(503, 256)).toBe(0); // right margin
  });
});

describe("T9.4: the type by the first bytes, PDF and contrary bytes refused (E1-9)", () => {
  it("names PNG, JPEG and WebP by their signature, and nothing else", async () => {
    expect(sniffImageType(fixture("logo-metadata.png"))).toBe("png");
    expect(sniffImageType(fixture("logo-geotagged.jpg"))).toBe("jpeg");
    expect(sniffImageType(fixture("logo-metadata.webp"))).toBe("webp");
    expect(
      sniffImageType(Buffer.from("%PDF-1.7\n%âãÏÓ\n", "latin1")),
    ).toBeNull();
    expect(
      sniffImageType(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>')),
    ).toBeNull();
    expect(sniffImageType(Buffer.from("GIF89a", "latin1"))).toBeNull();
    expect(sniffImageType(Buffer.alloc(0))).toBeNull();
  });

  it("refuses a PDF, an SVG and a GIF whatever their name or declared type", async () => {
    const pdf = Buffer.from(
      "%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF",
      "latin1",
    );
    const svg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"><rect width="512" height="512"/></svg>',
    );
    const gif = await sharp({
      create: { width: 300, height: 300, channels: 3, background: "#123456" },
    })
      .gif()
      .toBuffer();
    for (const bytes of [pdf, svg, gif]) {
      expect(await reencodeLogo(bytes)).toEqual({
        ok: false,
        reason: "unsupported_type",
      });
    }
  });

  it("refuses bytes whose signature contradicts their content", async () => {
    const jpegBody = fixture("logo-geotagged.jpg");
    // a PNG signature, then a JPEG; a RIFF/WEBP header, then a PNG
    const pngHeaded = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      jpegBody,
    ]);
    const webpHeaded = Buffer.concat([
      Buffer.from("RIFF\x00\x10\x00\x00WEBP", "latin1"),
      fixture("logo-metadata.png"),
    ]);
    for (const bytes of [pngHeaded, webpHeaded]) {
      const outcome = await reencodeLogo(bytes);
      expect(outcome.ok).toBe(false);
      if (!outcome.ok) {
        expect(["unsupported_type", "undecodable"]).toContain(outcome.reason);
      }
    }
  });

  it("refuses an empty body and a truncated image", async () => {
    expect(await reencodeLogo(Buffer.alloc(0))).toEqual({
      ok: false,
      reason: "empty",
    });
    const truncated = fixture("logo-geotagged.jpg").subarray(0, 600);
    expect(await reencodeLogo(truncated)).toEqual({
      ok: false,
      reason: "undecodable",
    });
  });
});

describe("the sizes of stockage.md §1 (06 RG15; EC-L2B-02-2, -3)", () => {
  it("accepts a longest side of exactly 256 px, refuses 255", async () => {
    const accepted = await reencodeLogo(await png(256, 40));
    expect(accepted.ok).toBe(true);
    if (accepted.ok) {
      expect([accepted.value.width, accepted.value.height]).toEqual([512, 512]);
    }
    expect(await reencodeLogo(await png(255, 255))).toEqual({
      ok: false,
      reason: "too_small",
    });
  });

  it("refuses more than 4 096² pixels before decoding them", async () => {
    expect(await reencodeLogo(await png(4097, 4096))).toEqual({
      ok: false,
      reason: "too_many_pixels",
    });
  });
});

describe("a piece of verification: the same pixels, no metadata (D82 (2); 08 CA21, CA22; T9.4, T9.5)", () => {
  it.each(["logo-geotagged.jpg", "logo-metadata.webp"] as const)(
    "%s: a WebP without EXIF, GPS, XMP, ICC nor text, read in its bytes (T9.5, CA22)",
    async (name) => {
      const outcome = await reencodeEvidence(fixture(name));
      expect(outcome.ok).toBe(true);
      if (!outcome.ok) {
        return;
      }
      expectNoMetadata(outcome.value.bytes);
      const metadata = await sharp(outcome.value.bytes).metadata();
      expect(metadata.format).toBe("webp");
      expect(metadata.exif).toBeUndefined();
      expect(metadata.xmp).toBeUndefined();
      expect(metadata.icc).toBeUndefined();
      expect(metadata.orientation).toBeUndefined();
    },
  );

  it("drops an ICC profile and the bytes after the end of the image", async () => {
    const withProfile = await sharp({
      create: { width: 640, height: 400, channels: 3, background: "#204060" },
    })
      .withIccProfile("p3")
      .png()
      .toBuffer();
    expect((await sharp(withProfile).metadata()).icc).toBeDefined();
    const trailer = Buffer.from("INFLUX-TEST-TRAILER geo 48.858233", "latin1");
    for (const bytes of [
      withProfile,
      Buffer.concat([fixture("logo-geotagged.jpg"), trailer]),
    ]) {
      const outcome = await reencodeEvidence(bytes);
      expect(outcome.ok).toBe(true);
      if (outcome.ok) {
        expectNoMetadata(outcome.value.bytes);
      }
    }
  });

  it("applies the orientation and keeps every pixel: never resized, never cropped, no margin", async () => {
    // 600 × 300 stored, orientation 6: a 300 × 600 portrait, as is
    const oriented = await reencodeEvidence(fixture("logo-geotagged.jpg"));
    expect(
      oriented.ok && [oriented.value.width, oriented.value.height],
    ).toEqual([300, 600]);
    // a long capture of a phone keeps its sides
    const capture = await reencodeEvidence(await png(1290, 2796));
    expect(capture.ok && [capture.value.width, capture.value.height]).toEqual([
      1290, 2796,
    ]);
    if (capture.ok) {
      const { info } = await sharp(capture.value.bytes)
        .raw()
        .toBuffer({ resolveWithObject: true });
      expect([info.width, info.height]).toEqual([1290, 2796]);
    }
  });

  it("refuses a PDF, an SVG and contrary bytes, whatever their name (T9.4, CA21)", async () => {
    const pdf = Buffer.from(
      "%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF",
      "latin1",
    );
    const svg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800"/>',
    );
    for (const bytes of [pdf, svg]) {
      expect(await reencodeEvidence(bytes)).toEqual({
        ok: false,
        reason: "unsupported_type",
      });
    }
    const pngHeaded = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      fixture("logo-geotagged.jpg"),
    ]);
    const outcome = await reencodeEvidence(pngHeaded);
    expect(outcome.ok).toBe(false);
    expect(await reencodeEvidence(Buffer.alloc(0))).toEqual({
      ok: false,
      reason: "empty",
    });
  });

  it("accepts a longest side of exactly 320 px, refuses 319 (D82 (2))", async () => {
    const accepted = await reencodeEvidence(await png(320, 40));
    expect(
      accepted.ok && [accepted.value.width, accepted.value.height],
    ).toEqual([320, 40]);
    expect(await reencodeEvidence(await png(319, 319))).toEqual({
      ok: false,
      reason: "too_small",
    });
    // the logo fixture of 300 × 200 is too small for a piece
    expect(await reencodeEvidence(fixture("logo-metadata.png"))).toEqual({
      ok: false,
      reason: "too_small",
    });
  });

  it("refuses more than 4 096² pixels, and a side over 16 383 (the limit of WebP)", async () => {
    expect(await reencodeEvidence(await png(4097, 4096))).toEqual({
      ok: false,
      reason: "too_many_pixels",
    });
    expect(await reencodeEvidence(await png(16_384, 64))).toEqual({
      ok: false,
      reason: "too_many_pixels",
    });
  });
});

describe("two re-encodings at a time in a process (stockage.md §1)", () => {
  it("gives two slots, refuses a third, and frees a slot once (a second release is void)", () => {
    const slots = createImageSlots();
    expect(IMAGE_MAX_CONCURRENT).toBe(2);
    const first = slots.tryAcquire();
    const second = slots.tryAcquire();
    expect(first).not.toBeNull();
    expect(second).not.toBeNull();
    expect(slots.tryAcquire()).toBeNull();
    first?.();
    first?.();
    expect(slots.tryAcquire()).not.toBeNull();
    expect(slots.tryAcquire()).toBeNull();
  });
});

describe("static guards of the two adapters (stockage.md §1, §2)", () => {
  it("never asks sharp to keep or write a metadata (keep* and with* forbidden)", () => {
    const source = readFileSync(path.join(SRC, "platform/images.ts"), "utf8");
    expect(source).not.toMatch(
      /\.\s*(?:keep|with)(?:Exif|ExifMerge|IccProfile|Xmp|Metadata|GainMap|Density)\s*\(/,
    );
  });

  it("never signs, publishes nor lists an object of Storage", () => {
    const source = readFileSync(path.join(SRC, "platform/storage.ts"), "utf8");
    expect(source).not.toMatch(
      /\.\s*(?:createSignedUrls?|createSignedUploadUrl|uploadToSignedUrl|getPublicUrl|list|listV2|move|copy|update|info|exists)\s*\(/,
    );
    expect(source).not.toMatch(/upsert:\s*true/);
    expect(source).toMatch(/upsert:\s*false/);
  });
});
