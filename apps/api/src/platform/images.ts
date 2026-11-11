// The re-encoding of an image received: the ONLY importer of sharp in apps/api (D80, D82 (2),
// jalons/l2b/stockage.md §1; ESLint and tests/supabase-guards.test.ts). Imported when the server
// loads: a missing native binary refuses the start, /health never turns green, the previous
// deployment is kept. Two chains, one inspection:
// - The type is read from the first bytes (PNG, JPEG, WebP; anything else, PDF and SVG included, is
//   refused: 18 T9.4), and must be what the decoder finds. Never a declared type, never a name.
// - At most 4 096² pixels, the first image only; the orientation applied.
// - The LOGO (reencodeLogo): a longest side of 256 px at least, then a 512 × 512 square by
//   transparent margins (`contain`, never cropped); WebP quality 90, alpha kept, 1 MiB at most.
// - A PIECE of verification (reencodeEvidence, D82 (2)): a longest side of 320 px at least, each side
//   16 383 px at most (the limit of WebP); NEITHER resized NOR cropped (the figures must stay
//   readable); WebP with loss, quality 90, 8 MiB at most.
// - A VISUAL of the portfolio (reencodePortfolio, D82 (7), l2g/modele point 4): the parameters of a
//   piece, neither resized nor cropped, WebP quality 90, 8 MiB at most.
// - All WITHOUT ANY METADATA: no EXIF (GPS, device, dates, thumbnail), XMP, IPTC, ICC profile
//   (converted to sRGB), PNG text, comment, secondary image nor trailing bytes (E1-6, I-1, 18 T9.5,
//   08 CA22). sharp writes none unless asked: the methods keep* and with* that would ask are
//   forbidden in this file by a static guard.
// - Two re-encodings at most at a time in the process, logo, pieces and visuals together; beyond, the
//   caller answers 503.
import {
  BRAND_LOGO_MAX_STORED_BYTES,
  BRAND_LOGO_MIN_SIDE,
  BRAND_LOGO_SIDE,
  type BrandLogoRejection,
} from "@influx/contracts/brand-profile";
import {
  PORTFOLIO_MAX_SIDE,
  PORTFOLIO_MAX_STORED_BYTES,
  PORTFOLIO_MIN_SIDE,
  type PortfolioUploadRejection,
} from "@influx/contracts/creator-portfolio";
import {
  VERIFICATION_EVIDENCE_MAX_SIDE,
  VERIFICATION_EVIDENCE_MAX_STORED_BYTES,
  VERIFICATION_EVIDENCE_MIN_SIDE,
  type VerificationEvidenceRejection,
} from "@influx/contracts/verification";
import sharp, { type OutputInfo, type Sharp } from "sharp";

// No cache of decoded images between requests: an image of a member never outlives its request.
sharp.cache(false);

/** stockage.md §1: the decoder refuses an image of more pixels. */
export const IMAGE_MAX_INPUT_PIXELS = 4096 * 4096;
/** stockage.md §1: re-encodings at the same time in one process. */
export const IMAGE_MAX_CONCURRENT = 2;
/** WebP quality of the stored logo. */
export const LOGO_WEBP_QUALITY = 90;
/** WebP quality of a stored piece (D82 (2): with loss, quality 90). */
export const EVIDENCE_WEBP_QUALITY = 90;
/** WebP quality of a stored visual (l2g/modele point 4: the parameters of a piece). */
export const PORTFOLIO_WEBP_QUALITY = 90;

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

/** The reasons the chains share; each contract names them for its own path. */
type ImageRejection = BrandLogoRejection &
  VerificationEvidenceRejection &
  PortfolioUploadRejection;

export type ReencodedImage = {
  bytes: Buffer;
  width: number;
  height: number;
};

export type ReencodedLogo = ReencodedImage;

export type LogoReencoding =
  | { ok: true; value: ReencodedLogo }
  | { ok: false; reason: BrandLogoRejection };

export type EvidenceReencoding =
  | { ok: true; value: ReencodedImage }
  | { ok: false; reason: VerificationEvidenceRejection };

export type PortfolioReencoding =
  | { ok: true; value: ReencodedImage }
  | { ok: false; reason: PortfolioUploadRejection };

type Refusal = { ok: false; reason: ImageRejection };

function refused(reason: ImageRejection): Refusal {
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
 * The inspection both chains share, before any pixel is decoded: bytes present, the type of the
 * first bytes found by the decoder, the oriented sides within the pixel limit and `maxSide`, the
 * longest one reaching `minSide`.
 */
async function inspect(
  bytes: Uint8Array,
  sides: { minSide: number; maxSide: number },
): Promise<{ ok: true } | Refusal> {
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
  if (
    width * height > IMAGE_MAX_INPUT_PIXELS ||
    Math.max(width, height) > sides.maxSide
  ) {
    return refused("too_many_pixels");
  }
  if (Math.max(width, height) < sides.minSide) {
    return refused("too_small");
  }
  return { ok: true };
}

/** The WebP of a chain, or `undecodable` when sharp fails, `output_too_large` beyond `maxBytes`. */
async function encoded(
  pipeline: Sharp,
  maxBytes: number,
): Promise<{ ok: true; value: ReencodedImage } | Refusal> {
  let output: { data: Buffer; info: OutputInfo };
  try {
    output = await pipeline.toBuffer({ resolveWithObject: true });
  } catch {
    return refused("undecodable");
  }
  if (output.data.length > maxBytes) {
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

/**
 * The logo of a brand from the bytes received: its type checked, its size checked, re-encoded into a
 * WebP square without any metadata; or the reason of the refusal (never a value of the file).
 */
export async function reencodeLogo(bytes: Uint8Array): Promise<LogoReencoding> {
  const inspected = await inspect(bytes, {
    minSide: BRAND_LOGO_MIN_SIDE,
    maxSide: Number.POSITIVE_INFINITY,
  });
  if (!inspected.ok) {
    return inspected;
  }
  return encoded(
    inputOf(bytes, "decode")
      .autoOrient()
      .resize(BRAND_LOGO_SIDE, BRAND_LOGO_SIDE, {
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .toColourspace("srgb")
      .webp({ quality: LOGO_WEBP_QUALITY, alphaQuality: 100 }),
    BRAND_LOGO_MAX_STORED_BYTES,
  );
}

/**
 * A piece of verification from the bytes received (D82 (2)): its type checked, its sides checked,
 * re-encoded into a WebP of the SAME pixels (orientation applied, never resized nor cropped: the
 * figures stay readable) without any metadata; or the reason of the refusal (never a value of the
 * file).
 */
export async function reencodeEvidence(
  bytes: Uint8Array,
): Promise<EvidenceReencoding> {
  const inspected = await inspect(bytes, {
    minSide: VERIFICATION_EVIDENCE_MIN_SIDE,
    maxSide: VERIFICATION_EVIDENCE_MAX_SIDE,
  });
  if (!inspected.ok) {
    return inspected;
  }
  return encoded(
    inputOf(bytes, "decode")
      .autoOrient()
      .toColourspace("srgb")
      .webp({ quality: EVIDENCE_WEBP_QUALITY }),
    VERIFICATION_EVIDENCE_MAX_STORED_BYTES,
  );
}

/**
 * A visual of the portfolio from the bytes received (D82 (7), l2g/modele point 4): the chain of a
 * piece, the same pixels (orientation applied, never resized nor cropped) in a WebP of quality 90
 * without any metadata (RG80, T9.5); or the reason of the refusal (never a value of the file).
 */
export async function reencodePortfolio(
  bytes: Uint8Array,
): Promise<PortfolioReencoding> {
  const inspected = await inspect(bytes, {
    minSide: PORTFOLIO_MIN_SIDE,
    maxSide: PORTFOLIO_MAX_SIDE,
  });
  if (!inspected.ok) {
    return inspected;
  }
  return encoded(
    inputOf(bytes, "decode")
      .autoOrient()
      .toColourspace("srgb")
      .webp({ quality: PORTFOLIO_WEBP_QUALITY }),
    PORTFOLIO_MAX_STORED_BYTES,
  );
}

/**
 * The two slots of the process (stockage.md §1; D82 (2), (7): the logo, the pieces and the visuals
 * share them); a busy
 * process answers 503 before any work.
 */
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
