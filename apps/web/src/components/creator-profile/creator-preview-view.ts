// What the preview "ce que voit une marque" says of the projection (docs/mvp/07 RG16, RG84, RG102,
// RG103, RG104; 17 §5.2, §7.1; jalons/l2g, commit 14): the tab "before" and the tab "after" as lists of
// labelled rows, built from the answer of `GET /v1/me/creator-profile/preview` and from nothing else.
// A value that is not served is not shown; a value that is served is shown, each row naming the field of
// the projection it comes from (`field`), so that a test can prove the view renders every served field
// and no other. No recomputation (RG104): bands stay bands, an exact figure stays the number given, and
// the date and the source of the figures come with them (RG49). Pure functions, unit-tested
// (tests/creator-preview-view.test.ts); the component only draws. No amount, rate, net or price
// exists in the projection (D48, D78, RG103), so none is read here.
import type {
  CreatorPreviewResponse,
  CreatorProjectionAfter,
  CreatorProjectionBefore,
  CreatorProjectionIdentifiedNetwork,
  CreatorProjectionNetwork,
} from "@influx/contracts/creator-projection";

export type PreviewTab = "before" | "after";

/** The card shows the first three approved visuals (17 §7.1, RG84); none: a card without an image. */
export const PREVIEW_VISUALS_SHOWN = 3;

/**
 * The words of the view, in the language of the page. `text` reads a key of the namespace
 * `creatorProfile` and may be asked only for a key that exists; `has` tells whether one does (a code
 * with no label shows as itself, never an invented one).
 */
export type PreviewLabels = {
  text: (key: string, values?: Record<string, string | number>) => string;
  has: (key: string) => boolean;
  topic: (code: string) => string;
  network: (code: string) => string;
  format: (code: string) => string;
  usageRight: (code: string) => string;
  exclusivity: (code: string) => string;
  country: (code: string) => string;
  language: (code: string) => string;
  date: (iso: string) => string;
  count: (value: number) => string;
};

/** A labelled value, with the field of the projection it renders. */
export type PreviewRow = { field: string; label: string; value: string };

export type PreviewMetric = PreviewRow & {
  /** The exact figure the "after" tab serves beside the band, as the API gave it; null when none. */
  exact: string | null;
};

export type PreviewBadge = { level: string; text: string };

export type PreviewNetwork = {
  /** The fields of the projection this line renders, for the proof of the test. */
  fields: string[];
  code: string;
  name: string;
  primary: boolean;
  badges: PreviewBadge[];
  metrics: PreviewMetric[];
  /** « Déclarés par le créateur · chiffres au 12 mars 2026 »: the source and the date of the figures (RG49). */
  figures: string;
  /** Handle and URL, the "after" tab only. */
  identity: PreviewRow[];
  /** Said when the exact figures of an observed line are not read here (EC-L2G-09-3). */
  observedNote: string | null;
};

export type PreviewVisual = {
  id: string;
  position: number;
  caption: string | null;
};

export type PreviewCard = {
  alias: string;
  headline: string | null;
  bio: string | null;
  /** The first visuals of the card, in the creator's order; empty: no image (RG84). */
  visuals: PreviewVisual[];
  profile: PreviewRow[];
  networks: PreviewNetwork[];
  audience: PreviewRow[];
  /** The exact shares of the main line, the "after" tab only. */
  shares: PreviewRow[];
  offer: PreviewRow[];
};

function labelOf(labels: PreviewLabels, group: string, code: string): string {
  const key = `${group}.${code}`;
  return labels.has(key) ? labels.text(key) : code;
}

function row(field: string, label: string, value: string): PreviewRow {
  return { field, label, value };
}

function listOf(values: readonly string[]): string {
  return values.join(", ");
}

/** The rows of the profile that carry no network: topics, tones, languages, residence, experience. */
function profileRowsOf(
  p: CreatorProjectionBefore,
  labels: PreviewLabels,
): PreviewRow[] {
  const rows: PreviewRow[] = [];
  if (p.primaryTopic !== null) {
    rows.push(
      row(
        "primaryTopic",
        labels.text("fields.primaryTopic.label"),
        labels.topic(p.primaryTopic),
      ),
    );
  }
  if (p.secondaryTopics.length > 0) {
    rows.push(
      row(
        "secondaryTopics",
        labels.text("fields.secondaryTopics.label"),
        listOf(p.secondaryTopics.map(labels.topic)),
      ),
    );
  }
  if (p.tones.length > 0) {
    rows.push(
      row(
        "tones",
        labels.text("fields.tones.label"),
        listOf(p.tones.map((code) => labelOf(labels, "reference.tone", code))),
      ),
    );
  }
  if (p.publicationLanguages.length > 0) {
    rows.push(
      row(
        "publicationLanguages",
        labels.text("fields.publicationLanguages.label"),
        listOf(p.publicationLanguages.map(labels.language)),
      ),
    );
  }
  rows.push(
    row(
      "residenceCountry",
      labels.text("fields.residenceCountry.label"),
      labels.country(p.residenceCountry),
    ),
  );
  if (p.travelScope !== null) {
    rows.push(
      row(
        "travelScope",
        labels.text("fields.travelScope.label"),
        labelOf(labels, "travel", p.travelScope),
      ),
    );
  }
  if (p.collaborationExperience !== null) {
    rows.push(
      row(
        "collaborationExperience",
        labels.text("fields.collaborationExperience.label"),
        labelOf(labels, "experience", p.collaborationExperience),
      ),
    );
  }
  return rows;
}

/** The audience of the main line, as bands (RG58): the main country and its band, the others, the ages, the gender. */
function audienceRowsOf(
  p: CreatorProjectionBefore,
  labels: PreviewLabels,
): PreviewRow[] {
  const rows: PreviewRow[] = [];
  if (p.mainAudienceCountry !== null) {
    rows.push(
      row(
        "mainAudienceCountry",
        labels.text("preview.mainAudience"),
        labels.country(p.mainAudienceCountry),
      ),
    );
    if (p.mainAudienceShareBand !== null) {
      rows.push(
        row(
          "mainAudienceShareBand",
          labels.country(p.mainAudienceCountry),
          labelOf(labels, "preview.share", p.mainAudienceShareBand),
        ),
      );
    }
  }
  const others = p.audienceBands.filter((band) => band.dimension === "country");
  if (others.length > 0) {
    rows.push(
      row(
        "audienceBands",
        labels.text("preview.audienceCountries"),
        listOf(
          others.map(
            (band) =>
              `${labels.country(band.code)} : ${labelOf(labels, "preview.share", band.shareBand)}`,
          ),
        ),
      ),
    );
  }
  const ages = p.audienceBands.filter((band) => band.dimension === "age");
  if (ages.length > 0) {
    rows.push(
      row(
        "audienceBands",
        labels.text("preview.audienceAges"),
        listOf(
          ages.map(
            (band) =>
              `${labelOf(labels, "preview.age", band.code)} : ${labelOf(labels, "preview.share", band.shareBand)}`,
          ),
        ),
      ),
    );
  }
  if (p.audienceGenderBand !== null) {
    rows.push(
      row(
        "audienceGenderBand",
        labels.text("preview.audienceGender"),
        labelOf(labels, "preview.gender", p.audienceGenderBand),
      ),
    );
  }
  return rows;
}

/** The offer: formats, rights, delay, exclusivity, non-monetary, availability, as the API serves them (RG103: no price). */
function offerRowsOf(
  p: CreatorProjectionBefore,
  labels: PreviewLabels,
): PreviewRow[] {
  const rows: PreviewRow[] = [];
  if (p.formats.length > 0) {
    rows.push(
      row(
        "formats",
        labels.text("fields.formats.label"),
        listOf(p.formats.map(labels.format)),
      ),
    );
  }
  for (const [inclusion, key] of [
    ["included", "fields.usageIncluded.label"],
    ["optional", "fields.usageOptional.label"],
  ] as const) {
    const rights = p.usageRights.filter(
      (right) => right.inclusion === inclusion,
    );
    if (rights.length > 0) {
      rows.push(
        row(
          "usageRights",
          labels.text(key),
          listOf(rights.map((right) => labels.usageRight(right.code))),
        ),
      );
    }
  }
  if (p.deliveryLead !== null) {
    rows.push(
      row(
        "deliveryLead",
        labels.text("fields.deliveryLead.label"),
        labelOf(labels, "offer.delivery", p.deliveryLead),
      ),
    );
  }
  if (p.maxExclusivity !== null) {
    rows.push(
      row(
        "maxExclusivity",
        labels.text("fields.maxExclusivity.label"),
        labels.exclusivity(p.maxExclusivity),
      ),
    );
  }
  rows.push(
    row(
      "acceptsNonMonetary",
      labels.text("fields.acceptsNonMonetary.label"),
      labels.text(p.acceptsNonMonetary ? "field.yes" : "field.no"),
    ),
  );
  if (p.availability !== null) {
    rows.push(
      row(
        "availability",
        labels.text("fields.availability.label"),
        labelOf(labels, "offer.availability", p.availability),
      ),
    );
  }
  return rows;
}

function identifiedOf(
  network: CreatorProjectionNetwork | CreatorProjectionIdentifiedNetwork,
): CreatorProjectionIdentifiedNetwork | null {
  return "followersCount" in network ? network : null;
}

/**
 * A line of network. The three priority metrics open it, always in this order (RG113): the size of the
 * community, the rhythm, the average comments; the reach and the engagement come after (the engagement
 * only when the API serves one: it is never shown unverified, RG48). In the "after" tab an exact figure
 * the API served is shown beside its band; one it did not serve is not shown, and an observed line
 * says so (EC-L2G-09-3).
 */
function networkOf(
  network: CreatorProjectionNetwork | CreatorProjectionIdentifiedNetwork,
  labels: PreviewLabels,
): PreviewNetwork {
  const fields = ["networkCode", "isPrimary", "figuresSource"];
  const identified = identifiedOf(network);
  const metrics: PreviewMetric[] = [];
  const metric = (
    field: string,
    exactField: string,
    label: string,
    band: string | null,
    exact: number | null,
  ) => {
    if (band !== null) {
      fields.push(field);
    }
    if (exact !== null) {
      fields.push(exactField);
    }
    if (band === null && exact === null) {
      return;
    }
    metrics.push({
      field,
      label,
      // an exact figure with no band stands alone; beside a band it is told as the exact one
      value: band ?? labels.count(exact ?? 0),
      exact:
        exact === null || band === null
          ? null
          : labels.text("preview.exact", { value: labels.count(exact) }),
    });
  };
  metric(
    "audienceBand",
    "followersCount",
    labels.text("networks.fields.followers.label"),
    network.audienceBand === null
      ? null
      : labelOf(labels, "reference.audience_band", network.audienceBand),
    identified?.followersCount ?? null,
  );
  metric(
    "publicationFrequency",
    "postsLast30Days",
    labels.text("preview.metrics.rhythm"),
    network.publicationFrequency === null
      ? null
      : labelOf(
          labels,
          "reference.publication_frequency",
          network.publicationFrequency,
        ),
    identified?.postsLast30Days ?? null,
  );
  metric(
    "commentBand",
    "avgCommentsPerPost",
    labels.text("networks.fields.comments.label"),
    network.commentBand === null
      ? null
      : labelOf(labels, "reference.comment_band", network.commentBand),
    identified?.avgCommentsPerPost ?? null,
  );
  metric(
    "reachBand",
    "avgReachPerPost",
    labels.text("preview.metrics.reach"),
    network.reachBand === null
      ? null
      : labelOf(labels, "reference.audience_band", network.reachBand),
    identified?.avgReachPerPost ?? null,
  );
  if (network.engagementBand !== null) {
    fields.push("engagementBand");
    metrics.push({
      field: "engagementBand",
      label: labels.text("preview.metrics.engagement"),
      value: labelOf(labels, "preview.engagementBand", network.engagementBand),
      exact: null,
    });
  }
  const source = labels.text(`preview.source.${network.figuresSource}`);
  fields.push("figuresMeasuredAt");
  const figures =
    network.figuresMeasuredAt === null
      ? labels.text("preview.figuresUndated", { source })
      : labels.text("preview.figuresAt", {
          source,
          date: labels.date(network.figuresMeasuredAt),
        });
  if (network.badges.length > 0) {
    fields.push("badges");
  }
  const identity: PreviewRow[] = [];
  if (identified !== null) {
    if (identified.handle !== null) {
      fields.push("handle");
      identity.push(
        row(
          "handle",
          labels.text("networks.fields.handle.label"),
          identified.handle,
        ),
      );
    }
    if (identified.profileUrl !== null) {
      fields.push("profileUrl");
      identity.push(
        row(
          "profileUrl",
          labels.text("networks.fields.profileUrl.label"),
          identified.profileUrl,
        ),
      );
    }
  }
  return {
    fields,
    code: network.networkCode,
    name: labels.network(network.networkCode),
    primary: network.isPrimary,
    badges: network.badges.map((badge) => ({
      level: badge.level,
      text: labels.text(`preview.badge.${badge.level}`, {
        date: labels.date(badge.since),
      }),
    })),
    metrics,
    figures,
    identity,
    observedNote:
      identified !== null &&
      identified.figuresSource === "agent_observed" &&
      identified.followersCount === null
        ? labels.text("preview.observed")
        : null,
  };
}

/** The exact shares of the main audience, the "after" tab (RG102 « pourcentages exacts »). */
function sharesOf(
  after: CreatorProjectionAfter,
  labels: PreviewLabels,
): PreviewRow[] {
  return after.audienceShares.map((share) => {
    const label =
      share.dimension === "country"
        ? labels.country(share.code)
        : labelOf(
            labels,
            share.dimension === "age" ? "preview.age" : "preview.gender",
            share.code,
          );
    return row("audienceShares", label, `${labels.count(share.share)} %`);
  });
}

/**
 * The card of one tab, from the answer of the API as it is. `before` is layer A alone; `after` is the
 * same plus layer I (handle, URL, exact figures, exact shares): the one the API called `after`.
 */
export function previewCardOf(
  preview: CreatorPreviewResponse,
  tab: PreviewTab,
  labels: PreviewLabels,
): PreviewCard {
  const projection: CreatorProjectionBefore | CreatorProjectionAfter =
    tab === "before" ? preview.before : preview.after;
  return {
    alias: projection.alias,
    headline: projection.headline,
    bio: projection.bio,
    visuals: projection.visuals
      .slice(0, PREVIEW_VISUALS_SHOWN)
      .map((visual) => ({
        id: visual.id,
        position: visual.order,
        caption: visual.caption,
      })),
    profile: profileRowsOf(projection, labels),
    networks: projection.networks.map((network) => networkOf(network, labels)),
    audience: audienceRowsOf(projection, labels),
    shares: tab === "after" ? sharesOf(preview.after, labels) : [],
    offer: offerRowsOf(projection, labels),
  };
}

/**
 * Every field of the projection the card renders, once each: the proof that the view shows what is
 * served and nothing else (the test compares it with the keys of the contract).
 */
export function renderedFieldsOf(card: PreviewCard): string[] {
  const fields = new Set<string>(["alias"]);
  if (card.networks.length > 0) {
    fields.add("networks");
  }
  if (card.headline !== null) {
    fields.add("headline");
  }
  if (card.bio !== null) {
    fields.add("bio");
  }
  if (card.visuals.length > 0) {
    fields.add("visuals");
  }
  for (const rows of [card.profile, card.audience, card.shares, card.offer]) {
    for (const { field } of rows) {
      fields.add(field);
    }
  }
  for (const network of card.networks) {
    for (const field of network.fields) {
      fields.add(field);
    }
  }
  return [...fields];
}
