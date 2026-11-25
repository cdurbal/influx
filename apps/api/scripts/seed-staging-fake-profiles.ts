// `pnpm --filter @influx/api db:staging-fake-profiles -- --pool=<dir> [--dry-run] [--limit=N]`
//
// Fills STAGING with 100 fake creators and 50 fake brands, every address in @cadaero.ovh, with
// realistic storefronts, network lines, audiences, verified badges, approved portfolio visuals
// (Storage bucket `portfolio`) and brand logos (bucket `brand-logo`). Test data for the Lot 3
// search and campaigns; never meant for production.
//
// Written with the migration role, like seed-staging-demo-accounts.ts, so that NOTHING of the real
// flows runs: no sign-up e-mail, no decision e-mail, no outbox event, hence nothing sent to Brevo
// or Apollo (the script asserts that the outbox did not grow, per account, and rolls back if it
// did). The GoTrue users are created confirmed through the administration API (no message).
//
// Refused: production; a database without the staging marker; a Supabase URL that is not an https
// *.supabase.co origin; an address already used by an account this script did not create.
// Re-runnable: the same seeds draw the same people; an account this script created is skipped.
// Every account carries signup_utm_source = 'seed-fake-profiles', the handle to find them all.
//
// Inputs: apps/api/.env.local (staging values, D70) loaded by --env-file; the photo pool built by
// scripts/fake-profiles/build-photo-pool.ts (--pool=<dir>). Nothing is printed of any secret.
import { randomBytes, randomUUID } from "node:crypto";
import { parseArgs } from "node:util";
// eslint-disable-next-line no-restricted-imports -- an operator script, as script-guards.ts
import type postgres from "postgres";
import { generateBrands, type FakeBrand } from "./fake-profiles/brand-data.ts";
import {
  generateCreators,
  type FakeCreator,
} from "./fake-profiles/creator-data.ts";
import {
  choosePhotos,
  loadPhotoPool,
  renderLogo,
  renderPortfolioImage,
  type PhotoPool,
  type RenderedImage,
} from "./fake-profiles/images.ts";
import { createRng } from "./fake-profiles/random.ts";
import {
  assertStagingMarker,
  connectToStagingAsMigrationRole,
  refuseProduction,
  requiredStagingVariable,
  stagingGoTrue,
} from "./script-guards.ts";

const MARKER = "seed-fake-profiles";
const CREATOR_SEED = 20261114;
const BRAND_SEED = 20261115;
const DAY = 86_400_000;

refuseProduction("fake profiles");
const { values } = parseArgs({
  args: process.argv.slice(2).filter((argument) => argument !== "--"),
  options: {
    pool: { type: "string" },
    "dry-run": { type: "boolean", default: false },
    limit: { type: "string" },
    only: { type: "string" },
    creators: { type: "string", default: "100" },
    brands: { type: "string", default: "50" },
  },
});
const dryRun = values["dry-run"] === true;
const limit = values.limit === undefined ? Infinity : Number(values.limit);
if (values.pool === undefined) {
  throw new Error("--pool=<directory of the photo pool> is required");
}
if (
  values.only !== undefined &&
  values.only !== "creators" &&
  values.only !== "brands"
) {
  throw new Error("--only=creators|brands");
}

const gotrue = stagingGoTrue();
const supabaseUrl = new URL(requiredStagingVariable("SUPABASE_URL")).origin;
const secretKey = requiredStagingVariable("SUPABASE_SECRET_KEY");
const pool: PhotoPool = loadPhotoPool(values.pool);
const sql: postgres.Sql = connectToStagingAsMigrationRole();
type Tx = postgres.TransactionSql;

class DryRunRollback extends Error {}

// ---------------------------------------------------------------------------------------------
// GoTrue and Storage (REST, secret key of staging)
// ---------------------------------------------------------------------------------------------

const authHeaders = {
  apikey: secretKey,
  authorization: `Bearer ${secretKey}`,
  "content-type": "application/json",
};

async function createAuthUser(email: string): Promise<string> {
  // alreadySeeded() found no INFLUX account for this address: a GoTrue user holding it is the orphan
  // of an interrupted run, and goes before the new one is made
  const orphans = await sql<{ id: string }[]>`
    select u.id::text from auth.users u
     where u.email = ${email}
       and not exists (select 1 from identity.accounts a where a.auth_user_id = u.id)`;
  for (const orphan of orphans) {
    await deleteAuthUser(orphan.id);
  }
  const response = await fetch(`${gotrue.authUrl}/admin/users`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({ email, email_confirm: true }),
    signal: AbortSignal.timeout(10_000),
  });
  const body = (await response.json()) as { id?: unknown; code?: unknown };
  if (!response.ok || typeof body.id !== "string") {
    throw new Error(
      `GoTrue refused a user: ${response.status} ${String(body.code)}`,
    );
  }
  return body.id;
}

async function deleteAuthUser(id: string): Promise<void> {
  await fetch(`${gotrue.authUrl}/admin/users/${id}`, {
    method: "DELETE",
    headers: authHeaders,
    signal: AbortSignal.timeout(10_000),
  }).catch(() => undefined);
}

async function putObject(
  bucket: string,
  key: string,
  body: Buffer,
): Promise<void> {
  const response = await fetch(
    `${supabaseUrl}/storage/v1/object/${bucket}/${key}`,
    {
      method: "POST",
      headers: {
        apikey: secretKey,
        authorization: `Bearer ${secretKey}`,
        "content-type": "image/webp",
        "x-upsert": "true",
      },
      body: new Uint8Array(body),
      signal: AbortSignal.timeout(30_000),
    },
  );
  if (!response.ok) {
    throw new Error(`Storage refused ${bucket} object: ${response.status}`);
  }
}

async function removeObjects(
  bucket: string,
  keys: readonly string[],
): Promise<void> {
  if (keys.length === 0) {
    return;
  }
  await fetch(`${supabaseUrl}/storage/v1/object/${bucket}`, {
    method: "DELETE",
    headers: authHeaders,
    body: JSON.stringify({ prefixes: keys }),
    signal: AbortSignal.timeout(30_000),
  }).catch(() => undefined);
}

// ---------------------------------------------------------------------------------------------
// Shared database steps
// ---------------------------------------------------------------------------------------------

type Context = {
  adminId: string;
  terms: Map<string, { id: string; hash: Buffer; locale: string }>;
};

async function loadContext(): Promise<Context> {
  const [admin] = await sql<{ id: string }[]>`
    select a.id::text from identity.accounts a
      join identity.account_roles r on r.account_id = a.id
     where r.role = 'admin' and a.status = 'active' order by a.created_at limit 1`;
  if (admin === undefined) {
    throw new Error(
      "no active admin on staging: create the first admin first (seed-staging-demo-accounts)",
    );
  }
  const terms = new Map<string, { id: string; hash: Buffer; locale: string }>();
  for (const language of ["fr", "en"]) {
    const [row] = await sql<
      { id: string; content_hash: Buffer; locale: string }[]
    >`
      select id::text, content_hash, locale::text from identity.terms_versions
       where document_kind = 'terms_of_service' and locale in (${language}, 'en')
         and effective_to is null and effective_from <= now() and content is not null
       order by (locale = ${language}) desc limit 1`;
    if (row === undefined) {
      throw new Error(
        "no terms of service in force on staging (db:publish-terms:staging)",
      );
    }
    terms.set(language, {
      id: row.id,
      hash: row.content_hash,
      locale: row.locale,
    });
  }
  return { adminId: admin.id, terms };
}

/** Skip (true) an account this script made; refuse an address somebody else holds. */
async function alreadySeeded(email: string): Promise<boolean> {
  const [row] = await sql<{ marker: string | null }[]>`
    select signup_utm_source as marker from identity.accounts where email = ${email}`;
  if (row === undefined) {
    return false;
  }
  if (row.marker !== MARKER) {
    throw new Error(
      "an address of the seed belongs to a real account: refused, change the seed",
    );
  }
  return true;
}

async function outboxCount(tx: Tx): Promise<number> {
  const [row] = await tx<
    { n: number }[]
  >`select count(*)::int as n from leads.outbox_events`;
  return row?.n ?? 0;
}

async function insertAccount(
  tx: Tx,
  context: Context,
  input: {
    id: string;
    authUserId: string;
    email: string;
    country: string;
    language: "fr" | "en";
    timezone: string;
    displayName: string;
    status: "individual" | "business";
    role: "creator" | "advertiser";
    heardFrom: string;
    createdAt: Date;
  },
): Promise<void> {
  await tx`
    insert into identity.accounts
      (id, auth_user_id, email, email_verified_at, country_code, preferred_language, timezone,
       display_name, is_adult_attested, adult_attested_at, declared_status, signup_utm_source,
       signup_heard_from, created_at, updated_at)
    values (${input.id}, ${input.authUserId}, ${input.email}, ${input.createdAt}, ${input.country},
            ${input.language}, ${input.timezone}, ${input.displayName}, true, ${input.createdAt},
            ${input.status}::identity.declared_status, ${MARKER},
            ${input.heardFrom}::identity.heard_from, ${input.createdAt}, ${input.createdAt})`;
  await tx`insert into identity.account_roles (account_id, role)
           values (${input.id}, ${input.role}::identity.account_role)`;
  const terms = context.terms.get(input.language);
  if (terms === undefined) {
    throw new Error("no terms for the language");
  }
  await tx`
    insert into identity.terms_acceptances
      (account_id, terms_version_id, content_hash, accepted_at, channel, locale)
    values (${input.id}, ${terms.id}, ${terms.hash}, ${input.createdAt}, 'signup', ${terms.locale})`;
}

const ALPHABET = "23456789BCDFGHJKLMNPQRSTVWXZ";
function newAlias(): string {
  const bytes = randomBytes(6);
  return Array.from(bytes, (byte) => ALPHABET[byte % ALPHABET.length]).join("");
}

// ---------------------------------------------------------------------------------------------
// One creator
// ---------------------------------------------------------------------------------------------

async function seedCreator(
  creator: FakeCreator,
  context: Context,
): Promise<"created" | "skipped"> {
  if (await alreadySeeded(creator.email)) {
    return "skipped";
  }
  const rng = createRng(CREATOR_SEED + creator.index * 7919);
  const accountId = randomUUID();
  const publishedAt = new Date(
    Date.now() - creator.publishedDaysAgo * DAY - Math.floor(rng() * DAY),
  );
  const createdAt = new Date(publishedAt.getTime() - 5 * DAY);

  // images first: a bad photo fails here, before any account exists
  const files = choosePhotos(pool, creator.portfolioTopics, rng);
  const visuals: {
    id: string;
    image: RenderedImage;
    caption: string | null;
  }[] = [];
  for (const [position, file] of files.entries()) {
    visuals.push({
      id: randomUUID(),
      image: await renderPortfolioImage(file, rng),
      caption: creator.captions[position] ?? null,
    });
  }
  const objectKeys = visuals.map((visual) => `${accountId}/${visual.id}.webp`);

  const authUserId = await createAuthUser(creator.email);
  let uploaded = false;
  try {
    if (!dryRun) {
      for (const [position, visual] of visuals.entries()) {
        await putObject(
          "portfolio",
          objectKeys[position] as string,
          visual.image.buffer,
        );
      }
      uploaded = true;
    }
    await sql.begin(async (tx) => {
      const outboxBefore = await outboxCount(tx);
      await insertAccount(tx, context, {
        id: accountId,
        authUserId,
        email: creator.email,
        country: creator.country,
        language: creator.language,
        timezone: creator.timezone,
        displayName: creator.firstName,
        status: "individual",
        role: "creator",
        heardFrom: creator.heardFrom,
        createdAt,
      });
      await tx`
        insert into profiles.creator_public_profiles
          (account_id, alias, status, is_searchable, published_at, headline, bio,
           primary_topic_code, residence_country_code, residence_region_code, travel_scope,
           collaboration_experience_band, delivery_lead_band, max_exclusivity_band,
           accepts_non_monetary, availability_band, created_at)
        values (${accountId}, ${newAlias()}, 'published', true, ${publishedAt}, ${creator.headline},
                ${creator.bio}, ${creator.primaryTopic}, ${creator.country}, ${creator.region},
                ${creator.travelScope}, ${creator.collaborationExperienceBand},
                ${creator.deliveryLeadBand}, ${creator.maxExclusivityBand},
                ${creator.acceptsNonMonetary}, ${creator.availabilityBand}, ${createdAt})`;
      // the identifying object (layer N), created empty by the storefront trigger
      await tx`
        update profiles.creator_identities
           set legal_first_name = ${creator.firstName}, legal_last_name = ${creator.lastName},
               contact_email = ${creator.email}, contact_phone = ${creator.phone},
               address_line = ${creator.addressLine}, postal_code = ${creator.postalCode},
               city = ${creator.city}, country_code = ${creator.country}
         where account_id = ${accountId}`;

      for (const [offset, code] of creator.secondaryTopics.entries()) {
        await tx`insert into profiles.creator_topics (account_id, slot, topic_code)
                 values (${accountId}, ${offset + 1}, ${code})`;
      }
      for (const [offset, code] of creator.publicationLanguages.entries()) {
        await tx`insert into profiles.creator_publication_languages (account_id, slot, language_code)
                 values (${accountId}, ${offset + 1}, ${code})`;
      }
      for (const [offset, code] of creator.tones.entries()) {
        await tx`insert into profiles.creator_tones (account_id, slot, tone_code)
                 values (${accountId}, ${offset + 1}, ${code})`;
      }
      for (const code of creator.formats) {
        await tx`insert into profiles.creator_formats (account_id, format_code)
                 values (${accountId}, ${code})`;
      }
      for (const right of creator.usageRights) {
        await tx`insert into profiles.creator_usage_rights (account_id, usage_right_code, inclusion)
                 values (${accountId}, ${right.code}, ${right.inclusion})`;
      }
      for (const code of creator.refusedSectors) {
        await tx`insert into profiles.creator_refused_sectors (account_id, sector_code)
                 values (${accountId}, ${code})`;
      }

      const measuredAt = new Date(publishedAt.getTime() - 2 * DAY);
      const lineIds: {
        id: string;
        network: string;
        isPrimary: boolean;
        handle: string;
      }[] = [];
      for (const line of creator.lines) {
        const [row] = await tx<{ id: string }[]>`
          insert into profiles.creator_social_accounts
            (account_id, network_code, is_primary, handle, pseudonym, profile_url, followers_count,
             posts_last_30_days, avg_comments_per_post, avg_reach_per_post, engagement_rate_bp,
             figures_source, figures_measured_at, created_at)
          values (${accountId}, ${line.network}, ${line.isPrimary}, ${line.handle}, ${line.pseudonym},
                  ${line.profileUrl}, ${line.followers}, ${line.postsLast30Days},
                  ${line.avgComments}, ${line.avgReach}, ${line.engagementBp}, 'declared',
                  ${measuredAt}, ${createdAt})
          returning id::text`;
        const lineId = row?.id as string;
        lineIds.push({
          id: lineId,
          network: line.network,
          isPrimary: line.isPrimary,
          handle: line.handle,
        });
        for (const country of line.countries) {
          await tx`insert into profiles.creator_audience_countries
                     (social_account_id, account_id, slot, country_code, share_percent)
                   values (${lineId}, ${accountId}, ${country.slot}, ${country.code}, ${country.share})`;
        }
        for (const age of line.ages) {
          await tx`insert into profiles.creator_audience_ages
                     (social_account_id, account_id, age_band_code, share_percent)
                   values (${lineId}, ${accountId}, ${age.code}, ${age.share})`;
        }
        for (const gender of line.genders) {
          await tx`insert into profiles.creator_audience_genders
                     (social_account_id, account_id, gender_code, share_percent)
                   values (${lineId}, ${accountId}, ${gender.code}, ${gender.share})`;
        }
      }
      // layer A: the lines of a published profile are listed
      await tx`update profiles.creator_public_networks set listed_at = ${publishedAt}
                where account_id = ${accountId}`;

      // « Compte vérifié » on the main line (required to publish, D79 (6)) and on half of the others
      for (const line of lineIds) {
        if (!line.isPrimary && rng() < 0.5) {
          continue;
        }
        const requestId = randomUUID();
        // prepare_request() stamps submitted_at and the deadlines itself: the decision is dated now()
        await tx`
          insert into verification.verification_requests
            (id, account_id, social_account_id, network_code, level, status, created_at)
          values (${requestId}, ${accountId}, ${line.id}, ${line.network}, 'account_verified',
                  'draft', ${new Date(publishedAt.getTime() - 3 * DAY)})`;
        await tx`
          update verification.verification_requests set status = 'pending' where id = ${requestId}`;
        await tx`
          update verification.verification_requests
             set status = 'approved', decided_by_account_id = ${context.adminId},
                 decided_at = now(), closed_at = now()
           where id = ${requestId}`;
        await tx`
          insert into verification.badges
            (account_id, social_account_id, network_code, request_id, level, granted_by_account_id,
             granted_at, evidence_source, observed_handle_at_decision, state)
          values (${accountId}, ${line.id}, ${line.network}, ${requestId}, 'account_verified',
                  ${context.adminId}, now(), 'public_profile', ${line.handle}, 'active')`;
      }

      // approved visuals, in the places 1..n of the card
      for (const [offset, visual] of visuals.entries()) {
        const storedAt = new Date(
          publishedAt.getTime() - 2 * DAY + offset * 60_000,
        );
        await tx`
          insert into profiles.portfolio_items
            (id, account_id, state, display_order, received_bytes, byte_size, width, height,
             checksum, exif_stripped, caption, stored_at, sla_due_at, escalate_at,
             decided_by_account_id, decided_at, created_at)
          values (${visual.id}, ${accountId}, 'approved', ${offset + 1}, ${visual.image.byteSize},
                  ${visual.image.byteSize}, ${visual.image.width}, ${visual.image.height},
                  ${visual.image.checksum}, true, ${visual.caption}, ${storedAt},
                  ${new Date(storedAt.getTime() + DAY)}, ${new Date(storedAt.getTime() + 2 * DAY)},
                  ${context.adminId}, ${new Date(storedAt.getTime() + 4 * 3_600_000)},
                  ${new Date(storedAt.getTime() - 300_000)})`;
      }

      // the examination that published it (queue 2)
      await tx`
        insert into profiles.creator_review_entries
          (account_id, kind, state, sla_due_at, decided_by_account_id, decided_at, closed_at,
           internal_comment)
        values (${accountId}, 'submission', 'published', now(), ${context.adminId}, now(), now(),
                'Seeded test profile: published without examination.')`;

      if ((await outboxCount(tx)) !== outboxBefore) {
        throw new Error(
          "the outbox grew: nothing may be queued for a seeded account (rolled back)",
        );
      }
      if (dryRun) {
        await reportCreator(tx, accountId);
        throw new DryRunRollback();
      }
    });
  } catch (error) {
    await deleteAuthUser(authUserId);
    if (uploaded) {
      await removeObjects("portfolio", objectKeys);
    }
    if (error instanceof DryRunRollback) {
      return "created";
    }
    throw error;
  }
  if (dryRun) {
    await deleteAuthUser(authUserId);
  }
  return "created";
}

let reported = false;
async function reportCreator(tx: Tx, accountId: string): Promise<void> {
  if (reported) {
    return;
  }
  reported = true;
  const [counts] = await tx<Record<string, number>[]>`
    select
      (select count(*) from profiles.creator_social_accounts where account_id = ${accountId})::int lines,
      (select count(*) from profiles.creator_public_networks where account_id = ${accountId})::int public_networks,
      (select count(*) from profiles.creator_public_audience where account_id = ${accountId})::int public_audience,
      (select count(*) from profiles.portfolio_items where account_id = ${accountId})::int visuals,
      (select count(*) from verification.badges where account_id = ${accountId})::int badges,
      (select count(*) from profiles.creator_network_metrics_history where account_id = ${accountId})::int history`;
  const [profile] = await tx<Record<string, unknown>[]>`
    select main_audience_country, main_audience_share_band, audience_gender_band, status::text
      from profiles.creator_public_profiles where account_id = ${accountId}`;
  process.stdout.write(
    `  dry-run creator rows: ${JSON.stringify(counts)} ${JSON.stringify(profile)}\n`,
  );
}

// ---------------------------------------------------------------------------------------------
// One brand
// ---------------------------------------------------------------------------------------------

async function seedBrand(
  brand: FakeBrand,
  context: Context,
): Promise<"created" | "skipped"> {
  if (await alreadySeeded(brand.email)) {
    return "skipped";
  }
  const rng = createRng(BRAND_SEED + brand.index * 6151);
  const accountId = randomUUID();
  const publishedAt = new Date(
    Date.now() - brand.publishedDaysAgo * DAY - Math.floor(rng() * DAY),
  );
  const createdAt = new Date(publishedAt.getTime() - 4 * DAY);
  const logo = await renderLogo(brand.logoSeed, rng);
  const logoId = randomUUID();
  const logoKey = `${accountId}/${logoId}.webp`;

  const authUserId = await createAuthUser(brand.email);
  let uploaded = false;
  try {
    if (!dryRun) {
      await putObject("brand-logo", logoKey, logo.buffer);
      uploaded = true;
    }
    await sql.begin(async (tx) => {
      const outboxBefore = await outboxCount(tx);
      await insertAccount(tx, context, {
        id: accountId,
        authUserId,
        email: brand.email,
        country: brand.country,
        language: brand.language,
        timezone: brand.timezone,
        displayName: brand.legalName,
        status: "business",
        role: "advertiser",
        heardFrom: brand.heardFrom,
        createdAt,
      });
      await tx`
        insert into profiles.advertiser_profiles
          (account_id, legal_name, status, primary_sector_code, company_size_band, website_domain,
           presentation, exclusivity_band, collaboration_rhythm, offers_non_monetary, contact_role,
           completeness_percent, submitted_at, first_published_at, created_at)
        values (${accountId}, ${brand.legalName}, 'published', ${brand.primarySector},
                ${brand.companySizeBand}, ${brand.websiteDomain}, ${brand.presentation},
                ${brand.exclusivityBand}, ${brand.collaborationRhythm}, ${brand.offersNonMonetary},
                ${brand.contactRole}, 100, ${new Date(publishedAt.getTime() - DAY)}, ${publishedAt},
                ${createdAt})`;
      await tx`
        insert into profiles.advertiser_contact_details
          (account_id, contact_first_name, contact_email, contact_phone, contact_url)
        values (${accountId}, ${brand.contactFirstName}, ${brand.email}, ${brand.contactPhone},
                ${brand.contactUrl})`;
      for (const [offset, code] of brand.secondarySectors.entries()) {
        await tx`insert into profiles.advertiser_secondary_sectors (account_id, slot, sector_code)
                 values (${accountId}, ${offset + 1}, ${code})`;
      }
      for (const [offset, code] of brand.targetMarkets.entries()) {
        await tx`insert into profiles.advertiser_target_markets (account_id, slot, country_code)
                 values (${accountId}, ${offset + 1}, ${code})`;
      }
      for (const code of brand.workingLanguages) {
        await tx`insert into profiles.advertiser_working_languages (account_id, language_code)
                 values (${accountId}, ${code})`;
      }
      for (const [offset, code] of brand.topics.entries()) {
        await tx`insert into profiles.advertiser_topics (account_id, slot, topic_code)
                 values (${accountId}, ${offset + 1}, ${code})`;
      }
      for (const code of brand.networks) {
        await tx`insert into profiles.advertiser_networks (account_id, network_code)
                 values (${accountId}, ${code})`;
      }
      for (const code of brand.formats) {
        await tx`insert into profiles.advertiser_formats (account_id, format_code)
                 values (${accountId}, ${code})`;
      }
      for (const [offset, code] of brand.audienceCountries.entries()) {
        await tx`insert into profiles.advertiser_audience_countries (account_id, slot, country_code)
                 values (${accountId}, ${offset + 1}, ${code})`;
      }
      for (const code of brand.usageRights) {
        await tx`insert into profiles.advertiser_usage_rights (account_id, usage_right_code)
                 values (${accountId}, ${code})`;
      }
      await tx`
        insert into profiles.brand_logo_objects
          (id, account_id, state, received_bytes, byte_size, width, height, created_at, activated_at)
        values (${logoId}, ${accountId}, 'active', ${logo.byteSize}, ${logo.byteSize}, ${logo.width},
                ${logo.height}, ${new Date(publishedAt.getTime() - DAY)}, ${publishedAt})`;
      await tx`
        insert into profiles.advertiser_review_entries
          (account_id, kind, state, sla_due_at, decided_by_account_id, decided_at, closed_at,
           internal_comment)
        values (${accountId}, 'submission', 'published', now(), ${context.adminId}, now(), now(),
                'Seeded test profile: published without examination.')`;
      if ((await outboxCount(tx)) !== outboxBefore) {
        throw new Error(
          "the outbox grew: nothing may be queued for a seeded account (rolled back)",
        );
      }
      if (dryRun) {
        throw new DryRunRollback();
      }
    });
  } catch (error) {
    await deleteAuthUser(authUserId);
    if (uploaded) {
      await removeObjects("brand-logo", [logoKey]);
    }
    if (error instanceof DryRunRollback) {
      return "created";
    }
    throw error;
  }
  if (dryRun) {
    await deleteAuthUser(authUserId);
  }
  return "created";
}

// ---------------------------------------------------------------------------------------------

try {
  await assertStagingMarker(sql);
  const context = await loadContext();
  const tally = { created: 0, skipped: 0 };
  const run = async <T>(
    kind: string,
    items: readonly T[],
    seed: (item: T) => Promise<"created" | "skipped">,
  ) => {
    let done = 0;
    for (const item of items) {
      if (done >= limit) {
        break;
      }
      tally[await seed(item)] += 1;
      done += 1;
      if (done % 10 === 0) {
        process.stdout.write(
          `${kind}: ${done}/${Math.min(items.length, limit)}\n`,
        );
      }
    }
  };
  if (values.only !== "brands") {
    await run(
      "creators",
      generateCreators(Number(values.creators), CREATOR_SEED),
      (c) => seedCreator(c, context),
    );
  }
  if (values.only !== "creators") {
    await run(
      "brands",
      generateBrands(Number(values.brands), BRAND_SEED),
      (b) => seedBrand(b, context),
    );
  }
  process.stdout.write(
    `${dryRun ? "DRY RUN (everything rolled back, nothing stored): " : ""}accounts created ${tally.created}, skipped ${tally.skipped}\n`,
  );
} finally {
  await sql.end({ timeout: 1 });
}
