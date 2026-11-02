// The re-encoding of an image received: the ONLY importer of sharp in apps/api (D80,
// jalons/l2b/stockage.md §1; ESLint and tests/supabase-guards.test.ts). Imported when the server
// loads: a missing native binary refuses the start, /health never turns green, the previous
// deployment is kept.
// - The type is read from the first bytes (PNG, JPEG, WebP; anything else, PDF and SVG included, is
//   refused: 18 T9.4), and must be what the decoder finds. Never a declared type, never a name.
// - At most 4 096² pixels, the first image only, a longest side of 256 px at least; the orientation
//   applied, then a 512 × 512 square by transparent margins (`contain`, never cropped).
// - Output: WebP, quality 90, alpha kept, 1 MiB at most, WITHOUT ANY METADATA: no EXIF (GPS, device,
//   dates, thumbnail), XMP, IPTC, ICC profile (converted to sRGB), PNG text, comment, secondary
//   image nor trailing bytes (E1-6, I-1, 18 T9.5). sharp writes none unless asked: the methods
//   keep* and with* that would ask are forbidden in this file by a static guard.
// - Two re-encodings at most at a time in the process; beyond, the caller answers 503.
import {
  BRAND_LOGO_MAX_STORED_BYTES,
  BRAND_LOGO_MIN_SIDE,
  BRAND_LOGO_SIDE,
  type BrandLogoRejection,
} from "@influx/contracts/brand-profile";
import sharp, { type OutputInfo } from "sharp";

// No cache of decoded images between requests: an image of a member never outlives its request.
sharp.cache(false);

/** stockage.md §1: the decoder refuses an image of more pixels. */
export const IMAGE_MAX_INPUT_PIXELS = 4096 * 4096;
/** stockage.md §1: re-encodings at the same time in one process. */
export const IMAGE_MAX_CONCURRENT = 2;
/** WebP quality of the stored logo. */
export const LOGO_WEBP_QUALITY = 90;

export type SniffedImageType = "png" | "jpeg" | "webp";

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function startsWith(
  bytes: Uint8Array,
  prefix: readonly number[],
  at = 0,
): boolean {
  return (
    bytes.length >= at + prefix.length &&
    prefix.every((value, index) => bytes[at + index] === value)
  );
}

/** The type of an image by its first bytes (T9.4), or null for anything else. */
export function sniffImageType(bytes: Uint8Array): SniffedImageType | null {
  if (startsWith(bytes, PNG_SIGNATURE)) {
    return "png";
  }
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) {
    return "jpeg";
  }
  // RIFF <size> WEBP
  if (
    startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) &&
    startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)
  ) {
    return "webp";
  }
  return null;
}

export type ReencodedLogo = {
  bytes: Buffer;
  width: number;
  height: number;
};

export type LogoReencoding =
  | { ok: true; value: ReencodedLogo }
  | { ok: false; reason: BrandLogoRejection };

function refused(reason: BrandLogoRejection): LogoReencoding {
  return { ok: false, reason };
}

/**
 * What sharp reads of the input: the first image only, any warning an error, and the pixel limit
 * when decoding. The header alone is read without it, so that an image too large is named so.
 */
function inputOf(bytes: Uint8Array, stage: "header" | "decode") {
  return sharp(bytes, {
    limitInputPixels: stage === "header" ? false : IMAGE_MAX_INPUT_PIXELS,
    pages: 1,
    page: 0,
    animated: false,
    failOn: "warning",
  });
}

/**
 * The logo of a brand from the bytes received: its type checked, its size checked, re-encoded into a
 * WebP square without any metadata; or the reason of the refusal (never a value of the file).
 */
export async function reencodeLogo(bytes: Uint8Array): Promise<LogoReencoding> {
  if (bytes.length === 0) {
    return refused("empty");
  }
  const sniffed = sniffImageType(bytes);
  if (sniffed === null) {
    return refused("unsupported_type");
  }
  let width: number;
  let height: number;
  try {
    const metadata = await inputOf(bytes, "header").metadata();
    // The decoder must find what the first bytes announce.
    if (metadata.format !== sniffed) {
      return refused("unsupported_type");
    }
    const oriented = metadata.autoOrient;
    width = oriented.width;
    height = oriented.height;
  } catch {
    return refused("undecodable");
  }
  if (!(width > 0 && height > 0)) {
    return refused("undecodable");
  }
  if (width * height > IMAGE_MAX_INPUT_PIXELS) {
    return refused("too_many_pixels");
  }
  if (Math.max(width, height) < BRAND_LOGO_MIN_SIDE) {
    return refused("too_small");
  }
  let output: { data: Buffer; info: OutputInfo };
  try {
    output = await inputOf(bytes, "decode")
      .autoOrient()
      .resize(BRAND_LOGO_SIDE, BRAND_LOGO_SIDE, {
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .toColourspace("srgb")
      .webp({ quality: LOGO_WEBP_QUALITY, alphaQuality: 100 })
      .toBuffer({ resolveWithObject: true });
  } catch {
    return refused("undecodable");
  }
  if (output.data.length > BRAND_LOGO_MAX_STORED_BYTES) {
    return refused("output_too_large");
  }
  return {
    ok: true,
    value: {
      bytes: output.data,
      width: output.info.width,
      height: output.info.height,
    },
  };
}

/** The two slots of the process (stockage.md §1); a busy process answers 503 before any work. */
export type ImageSlots = {
  /** A slot and its release, or null when both are taken. */
  tryAcquire(): (() => void) | null;
};

export function createImageSlots(
  capacity: number = IMAGE_MAX_CONCURRENT,
): ImageSlots {
  let taken = 0;
  return {
    tryAcquire() {
      if (taken >= capacity) {
        return null;
      }
      taken += 1;
      let released = false;
      return () => {
        if (!released) {
          released = true;
          taken -= 1;
        }
      };
    },
  };
}
