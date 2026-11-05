// What the decision screen of queue 1 reads out of the entry (docs/mvp/06 RG9, RG15, RG19, RG25, RG70;
// 17b §2.5; jalons/l2c/file.md A3, A4, A7; L2C-17): the profile as the live row holds it (the last
// VALIDATED version), the revisions side by side with it, the alerts in words, and what changed
// between two readings of the same entry (L2BS-1: "modifié après examen"). Pure functions, outside
// the components. No rule is decided here: apps/api and the database say what is on the profile,
// what is an alert, and which version a decision binds; this module only words and compares.
import type {
  ModeratedFieldCode,
  OpenEntryResponse,
  ReviewAlert,
  ReviewedProfile,
  ReviewedRevision,
  RevisionValue,
} from "@influx/contracts/backoffice-queues";
import { messages } from "@/messages/fr";
import { countryName, formatDate } from "./view-model";

const t = messages.queueReview;

/** A code of a reference list, readable without a table of labels: "sports_leisure" → "Sports leisure". */
export function humanCode(code: string): string {
  const words = code.replace(/_/g, " ").trim();
  return words === "" ? code : words.charAt(0).toUpperCase() + words.slice(1);
}

function listOf(
  values: readonly string[],
  render: (value: string) => string,
): string {
  return values.length === 0 ? t.none : values.map(render).join(", ");
}

/** One line of the block "La marque": a label, its value, and the moderated field it shows (A4). */
export type Fact = {
  key: string;
  label: string;
  value: string;
  /** A free text keeps its line breaks. */
  multiline: boolean;
  field: ModeratedFieldCode | null;
};

function fact(
  key: string,
  label: string,
  value: string | null,
  options: { multiline?: boolean; field?: ModeratedFieldCode } = {},
): Fact {
  return {
    key,
    label,
    value: value === null || value.trim() === "" ? t.unset : value,
    multiline: options.multiline === true,
    field: options.field ?? null,
  };
}

function languageName(code: string): string {
  const known = messages.languages as Readonly<Record<string, string>>;
  return known[code] ?? humanCode(code);
}

function companySizeWords(band: string | null): string | null {
  if (band === null) {
    return null;
  }
  const known = t.companySizes as Readonly<Record<string, string>>;
  return known[band] ?? humanCode(band);
}

function yesNo(value: boolean | null): string | null {
  return value === null ? null : value ? t.yes : t.no;
}

/** The profile in the order of the form (06 RG15), as validated; the revisions are another block. */
export function profileFacts(view: OpenEntryResponse): Fact[] {
  const { profile, account } = view;
  const { lists } = profile;
  const statuses = t.statuses as Readonly<Record<string, string>>;
  return [
    fact("brandName", t.facts.brandName, profile.brandName, {
      field: "advertiser.brand_name",
    }),
    fact("status", t.facts.status, statuses[profile.status] ?? profile.status),
    fact("country", t.facts.country, countryName(account.countryCode)),
    fact("language", t.facts.language, languageName(account.preferredLanguage)),
    fact("owner", t.facts.owner, account.owner?.displayName ?? null),
    fact(
      "primarySector",
      t.facts.primarySector,
      profile.primarySector === null ? null : humanCode(profile.primarySector),
      { field: "advertiser.primary_sector" },
    ),
    fact(
      "secondarySectors",
      t.facts.secondarySectors,
      listOf(lists.secondarySectors, humanCode),
    ),
    fact(
      "companySize",
      t.facts.companySize,
      companySizeWords(profile.companySize),
    ),
    fact("websiteDomain", t.facts.websiteDomain, profile.websiteDomain, {
      field: "advertiser.website_domain",
    }),
    fact("presentation", t.facts.presentation, profile.presentation, {
      multiline: true,
      field: "advertiser.presentation",
    }),
    fact(
      "targetMarkets",
      t.facts.targetMarkets,
      listOf(lists.targetMarkets, countryName),
    ),
    fact(
      "workingLanguages",
      t.facts.workingLanguages,
      listOf(lists.workingLanguages, languageName),
    ),
    fact("topics", t.facts.topics, listOf(lists.topics, humanCode)),
    fact("networks", t.facts.networks, listOf(lists.networks, humanCode)),
    fact("formats", t.facts.formats, listOf(lists.formats, humanCode)),
    fact(
      "audienceCountries",
      t.facts.audienceCountries,
      listOf(lists.audienceCountries, countryName),
    ),
    fact(
      "usageRights",
      t.facts.usageRights,
      listOf(lists.usageRights, humanCode),
    ),
    fact(
      "exclusivity",
      t.facts.exclusivity,
      profile.exclusivityBand === null
        ? null
        : humanCode(profile.exclusivityBand),
    ),
    fact(
      "rhythm",
      t.facts.rhythm,
      profile.collaborationRhythm === null
        ? null
        : humanCode(profile.collaborationRhythm),
    ),
    fact("nonMonetary", t.facts.nonMonetary, yesNo(profile.offersNonMonetary)),
    fact(
      "contactRole",
      t.facts.contactRole,
      profile.contactRole === null ? null : humanCode(profile.contactRole),
      { field: "advertiser.contact_role" },
    ),
    fact(
      "completeness",
      t.facts.completeness,
      profile.completenessPercent === null
        ? null
        : `${profile.completenessPercent} %`,
    ),
  ];
}

/** The characteristics of a logo, never its bytes (no route serves them yet): size, weight, date. */
export function logoLine(logo: {
  byteSize: number | null;
  width: number | null;
  height: number | null;
  activatedAt: string | null;
}): string {
  return t.logo.line(
    logo.width !== null && logo.height !== null
      ? t.logo.dimensions(logo.width, logo.height)
      : null,
    logo.byteSize === null
      ? null
      : t.logo.kilobytes(Math.max(1, Math.round(logo.byteSize / 1024))),
    logo.activatedAt === null ? null : formatDate(logo.activatedAt),
  );
}

export type LogoFact = {
  key: "active" | "inReview";
  label: string;
  line: string;
};

/** The active logo, and the one under examination when a revision proposes it (A4). */
export function logoFacts(profile: ReviewedProfile): LogoFact[] {
  const { active, inReview } = profile.logos;
  const facts: LogoFact[] = [
    {
      key: "active",
      label: t.logo.active,
      line: active === null ? t.logo.none : logoLine(active),
    },
  ];
  if (inReview !== null) {
    facts.push({
      key: "inReview",
      label: t.logo.inReview,
      line: logoLine(inReview),
    });
  }
  return facts;
}

/** The contact person (L2BS-7): seen here and nowhere else, in a block that says it is logged. */
export function contactFacts(
  contact: ReviewedProfile["contact"],
): { key: string; label: string; value: string }[] {
  const lines: [string, string, string | null][] = [
    ["firstName", t.contact.firstName, contact.firstName],
    ["email", t.contact.email, contact.email],
    ["phone", t.contact.phone, contact.phone],
    ["url", t.contact.url, contact.url],
  ];
  return lines.map(([key, label, value]) => ({
    key,
    label,
    value: value === null || value === "" ? t.unset : value,
  }));
}

/** The label of a moderated field, as the list of the queue words it. */
export function fieldLabel(field: ModeratedFieldCode): string {
  return messages.queueList.fields[field];
}

function textValueWords(
  field: ModeratedFieldCode,
  text: string | null,
  side: "validated" | "proposed",
): string {
  if (text === null) {
    return side === "proposed" ? t.written.removed : t.written.emptyValue;
  }
  if (text.trim() === "") {
    return t.written.emptyValue;
  }
  return field === "advertiser.primary_sector" ||
    field === "advertiser.contact_role"
    ? humanCode(text)
    : text;
}

function valueWords(
  field: ModeratedFieldCode,
  value: RevisionValue,
  side: "validated" | "proposed",
): string {
  if (value.kind === "logo") {
    if (value.logoObjectId === null) {
      return side === "proposed"
        ? t.written.logoRemoved
        : t.written.logoNoneYet;
    }
    return side === "proposed" ? t.written.logoNew : t.written.logoCurrent;
  }
  return textValueWords(field, value.text, side);
}

/** A pending revision as two columns, the validated value and the proposed one (06 RG9). */
export type RevisionRow = {
  id: string;
  field: ModeratedFieldCode;
  label: string;
  validated: string;
  proposed: string;
  multiline: boolean;
};

export function revisionRows(
  revisions: readonly ReviewedRevision[],
): RevisionRow[] {
  return revisions.map((revision) => ({
    id: revision.id,
    field: revision.fieldCode,
    label: fieldLabel(revision.fieldCode),
    validated: valueWords(revision.fieldCode, revision.validated, "validated"),
    proposed: valueWords(revision.fieldCode, revision.proposed, "proposed"),
    multiline: revision.fieldCode === "advertiser.presentation",
  }));
}

/** An alert in a sentence (06 RG19, RG25, RG70, L2BS-8): the field and the kind, never the text found. */
export function alertLine(alert: ReviewAlert): string {
  const a = t.alerts;
  switch (alert.code) {
    case "direct_contact":
      return a.direct_contact(
        a.fields[alert.field],
        alert.signals.map((signal) => a.signals[signal]).join(", "),
      );
    case "unusual_website_domain":
      return a.unusual_website_domain;
    case "duplicate_brand":
      return a.duplicate_brand(
        alert.matches.map((match) => match.brandName).join(", "),
      );
    case "duplicate_domain":
      return a.duplicate_domain(
        alert.matches.map((match) => match.brandName).join(", "),
      );
  }
}

type Comparable = ReadonlyMap<string, { label: string; value: string }>;

/** Everything an agent reads on the screen, keyed, to tell what changed between two readings. */
function comparableOf(view: OpenEntryResponse): Comparable {
  const found = new Map<string, { label: string; value: string }>();
  for (const row of profileFacts(view)) {
    found.set(row.key, { label: row.label, value: row.value });
  }
  for (const logo of logoFacts(view.profile)) {
    found.set(`logo.${logo.key}`, { label: logo.label, value: logo.line });
  }
  for (const row of revisionRows(view.revisions)) {
    found.set(`revision.${row.field}`, {
      label: `${t.sections.written} — ${row.label}`,
      value: `${row.validated} → ${row.proposed}`,
    });
  }
  return found;
}

export type ChangeSet = {
  /** The keys of the lines that differ, for the mention "modifié après examen" next to them. */
  keys: ReadonlySet<string>;
  /** Their labels, in reading order, for the sentence above the profile. */
  labels: readonly string[];
};

/**
 * What differs between the reading the agent made and the one just made (A3, L2BS-1): a line that
 * changed, appeared or went away. Empty when nothing the screen shows has moved.
 */
export function changesBetween(
  before: OpenEntryResponse,
  after: OpenEntryResponse,
): ChangeSet {
  const was = comparableOf(before);
  const now = comparableOf(after);
  const keys = new Set<string>();
  const labels: string[] = [];
  for (const [key, line] of now) {
    if (was.get(key)?.value !== line.value) {
      keys.add(key);
      labels.push(line.label);
    }
  }
  for (const [key, line] of was) {
    if (!now.has(key)) {
      keys.add(key);
      labels.push(line.label);
    }
  }
  return { keys, labels };
}
