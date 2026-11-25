// What a brand is told about the free texts of a campaign (docs/mvp/09 RG21 to RG23; 17 §4.3;
// jalons/l3b/modele.md). Pure, computed at the typing, never stored, never a refusal and never a
// change of the text: the detection SIGNALS under the field and the moderator decides (RG21).
// Three kinds, one per rejection reason of RG90: a direct contact (e-mail, telephone, handle,
// messenger, bare domain: RG21), a link (RG22) and an amount (RG23). The output is codes and
// positions, never the text that matched (nothing to log). Contact and link signals are those of
// the shared detection of the profiles, unchanged; the amount signal is new.
import {
  locateDirectContact,
  locateInNormalised,
  type ContactSignal,
} from "../shared/contact-detection.ts";

/** What a campaign text may hold that RG21 to RG23 forbid. */
export const CAMPAIGN_TEXT_KINDS = ["contact", "link", "amount"] as const;
export type CampaignTextKind = (typeof CAMPAIGN_TEXT_KINDS)[number];

/** The shape that matched: a contact signal of the profiles, or "amount". */
export type CampaignTextSignal = ContactSignal | "amount";

/** Where a signal was found: a kind, the shape, and a range, never the text itself. */
export type CampaignTextFinding = {
  readonly kind: CampaignTextKind;
  readonly signal: CampaignTextSignal;
  /** First UTF-16 code unit of the range, in the text as it was typed. */
  readonly start: number;
  /** Code unit after the last one of the range. */
  readonly end: number;
};

/**
 * The warning each kind shows under the field (17 §4.3: `campaign.errors.contactInText`,
 * `campaign.errors.amountInText`, and the dedicated message for a link).
 */
export const CAMPAIGN_TEXT_WARNING_CODE: Readonly<
  Record<CampaignTextKind, string>
> = {
  contact: "contactInText",
  link: "linkInText",
  amount: "amountInText",
};

/**
 * The free texts a brand writes and a creator reads, which RG21 to RG23 cover (the internal
 * reference is never published, the lists are chosen from closed sets).
 */
export const CAMPAIGN_FREE_TEXT_FIELDS = [
  "title",
  "publicSummary",
  "brief",
  "productDescription",
  "restrictions",
  "keyMessages",
] as const;
export type CampaignFreeTextField = (typeof CAMPAIGN_FREE_TEXT_FIELDS)[number];

/** A URL (scheme, www, wa.me...) is a link (RG22); a bare domain is a contact (RG21: a domain name). */
function kindOf(signal: ContactSignal): CampaignTextKind {
  return signal === "url" ? "link" : "contact";
}

/**
 * Currency symbols (RG23). The text is read after NFKC, so the full-width forms fold into these.
 * US$, R$, C$ and the like end with one of them.
 */
const SYMBOL = "[€$£¥₹₩₽₺₪₫฿₴₦₱₡₲₵₸₼₾]";

/**
 * ISO 4217 codes in capitals (RG23: "a currency symbol or code"). Four three-letter words that
 * stand next to a number in ordinary capitals (ALL, CUP, SOS, TOP: "TOP 10", "CUP 2026") are left
 * out, so that the signal keeps its meaning; a false alarm costs one look, but not one a day.
 */
const ISO_4217 = [
  "AED",
  "AFN",
  "AMD",
  "ANG",
  "AOA",
  "ARS",
  "AUD",
  "AWG",
  "AZN",
  "BAM",
  "BBD",
  "BDT",
  "BGN",
  "BHD",
  "BIF",
  "BMD",
  "BND",
  "BOB",
  "BRL",
  "BSD",
  "BTN",
  "BWP",
  "BYN",
  "BZD",
  "CAD",
  "CDF",
  "CHF",
  "CLP",
  "CNY",
  "COP",
  "CRC",
  "CVE",
  "CZK",
  "DJF",
  "DKK",
  "DOP",
  "DZD",
  "EGP",
  "ERN",
  "ETB",
  "EUR",
  "FJD",
  "FKP",
  "GBP",
  "GEL",
  "GHS",
  "GIP",
  "GMD",
  "GNF",
  "GTQ",
  "GYD",
  "HKD",
  "HNL",
  "HTG",
  "HUF",
  "IDR",
  "ILS",
  "INR",
  "IQD",
  "IRR",
  "ISK",
  "JMD",
  "JOD",
  "JPY",
  "KES",
  "KGS",
  "KHR",
  "KMF",
  "KPW",
  "KRW",
  "KWD",
  "KYD",
  "KZT",
  "LAK",
  "LBP",
  "LKR",
  "LRD",
  "LSL",
  "LYD",
  "MAD",
  "MDL",
  "MGA",
  "MKD",
  "MMK",
  "MNT",
  "MOP",
  "MRU",
  "MUR",
  "MVR",
  "MWK",
  "MXN",
  "MYR",
  "MZN",
  "NAD",
  "NGN",
  "NIO",
  "NOK",
  "NPR",
  "NZD",
  "OMR",
  "PAB",
  "PEN",
  "PGK",
  "PHP",
  "PKR",
  "PLN",
  "PYG",
  "QAR",
  "RON",
  "RSD",
  "RUB",
  "RWF",
  "SAR",
  "SBD",
  "SCR",
  "SDG",
  "SEK",
  "SGD",
  "SHP",
  "SLE",
  "SRD",
  "SSP",
  "STN",
  "SVC",
  "SYP",
  "SZL",
  "THB",
  "TJS",
  "TMT",
  "TND",
  "TRY",
  "TTD",
  "TWD",
  "TZS",
  "UAH",
  "UGX",
  "USD",
  "UYU",
  "UZS",
  "VES",
  "VND",
  "VUV",
  "WST",
  "XAF",
  "XCD",
  "XOF",
  "XPF",
  "YER",
  "ZAR",
  "ZMW",
  "ZWL",
] as const;

/** A code stands alone among letters; digits may touch it (800CHF). */
const CODE = `(?<!\\p{L})(?:${ISO_4217.join("|")})(?![\\p{L}\\p{N}])`;
/** A number as written: digit groups joined by a space, a comma, a point or an apostrophe. */
const NUMBER = "\\p{Nd}+(?:[\\u00a0\\u202f ,.']\\p{Nd}+)*";
/** 500 €, 2k€, 1 500 EUR, 500EUR */
const NUMBER_THEN_CURRENCY = new RegExp(
  `${NUMBER}\\s?[kKmM]?\\s?(?:${SYMBOL}|${CODE})`,
  "gu",
);
/** €500, EUR 500, $ 1,500 */
const CURRENCY_THEN_NUMBER = new RegExp(
  `(?:${SYMBOL}|${CODE})\\s?${NUMBER}`,
  "gu",
);

function amountRanges(
  normalised: string,
): readonly (readonly [number, number])[] {
  const ranges: (readonly [number, number])[] = [];
  for (const pattern of [NUMBER_THEN_CURRENCY, CURRENCY_THEN_NUMBER]) {
    for (const match of normalised.matchAll(pattern)) {
      ranges.push([match.index, match.index + match[0].length]);
    }
  }
  return ranges;
}

const KIND_ORDER = (kind: CampaignTextKind): number =>
  CAMPAIGN_TEXT_KINDS.indexOf(kind);

/**
 * Every place a signal shows in a campaign text (RG21 to RG23: the kind and the position, never the
 * text), in the order of the text. Positions are in the text as it was typed. An empty or absent
 * text has none. A number alone is no amount ("2026", "18-24 ans", "3 reels"): it takes a currency
 * symbol or code beside it.
 */
export function detectCampaignText(
  text: string | null | undefined,
): readonly CampaignTextFinding[] {
  if (text === null || text === undefined || text.trim() === "") {
    return [];
  }
  const located = locateDirectContact(text);
  // The domain of a link is part of the link: one finding, not a link and a contact.
  const links = located.filter(({ signal }) => signal === "url");
  const contact = located
    .filter(
      ({ signal, start, end }) =>
        signal !== "domain" ||
        !links.some((link) => link.start <= end && link.end >= start),
    )
    .map(({ signal, start, end }): CampaignTextFinding => ({
      kind: kindOf(signal),
      signal,
      start,
      end,
    }));
  const amounts = locateInNormalised(text, amountRanges).map(
    ({ start, end }): CampaignTextFinding => ({
      kind: "amount",
      signal: "amount",
      start,
      end,
    }),
  );
  return [...contact, ...amounts].sort(
    (a, b) =>
      a.start - b.start ||
      a.end - b.end ||
      KIND_ORDER(a.kind) - KIND_ORDER(b.kind),
  );
}

/** The kinds a text shows, each once, in the order of CAMPAIGN_TEXT_KINDS (what the field warns of). */
export function campaignTextKinds(
  text: string | null | undefined,
): readonly CampaignTextKind[] {
  const found = new Set(detectCampaignText(text).map((hit) => hit.kind));
  return CAMPAIGN_TEXT_KINDS.filter((kind) => found.has(kind));
}
