// The loaders of the synthetic acceptance data set (docs/mvp/22-refonte-ux-ui/05 §4; RUA-04,
// jalons/rua/04.md): one per space, each calling the helpers the journeys already use and no other, so
// that a state of a mockup is created the way a journey creates it. No SQL here (the helpers hold it),
// no call of an API route of its own, nothing on `staging` or `production`: the local stack only. The
// data is `e2e/fixtures/recette/`; the recipe of each state is `states.ts` there, and the states no loader
// creates are in `non-recettable.ts`. The journeys that load a space clean up with `cleanRecette()`.
import type { Page } from "@playwright/test";
import { seedMember } from "./account";
import {
  removeQueueLines,
  retireInternals,
  runTag,
  seedColleague,
  seedInternal,
  seedSignup,
} from "./backoffice";
import { removeOwnCampaigns, ownBrand } from "./campaign-cleanup";
import { brandAccount, holdEntry, submittedCampaign } from "./campaign-review";
import { seedCampaignInState } from "./campaign-states";
import { seedCreatorWithoutPortfolio } from "./creator-portfolio";
import {
  PROFILE_COUNTRY,
  removeOwnSelections,
  retireSearchCreators,
  seedCreatorWithVisuals,
  seedSearchableCreators,
  type SearchableCreator,
} from "./creator-search";
import { seedReviewEntry, withdrawReviewEntries } from "./review-queue";
import { seedLines } from "./verification";
import {
  seedBadge,
  seedNetworkLine,
  seedRefusal,
  seedRevokedBadge,
  withSql,
} from "./verification-cycle";
import {
  BACKOFFICE_DATA,
  BRAND_DATA,
  CREATOR_DATA,
  type CampaignState,
  type CreatorVerificationLine,
} from "../fixtures/recette";

/** The campaigns a brand space holds, by state: the identifier and the title written. */
export type RecetteCampaigns = Partial<
  Record<CampaignState, { id: string; title: string }>
>;

export type BrandSpace = {
  accountId: string;
  brandName: string;
  /** The colleague who owns the brand and decided its campaigns. */
  ownerAgentId: string;
  campaigns: RecetteCampaigns;
  /** The creators a brand finds in its anonymous search (empty unless asked). */
  creators: SearchableCreator[];
};

/**
 * The brand space, signed in on `page`. `published` (default): a brand with a published profile named
 * after the mockups (Maison Azur), owned by a colleague; `draft`: a brand whose profile is not handed in.
 * `campaigns`: the states to write, none by default; `creators`: the creators of its search.
 */
export async function loadBrandSpace(
  page: Page,
  options: {
    profile?: "published" | "draft";
    campaigns?: readonly CampaignState[];
    creators?: boolean;
  } = {},
): Promise<BrandSpace> {
  if (options.profile === "draft") {
    const member = await seedMember(page, {
      role: "advertiser",
      language: "fr",
      acceptTerms: true,
      sessions: CREATOR_DATA.sessions,
    });
    ownBrand(member.accountId);
    return {
      accountId: member.accountId,
      brandName: "",
      ownerAgentId: "",
      campaigns: {},
      creators: [],
    };
  }
  const owner = await seedColleague("agent", BACKOFFICE_DATA.ownerFirstName);
  const brand = await brandAccount(page, {
    name: BRAND_DATA.name,
    ownerAgentId: owner.accountId,
  });
  ownBrand(brand.accountId);
  const campaigns: RecetteCampaigns = {};
  const wanted = BRAND_DATA.campaigns.filter((campaign) =>
    (options.campaigns ?? []).includes(campaign.state),
  );
  await Promise.all(
    wanted.map(async ({ state, title }) => {
      const id = await seedCampaignInState(page, {
        title,
        state,
        decider: owner.accountId,
        refusal: { reasonCode: BRAND_DATA.refusalReason },
      });
      campaigns[state] = { id, title };
    }),
  );
  const creators =
    options.creators === true
      ? await seedSearchableCreators(BRAND_DATA.searchableCreators)
      : [];
  return {
    accountId: brand.accountId,
    brandName: brand.brandName,
    ownerAgentId: owner.accountId,
    campaigns,
    creators,
  };
}

export type CreatorSpace = {
  accountId: string;
  /** The creator's networks with a verification line written (verification loader only). */
  verifiedNetworks: string[];
};

/**
 * The creator space, signed in on `page`. `bare`: an account and its storefront; `without-portfolio`: every
 * required field but the portfolio, with an active account badge; `published`: three approved visuals,
 * published and searchable; `verification` (with `bare` only): the lines and badges of
 * `CREATOR_DATA.verification` (or the lines given), as the cycle of a badge leaves them.
 */
export async function loadCreatorSpace(
  page: Page,
  options: {
    profile?: "bare" | "without-portfolio" | "published";
    language?: "fr" | "en";
    verification?: boolean | readonly CreatorVerificationLine[];
  } = {},
): Promise<CreatorSpace> {
  const profile = options.profile ?? "bare";
  const language = options.language ?? "fr";
  if (options.verification !== undefined && profile !== "bare") {
    throw new Error("loadCreatorSpace: a verification needs the bare profile");
  }
  if (profile === "published") {
    const agent = await seedColleague("agent", BACKOFFICE_DATA.agentFirstName);
    const creator = await seedCreatorWithVisuals(page, {
      spec: CREATOR_DATA.profile,
      country: PROFILE_COUNTRY,
      visuals: 3,
      agentId: agent.accountId,
      caption: BRAND_DATA.visualCaption,
    });
    return { accountId: creator.accountId, verifiedNetworks: [] };
  }
  const member = await seedMember(page, {
    role: "creator",
    language,
    acceptTerms: true,
    sessions: CREATOR_DATA.sessions,
  });
  if (profile === "without-portfolio") {
    const agent = await seedColleague("agent", BACKOFFICE_DATA.agentFirstName);
    await seedCreatorWithoutPortfolio(page, member.accountId, agent.accountId);
    return { accountId: member.accountId, verifiedNetworks: [] };
  }
  if (options.verification === undefined || options.verification === false) {
    return { accountId: member.accountId, verifiedNetworks: [] };
  }
  const lines: readonly CreatorVerificationLine[] =
    options.verification === true
      ? CREATOR_DATA.verification
      : options.verification;
  const agent = await seedColleague("agent", BACKOFFICE_DATA.agentFirstName);
  await seedLines(member.accountId, false);
  const networks = [...new Set(lines.map((line) => line.networkCode))];
  const handles: Readonly<Record<string, string | undefined>> =
    CREATOR_DATA.handles;
  await withSql(async (sql) => {
    for (const network of networks) {
      const handle = handles[network];
      if (network !== "instagram" && handle !== undefined) {
        await seedNetworkLine(sql, member.accountId, network, handle);
      }
    }
    for (const line of lines) {
      if (line.kind === "badge") {
        await seedBadge(sql, member.accountId, agent.accountId, line);
      } else if (line.kind === "refusal") {
        await seedRefusal(
          sql,
          member.accountId,
          agent.accountId,
          line.networkCode,
          line.reason,
        );
      } else {
        await seedRevokedBadge(sql, member.accountId, agent.accountId, {
          networkCode: line.networkCode,
          reason: line.reason,
          memberMessage: line.memberMessage,
        });
      }
    }
  });
  return { accountId: member.accountId, verifiedNetworks: networks };
}

export type BackofficeSpace = {
  /** The internal account signed in on this page's backoffice origin. */
  agentId: string;
  /** The colleague who owns what the queues hold (a journey reads its own entries by `?owner=`). */
  ownerAgentId: string;
  brandEntries: { accountId: string; entryId: string }[];
  campaignEntries: { campaignId: string; entryId: string; title: string }[];
  signups: string[];
};

/**
 * The backoffice space: an agent (or an administrator) signed in on `page`'s backoffice origin, and what
 * waits in the queues: brand profiles (queue 1, `overdue` past their deadline), campaigns (queue 7, one
 * held by the agent when `heldCampaign`), the signups of the list of members. The campaign queue writes a
 * brand and signs it in on this page's member origin: load it on a page of its own. An `admin` call lives in
 * `backoffice.spec.ts` alone (J8T-8): a second administrator destabilises its `onlyAdmin` degraded double control.
 */
export async function loadBackofficeSpace(
  page: Page,
  options: {
    role?: "agent" | "admin";
    brandEntries?: number;
    overdue?: boolean;
    campaigns?: number;
    heldCampaign?: boolean;
    signups?: number;
  } = {},
): Promise<BackofficeSpace> {
  const owner = await seedColleague("agent", BACKOFFICE_DATA.ownerFirstName);
  const brandEntries: BackofficeSpace["brandEntries"] = [];
  for (let index = 0; index < (options.brandEntries ?? 0); index += 1) {
    brandEntries.push(
      await seedReviewEntry({
        name: BACKOFFICE_DATA.brandProfileName,
        ownerAgentId: owner.accountId,
        dueInMinutes:
          options.overdue === true
            ? BACKOFFICE_DATA.dueInMinutes.overdue
            : BACKOFFICE_DATA.dueInMinutes.onTime,
      }),
    );
  }
  const campaignEntries: BackofficeSpace["campaignEntries"] = [];
  for (let index = 0; index < (options.campaigns ?? 0); index += 1) {
    const queued = await submittedCampaign(page, {
      title: BACKOFFICE_DATA.queuedCampaignTitle,
      ownerAgentId: owner.accountId,
    });
    ownBrand(queued.accountId);
    campaignEntries.push({
      campaignId: queued.campaignId,
      entryId: queued.entryId,
      title: queued.title,
    });
  }
  const signups: string[] = [];
  for (let index = 0; index < (options.signups ?? 0); index += 1) {
    signups.push(
      await seedSignup({
        tag: runTag(BACKOFFICE_DATA.signupTag),
        role: index % 2 === 0 ? "advertiser" : "creator",
        countryCode: BACKOFFICE_DATA.signupCountry,
        language: "fr",
        consent: true,
      }),
    );
  }
  const role = options.role ?? "agent";
  const agent = await seedInternal(
    page,
    role,
    role === "admin"
      ? BACKOFFICE_DATA.adminFirstName
      : BACKOFFICE_DATA.agentFirstName,
  );
  const held = campaignEntries[0];
  if (options.heldCampaign === true && held !== undefined) {
    await holdEntry(held.entryId, agent.accountId);
  }
  return {
    agentId: agent.accountId,
    ownerAgentId: owner.accountId,
    brandEntries,
    campaignEntries,
    signups,
  };
}

/**
 * After the journeys of a file: what the loaders wrote leaves the queues and the search, as each
 * helper's own cleanup does (campaigns, entries, lists, creators, queue lines, internal accounts).
 */
export async function cleanRecette(): Promise<void> {
  await withdrawReviewEntries();
  await removeOwnSelections();
  await removeOwnCampaigns();
  await removeQueueLines();
  await retireSearchCreators();
  await retireInternals();
}
