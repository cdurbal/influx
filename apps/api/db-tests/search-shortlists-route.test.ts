// L3F commit 08 — L3F-T8: the brand's private shortlists, /v1/me/shortlists (docs/mvp/10 RG1, RG4, RG8,
// RG48, RG50, RG51, RG63, RG65; CA6, CA49, CA52, CA59, CA64; 18 T14, TM12.3; D38, D45; jalons/l3f/
// modele.md §5, §8; fiche invariants 1, 2, 6, 7, 10, 15). Through fastify.inject(), straight to apps/api,
// the doors of 0324 behind it:
//   - the contracts are strict: the exact keys of a list and of an item, no account identifier, no key
//     of RG48 at any depth, not even null, no marker of layer I by value; a card is the search's, whole;
//   - T14.1 to T14.4: another brand's list, a list unknown, a campaign not admitted, an alias unknown,
//     excluded, never served or malformed answer byte for byte as an address that does not exist; a
//     creator or no session is refused before any door;
//   - the bounds of the base (listsPerAccount, itemsPerList) answer 409, the name and the note 400;
//   - the switch closed (D38) and a brand not published (RG1) answer a state alone, nothing written;
//   - nothing goes to the outbox (Brevo, Apollo), matching nor messaging (D45, CA52, CA64); no route of
//     export, no « add them all », no size of page (TM12.3).
//   - L3G-T3 (L3FS-3): each of the six writes is bound per client address, before the session, 429 beyond.
// Accounts COMMITTED through campaign-routes-kit.ts, creators through creator-search-kit.ts.
import {
  shortlistCreateBodySchema,
  shortlistNoteBodySchema,
  shortlistUpdateBodySchema,
} from "@influx/contracts/shortlists";
import type { LightMyRequestResponse } from "fastify";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SHORTLIST_WRITE_ADDRESS_RATE } from "../src/platform/member-rate.ts";
import { routeInventoryOf } from "../src/server.ts";
import {
  openCampaignRouteFixtures,
  type CampaignRouteFixtures,
  type Member,
  type Server,
} from "./campaign-routes-kit.ts";
import {
  closeSearch,
  expectLockTimeoutRefusal,
  forgetSelections,
  HERE,
  keysOf,
  markersIn,
  openSearch,
  postSearch,
  RG48_KEYS,
  searchableCreator,
  searchableCreators,
  sendAsMember,
  sideEffectsOf,
  unusedAlias,
  URL_SHORTLISTS,
  withSearchSetting,
  type SearchCreator,
} from "./creator-search-kit.ts";
import {
  brandCampaign,
  memoryStore,
  publishedBrand,
  type FixtureCampaign,
  type Marker,
  type PublishedBrand,
} from "./open-campaigns-kit.ts";

let fx: CampaignRouteFixtures;
let server: Server;
let owner: PublishedBrand;
/** Six creators of the file, all served to `owner`'s searches. */
let creators: SearchCreator[];
/** A campaign of `owner` in an admitted state (paused), one of another brand, and a draft of `owner`. */
let campaign: FixtureCampaign;
let draftCampaign: FixtureCampaign;
let strangersCampaign: FixtureCampaign;
let stranger: PublishedBrand;
/** Every brand and creator the file makes, whose lists leave the stack when it ends. */
const brands: Member[] = [];
/** The answer of an address that does not exist (T14.4). */
let unknownAddress: { status: number; code: string; message: string };

type Summary = {
  id: string;
  name: string;
  campaignId: string | null;
  count: number;
  createdAt: string;
};
type Read = {
  state: string;
  shortlist: Summary;
  items: {
    creator: Record<string, unknown> & { alias: string };
    note: string | null;
    addedAt: string;
  }[];
};

const SUMMARY_KEYS = ["campaignId", "count", "createdAt", "id", "name"];

function withoutRequestId(response: LightMyRequestResponse): string {
  return response.body.replace(/"requestId":"[^"]*"/, "");
}

function allMarkers(): Marker[] {
  return [
    ...creators.flatMap((creator) => creator.markers),
    ...owner.markers,
    ...campaign.markers,
  ];
}

/** A brand with a published profile whose lists leave the stack with the file. */
async function newBrand(): Promise<PublishedBrand> {
  const brand = await publishedBrand(fx, server);
  brands.push(brand);
  return brand;
}

/** The six creators served to `brand`: the « already served » of an addition (modele -5). */
async function serve(brand: Member): Promise<void> {
  const response = await postSearch(server, brand, { filters: HERE });
  expect(response.statusCode, response.body).toBe(200);
  expect(response.json()).toMatchObject({ state: "results" });
}

/** A client address of its own for each call: the reads are bound to 60 a minute per address. */
let calls = 0;
function freshAddress(): string {
  calls += 1;
  return `10.88.${Math.floor(calls / 250)}.${(calls % 250) + 1}`;
}

const send = (
  member: Member | null,
  method: "GET" | "POST" | "PUT" | "DELETE",
  url: string,
  body?: unknown,
) => sendAsMember(server, member, method, url, body, freshAddress());

const itemUrl = (id: string, alias: string) =>
  `${URL_SHORTLISTS}/${id}/items/${alias}`;

/** POST /v1/me/shortlists, the summary of the list created. */
async function createList(
  member: Member,
  name = "A list",
  campaignId: string | null = null,
): Promise<Summary> {
  const response = await send(member, "POST", URL_SHORTLISTS, {
    name,
    campaignId,
  });
  expect(response.statusCode, response.body).toBe(200);
  const body = response.json() as { state: string; shortlist: Summary };
  expect(body.state).toBe("shortlist");
  return body.shortlist;
}

async function readList(member: Member, id: string): Promise<Read> {
  const response = await send(member, "GET", `${URL_SHORTLISTS}/${id}`);
  expect(response.statusCode, response.body).toBe(200);
  return response.json() as Read;
}

async function rowsOf(member: Member): Promise<{ n: number; items: number }> {
  const [row] = await fx.migration<{ n: number; items: number }[]>`
    select (select count(*)::int from search.shortlists s
             where s.advertiser_account_id = ${member.accountId}) as n,
           (select count(*)::int from search.shortlist_items i
              join search.shortlists s on s.id = i.shortlist_id
             where s.advertiser_account_id = ${member.accountId}) as items`;
  return row ?? { n: -1, items: -1 };
}

beforeAll(async () => {
  fx = await openCampaignRouteFixtures();
  const store = memoryStore();
  server = fx.server({ storage: store });
  await openSearch(fx);
  owner = await newBrand();
  stranger = await newBrand();
  creators = await searchableCreators(fx, 6);
  campaign = await brandCampaign(fx, server, owner, { state: "paused" });
  draftCampaign = await brandCampaign(fx, server, owner, { state: "draft" });
  strangersCampaign = await brandCampaign(fx, server, stranger, {
    state: "paused",
  });
  await serve(owner);
  unknownAddress = fx.errorBody(
    await fx.call(server, "GET", "/v1/me/shortlists-nothing", owner.session),
  );
  expect(unknownAddress).toEqual({
    status: 404,
    code: "not_found",
    message: "Not found",
  });
});

afterAll(async () => {
  await forgetSelections(fx, brands);
  await closeSearch(fx);
  await fx.close();
});

describe("L3F-T8 the contracts are strict (10 RG48, RG50, RG51, RG65; CA6; fiche invariants 1, 2)", () => {
  it("creates, lists, renames and deletes a list: the exact keys of a summary, its name trimmed, no account identifier, no-store", async () => {
    const brand = await newBrand();
    const created = await send(brand, "POST", URL_SHORTLISTS, {
      name: "  Summer pets  ",
    });
    expect(created.statusCode, created.body).toBe(200);
    const { state, shortlist } = created.json() as {
      state: string;
      shortlist: Summary;
    };
    expect(state).toBe("shortlist");
    expect(Object.keys(shortlist).sort()).toEqual(SUMMARY_KEYS);
    expect(shortlist).toMatchObject({
      name: "Summer pets",
      campaignId: null,
      count: 0,
    });
    expect(shortlist.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(shortlist.createdAt).toMatch(/^\d{4}-\d\d-\d\dT[\d:.]+Z$/);

    const listed = await send(brand, "GET", URL_SHORTLISTS);
    expect(listed.json()).toEqual({
      state: "shortlists",
      shortlists: [shortlist],
    });

    const renamed = await send(
      brand,
      "PUT",
      `${URL_SHORTLISTS}/${shortlist.id}`,
      {
        name: "Winter",
        campaignId: null,
      },
    );
    expect(renamed.json()).toEqual({
      state: "shortlist",
      shortlist: { ...shortlist, name: "Winter" },
    });

    const deleted = await send(
      brand,
      "DELETE",
      `${URL_SHORTLISTS}/${shortlist.id}`,
    );
    expect(deleted.json()).toEqual({ state: "deleted" });
    expect((await send(brand, "GET", URL_SHORTLISTS)).json()).toEqual({
      state: "shortlists",
      shortlists: [],
    });
    // a second deletion: the list is gone, an address that does not exist
    expect(
      fx.errorBody(
        await send(brand, "DELETE", `${URL_SHORTLISTS}/${shortlist.id}`),
      ),
    ).toEqual(unknownAddress);

    for (const response of [created, listed, renamed, deleted]) {
      expect(response.headers["cache-control"]).toBe("no-store");
      expect(
        RG48_KEYS.filter((key) => new Set(keysOf(response.json())).has(key)),
      ).toEqual([]);
      expect(markersIn(response, brand.markers)).toEqual([]);
    }
  });

  it("CA6: a list read holds the cards the search serves, whole and equal, newest first with their notes; no key of RG48, no marker of layer I", async () => {
    const brand = await newBrand();
    await serve(brand);
    const list = await createList(brand, "Pets");
    const [first, second, third] = creators as [
      SearchCreator,
      SearchCreator,
      SearchCreator,
    ];
    for (const creator of [first, second, third]) {
      const added = await send(brand, "PUT", itemUrl(list.id, creator.alias));
      expect(added.json()).toEqual({ state: "added" });
    }
    const noted = await send(
      brand,
      "PUT",
      `${itemUrl(list.id, second.alias)}/note`,
      { note: "  Call about the reel  " },
    );
    expect(noted.json()).toEqual({ state: "noted" });

    const response = await send(brand, "GET", `${URL_SHORTLISTS}/${list.id}`);
    expect(response.statusCode, response.body).toBe(200);
    const read = response.json() as Read;
    expect(Object.keys(read).sort()).toEqual(["items", "shortlist", "state"]);
    expect(read.shortlist).toMatchObject({ id: list.id, count: 3 });
    expect(read.items.map((item) => item.creator.alias)).toEqual([
      third.alias,
      second.alias,
      first.alias,
    ]);
    for (const item of read.items) {
      expect(Object.keys(item).sort()).toEqual(["addedAt", "creator", "note"]);
    }
    expect(read.items.map((item) => item.note)).toEqual([
      null,
      "Call about the reel",
      null,
    ]);
    const page = (
      await postSearch(server, brand, { filters: HERE })
    ).json() as {
      cards: { creator: { alias: string } }[];
    };
    for (const item of read.items) {
      const card = page.cards.find(
        (candidate) => candidate.creator.alias === item.creator.alias,
      );
      expect(card).toBeDefined();
      expect(item.creator).toEqual(card?.creator);
    }
    expect(RG48_KEYS.filter((key) => new Set(keysOf(read)).has(key))).toEqual(
      [],
    );
    expect(markersIn(response, allMarkers())).toEqual([]);
    expect(response.headers["cache-control"]).toBe("no-store");
  });

  it("a creator the engine hides leaves the read and the count with no trace, and comes back when visible again", async () => {
    const brand = await newBrand();
    await serve(brand);
    const list = await createList(brand, "Hidden");
    const [first, second] = creators as [SearchCreator, SearchCreator];
    await send(brand, "PUT", itemUrl(list.id, first.alias));
    await send(brand, "PUT", itemUrl(list.id, second.alias));
    expect((await readList(brand, list.id)).shortlist.count).toBe(2);

    await fx.migration`
      update profiles.creator_public_profiles set is_searchable = false
       where account_id = ${second.accountId}`;
    try {
      const response = await send(brand, "GET", `${URL_SHORTLISTS}/${list.id}`);
      const read = response.json() as Read;
      expect(read.shortlist.count).toBe(1);
      expect(read.items.map((item) => item.creator.alias)).toEqual([
        first.alias,
      ]);
      expect(response.body).not.toContain(second.alias);
      expect(markersIn(response, second.markers)).toEqual([]);
      const listed = (await send(brand, "GET", URL_SHORTLISTS)).json() as {
        shortlists: Summary[];
      };
      expect(listed.shortlists[0]?.count).toBe(1);
    } finally {
      await fx.migration`
        update profiles.creator_public_profiles set is_searchable = true
         where account_id = ${second.accountId}`;
    }
    expect((await readList(brand, list.id)).shortlist.count).toBe(2);
  });
});

describe("L3F-T8 CA49, T14.4 an alias unknown, excluded, never served or malformed (10 RG4, RG65; fiche invariant 2)", () => {
  it("an addition by an alias unknown, excluded by the engine, never served to the brand or malformed answers byte for byte as an unknown address, nothing added", async () => {
    const brand = await newBrand();
    await serve(brand);
    const list = await createList(brand, "Strict");
    const [subject, excluded] = creators as [SearchCreator, SearchCreator];
    // served, then taken out of the search (E2): the engine excludes it
    await fx.migration`
      update profiles.creator_public_profiles set is_searchable = false
       where account_id = ${excluded.accountId}`;
    // searchable, but created after the brand's search: never served to it
    const latecomer = await searchableCreator(fx);
    try {
      const unknown = await send(
        brand,
        "PUT",
        itemUrl(list.id, await unusedAlias(fx)),
      );
      const answers = [
        unknown,
        await send(brand, "PUT", itemUrl(list.id, excluded.alias)),
        await send(brand, "PUT", itemUrl(list.id, latecomer.alias)),
        await send(brand, "PUT", itemUrl(list.id, "not-an-alias")),
        await send(brand, "PUT", itemUrl(list.id, subject.alias.toLowerCase())),
      ];
      for (const response of answers) {
        expect(fx.errorBody(response)).toEqual(unknownAddress);
        expect(withoutRequestId(response)).toBe(withoutRequestId(unknown));
        expect(
          markersIn(response, [...excluded.markers, ...latecomer.markers]),
        ).toEqual([]);
      }
      expect((await readList(brand, list.id)).items).toEqual([]);
      expect(await rowsOf(brand)).toEqual({ n: 1, items: 0 });
      // positive control: a creator served and visible is added
      expect(
        (await send(brand, "PUT", itemUrl(list.id, subject.alias))).json(),
      ).toEqual({ state: "added" });
    } finally {
      await fx.migration`
        update profiles.creator_public_profiles set is_searchable = true
         where account_id = ${excluded.accountId}`;
      await fx.migration`
        update profiles.creator_public_profiles set is_searchable = false
         where account_id = ${latecomer.accountId}`;
    }
  });

  it("a note on a creator absent from the list answers as an unknown address; a removal is idempotent, the same answer in every case", async () => {
    const brand = await newBrand();
    await serve(brand);
    const list = await createList(brand, "Idempotent");
    const [inList, notInList] = creators as [SearchCreator, SearchCreator];
    await send(brand, "PUT", itemUrl(list.id, inList.alias));

    const note = await send(
      brand,
      "PUT",
      `${itemUrl(list.id, notInList.alias)}/note`,
      {
        note: "Not there",
      },
    );
    expect(fx.errorBody(note)).toEqual(unknownAddress);

    const removals = [
      await send(brand, "DELETE", itemUrl(list.id, inList.alias)),
      await send(brand, "DELETE", itemUrl(list.id, inList.alias)),
      await send(brand, "DELETE", itemUrl(list.id, notInList.alias)),
      await send(brand, "DELETE", itemUrl(list.id, await unusedAlias(fx))),
      await send(brand, "DELETE", itemUrl(list.id, "not-an-alias")),
    ];
    for (const response of removals) {
      expect(response.statusCode, response.body).toBe(200);
      expect(withoutRequestId(response)).toBe(
        withoutRequestId(removals[0] as LightMyRequestResponse),
      );
      expect(response.json()).toEqual({ state: "removed" });
    }
    expect((await readList(brand, list.id)).items).toEqual([]);
    // an addition is idempotent too, its date kept
    const first = await send(brand, "PUT", itemUrl(list.id, inList.alias));
    const before = (await readList(brand, list.id)).items[0]?.addedAt;
    const again = await send(brand, "PUT", itemUrl(list.id, inList.alias));
    expect(first.json()).toEqual(again.json());
    expect((await readList(brand, list.id)).items[0]?.addedAt).toBe(before);
    expect(await rowsOf(brand)).toEqual({ n: 1, items: 1 });
  });
});

describe("L3F-T8 the campaign of a list and the entry of the base (10 RG51; modele §1, §5)", () => {
  it("RG51: a list attaches to an admitted campaign of the brand; another brand's, a draft and an unknown one answer as an unknown address, nothing created", async () => {
    const attached = await createList(owner, "For the campaign", campaign.id);
    expect(attached.campaignId).toBe(campaign.id);
    const before = await rowsOf(owner);
    for (const campaignId of [
      strangersCampaign.id,
      draftCampaign.id,
      randomUUID(),
    ]) {
      const response = await send(owner, "POST", URL_SHORTLISTS, {
        name: "Refused",
        campaignId,
      });
      expect(fx.errorBody(response)).toEqual(unknownAddress);
      expect(response.body).not.toContain(campaignId);
    }
    expect(await rowsOf(owner)).toEqual(before);
    await send(owner, "DELETE", `${URL_SHORTLISTS}/${attached.id}`);
  });

  it("a rename is a replacement: the campaign detaches with null, an unchanged one passes, another brand's answers as unknown", async () => {
    const brand = await newBrand();
    const ownCampaign = await brandCampaign(fx, server, brand, {
      state: "paused",
    });
    const list = await createList(brand, "Replace", ownCampaign.id);
    const url = `${URL_SHORTLISTS}/${list.id}`;
    const kept = await send(brand, "PUT", url, {
      name: "Renamed",
      campaignId: ownCampaign.id,
    });
    expect(kept.json()).toMatchObject({
      state: "shortlist",
      shortlist: { name: "Renamed", campaignId: ownCampaign.id },
    });
    const foreign = await send(brand, "PUT", url, {
      name: "Renamed",
      campaignId: strangersCampaign.id,
    });
    expect(fx.errorBody(foreign)).toEqual(unknownAddress);
    const detached = await send(brand, "PUT", url, {
      name: "Renamed",
      campaignId: null,
    });
    expect(detached.json()).toMatchObject({
      shortlist: { campaignId: null },
    });
    // a body without `campaignId` is not a replacement: refused by the contract
    const partial = await send(brand, "PUT", url, { name: "Partial" });
    expect(partial.statusCode).toBe(400);
  });

  it("a name or a note out of bounds is 400 on its path; a body with another key, a malformed uuid or no name is refused by the contract; nothing written", async () => {
    const brand = await newBrand();
    await serve(brand);
    const list = await createList(brand, "Bounds");
    const subject = creators[0] as SearchCreator;
    await send(brand, "PUT", itemUrl(list.id, subject.alias));
    const before = await rowsOf(brand);

    for (const name of ["   ", "x".repeat(81), "two\nlines"]) {
      const response = await send(brand, "POST", URL_SHORTLISTS, { name });
      expect(response.statusCode, name).toBe(400);
      expect(fx.issuesOf(response)).toEqual([
        { path: "name", issue: "invalid_name" },
      ]);
    }
    for (const body of [
      { name: "" },
      { name: "Fine", creatorAccountId: randomUUID() },
      { name: "Fine", price: 100 },
      { name: "Fine", campaignId: "not-a-uuid" },
      {},
    ]) {
      const response = await send(brand, "POST", URL_SHORTLISTS, body);
      expect(response.statusCode, JSON.stringify(body)).toBe(400);
      expect(fx.errorBody(response).code).toBe("validation_failed");
    }
    expect(await rowsOf(brand)).toEqual(before);

    const noteUrl = `${itemUrl(list.id, subject.alias)}/note`;
    for (const note of ["x".repeat(501), "   "]) {
      const response = await send(brand, "PUT", noteUrl, { note });
      expect(response.statusCode, note.slice(0, 5)).toBe(400);
      expect(fx.issuesOf(response)).toEqual([
        { path: "note", issue: "invalid_note" },
      ]);
    }
    for (const body of [{ note: "Fine", extra: 1 }, {}, { note: 5 }]) {
      expect((await send(brand, "PUT", noteUrl, body)).statusCode).toBe(400);
    }
    // a malformed list identifier is refused by the shape of the path
    expect(
      (await send(brand, "GET", `${URL_SHORTLISTS}/not-a-uuid`)).statusCode,
    ).toBe(400);
    // null clears a note
    await send(brand, "PUT", noteUrl, { note: "A note" });
    expect((await readList(brand, list.id)).items[0]?.note).toBe("A note");
    expect((await send(brand, "PUT", noteUrl, { note: null })).json()).toEqual({
      state: "noted",
    });
    expect((await readList(brand, list.id)).items[0]?.note).toBeNull();
  });
});

describe("L3F-T8 the bounds of the base (10 RG63; modele §5)", () => {
  it("listsPerAccount reached: 409 conflict on `shortlist` (shortlist_limit), nothing created; room again after a deletion", async () => {
    const brand = await newBrand();
    await withSearchSetting(
      fx,
      "selection_limits",
      { listsPerAccount: 2, itemsPerList: 25, requestsPerDay: 5 },
      async () => {
        const first = await createList(brand, "One");
        await createList(brand, "Two");
        const third = await send(brand, "POST", URL_SHORTLISTS, {
          name: "Three",
        });
        expect(fx.errorBody(third)).toMatchObject({
          status: 409,
          code: "conflict",
        });
        expect(fx.issuesOf(third)).toEqual([
          { path: "shortlist", issue: "shortlist_limit" },
        ]);
        expect((await rowsOf(brand)).n).toBe(2);
        await send(brand, "DELETE", `${URL_SHORTLISTS}/${first.id}`);
        await createList(brand, "Three");
        expect((await rowsOf(brand)).n).toBe(2);
      },
    );
  });

  it("itemsPerList reached: 409 conflict on `shortlist` (shortlist_full); a creator already there is still answered added; room again after a removal", async () => {
    const brand = await newBrand();
    await serve(brand);
    const [a, b, c] = creators as [SearchCreator, SearchCreator, SearchCreator];
    await withSearchSetting(
      fx,
      "selection_limits",
      { listsPerAccount: 10, itemsPerList: 2, requestsPerDay: 5 },
      async () => {
        const list = await createList(brand, "Full");
        await send(brand, "PUT", itemUrl(list.id, a.alias));
        await send(brand, "PUT", itemUrl(list.id, b.alias));
        const over = await send(brand, "PUT", itemUrl(list.id, c.alias));
        expect(fx.errorBody(over)).toMatchObject({
          status: 409,
          code: "conflict",
        });
        expect(fx.issuesOf(over)).toEqual([
          { path: "shortlist", issue: "shortlist_full" },
        ]);
        expect((await rowsOf(brand)).items).toBe(2);
        expect(
          (await send(brand, "PUT", itemUrl(list.id, a.alias))).json(),
        ).toEqual({ state: "added" });
        await send(brand, "DELETE", itemUrl(list.id, a.alias));
        expect(
          (await send(brand, "PUT", itemUrl(list.id, c.alias))).json(),
        ).toEqual({ state: "added" });
        expect((await rowsOf(brand)).items).toBe(2);
      },
    );
  });
});

describe("L3F-T8 T14.1 to T14.4 a list is its brand's alone (18 T14; fiche invariant 15)", () => {
  it("another brand's list, read, renamed, deleted, filled, noted or emptied, answers byte for byte as a list that does not exist; the list is untouched", async () => {
    const list = await createList(owner, "Mine");
    const subject = creators[0] as SearchCreator;
    await send(owner, "PUT", itemUrl(list.id, subject.alias));
    const foreign = await newBrand();
    await serve(foreign);
    const missing = randomUUID();
    const calls: [
      "GET" | "PUT" | "DELETE",
      (id: string) => string,
      unknown?,
    ][] = [
      ["GET", (id) => `${URL_SHORTLISTS}/${id}`],
      [
        "PUT",
        (id) => `${URL_SHORTLISTS}/${id}`,
        { name: "Taken", campaignId: null },
      ],
      ["DELETE", (id) => `${URL_SHORTLISTS}/${id}`],
      ["PUT", (id) => itemUrl(id, subject.alias)],
      [
        "PUT",
        (id) => `${itemUrl(id, subject.alias)}/note`,
        { note: "Mine now" },
      ],
      ["DELETE", (id) => itemUrl(id, subject.alias)],
    ];
    for (const [method, url, body] of calls) {
      const theirs = await send(foreign, method, url(list.id), body);
      const unknown = await send(foreign, method, url(missing), body);
      expect(fx.errorBody(theirs), `${method} ${url(":id")}`).toEqual(
        unknownAddress,
      );
      expect(withoutRequestId(theirs).replaceAll(list.id, "ID")).toBe(
        withoutRequestId(unknown).replaceAll(missing, "ID"),
      );
    }
    const read = await readList(owner, list.id);
    expect(read.shortlist).toMatchObject({ name: "Mine", count: 1 });
    expect(read.items).toHaveLength(1);
    // the other brand's own lists never list it
    expect((await send(foreign, "GET", URL_SHORTLISTS)).json()).toEqual({
      state: "shortlists",
      shortlists: [],
    });
    await send(owner, "DELETE", `${URL_SHORTLISTS}/${list.id}`);
  });

  it("T14.3: a creator gets the answer of a route that does not exist on every route, before any door; no session is 401", async () => {
    const creator = await fx.newMember("creator");
    const list = await createList(owner, "Not for creators");
    const id = list.id;
    const subject = creators[0] as SearchCreator;
    const calls: ["GET" | "POST" | "PUT" | "DELETE", string, unknown?][] = [
      ["GET", URL_SHORTLISTS],
      ["POST", URL_SHORTLISTS, { name: "Creator list" }],
      ["GET", `${URL_SHORTLISTS}/${id}`],
      ["PUT", `${URL_SHORTLISTS}/${id}`, { name: "Taken", campaignId: null }],
      ["DELETE", `${URL_SHORTLISTS}/${id}`],
      ["PUT", itemUrl(id, subject.alias)],
      ["DELETE", itemUrl(id, subject.alias)],
      ["PUT", `${itemUrl(id, subject.alias)}/note`, { note: "No" }],
    ];
    for (const [method, url, body] of calls) {
      const refused = await send(creator, method, url, body);
      expect(fx.errorBody(refused), `${method} ${url}`).toEqual(unknownAddress);
      expect(markersIn(refused, subject.markers)).toEqual([]);
      const anonymous = await send(null, method, url, body);
      expect(fx.errorBody(anonymous).status, `${method} ${url}`).toBe(401);
    }
    const [row] = await fx.migration<{ n: number }[]>`
      select count(*)::int as n from search.shortlists
       where advertiser_account_id = ${creator.accountId}`;
    expect(row?.n).toBe(0);
    expect((await readList(owner, id)).shortlist.name).toBe("Not for creators");
    await send(owner, "DELETE", `${URL_SHORTLISTS}/${id}`);
  });
});

describe("L3F-T8 the states without a list (10 RG1; CA59; D38; fiche invariant 10)", () => {
  it("D38: the switch closed answers `closed` alone on every route, nothing written nor served, the lists back when it opens", async () => {
    const brand = await newBrand();
    await serve(brand);
    const list = await createList(brand, "Kept");
    const subject = creators[0] as SearchCreator;
    await send(brand, "PUT", itemUrl(list.id, subject.alias));
    const before = await rowsOf(brand);
    await withSearchSetting(fx, "is_open_to_advertisers", false, async () => {
      const calls: ["GET" | "POST" | "PUT" | "DELETE", string, unknown?][] = [
        ["GET", URL_SHORTLISTS],
        ["POST", URL_SHORTLISTS, { name: "Closed" }],
        ["GET", `${URL_SHORTLISTS}/${list.id}`],
        [
          "PUT",
          `${URL_SHORTLISTS}/${list.id}`,
          { name: "Closed", campaignId: null },
        ],
        ["DELETE", `${URL_SHORTLISTS}/${list.id}`],
        ["PUT", itemUrl(list.id, creators[1]?.alias ?? "")],
        ["DELETE", itemUrl(list.id, subject.alias)],
        ["PUT", `${itemUrl(list.id, subject.alias)}/note`, { note: "Closed" }],
      ];
      for (const [method, url, body] of calls) {
        const response = await send(brand, method, url, body);
        expect(response.statusCode, `${method} ${url}`).toBe(200);
        expect(response.json()).toEqual({ state: "closed" });
        expect(markersIn(response, allMarkers())).toEqual([]);
      }
    });
    expect(await rowsOf(brand)).toEqual(before);
    const read = await readList(brand, list.id);
    expect(read.shortlist).toMatchObject({ name: "Kept", count: 1 });
    expect(read.items).toHaveLength(1);
  });

  it("RG1: a brand whose profile is not published gets the state alone on every route, whatever the list, nothing written", async () => {
    const draft = await fx.newMember("advertiser");
    brands.push(draft);
    const id = randomUUID();
    const subject = creators[0] as SearchCreator;
    const calls: ["GET" | "POST" | "PUT" | "DELETE", string, unknown?][] = [
      ["GET", URL_SHORTLISTS],
      ["POST", URL_SHORTLISTS, { name: "Draft" }],
      ["GET", `${URL_SHORTLISTS}/${id}`],
      ["PUT", `${URL_SHORTLISTS}/${id}`, { name: "Draft", campaignId: null }],
      ["DELETE", `${URL_SHORTLISTS}/${id}`],
      ["PUT", itemUrl(id, subject.alias)],
      ["DELETE", itemUrl(id, subject.alias)],
      ["PUT", `${itemUrl(id, subject.alias)}/note`, { note: "Draft" }],
    ];
    for (const [method, url, body] of calls) {
      const response = await send(draft, method, url, body);
      expect(response.statusCode, `${method} ${url}`).toBe(200);
      expect(response.json()).toEqual({ state: "brand_not_published" });
    }
    expect(await rowsOf(draft)).toEqual({ n: 0, items: 0 });
  });
});

describe("L3F-T8 nothing leaves the brand, no export (10 RG8, RG63; CA52, CA64; D45; 18 TM12.3)", () => {
  it("D45, CA52, CA64: creating, filling, noting, emptying and deleting a list writes nothing to the outbox (Brevo, Apollo), matching nor messaging", async () => {
    // the owner of the campaign, whose searches already served the creators
    const brand = owner;
    const before = await sideEffectsOf(fx);
    expect(Object.keys(before.tables)).toContain("matching.party_blocks");
    const list = await createList(brand, "Quiet", campaign.id);
    const subject = creators[2] as SearchCreator;
    await send(brand, "PUT", itemUrl(list.id, subject.alias));
    await send(brand, "PUT", `${itemUrl(list.id, subject.alias)}/note`, {
      note: "Private",
    });
    await send(brand, "GET", `${URL_SHORTLISTS}/${list.id}`);
    await send(brand, "PUT", `${URL_SHORTLISTS}/${list.id}`, {
      name: "Quieter",
      campaignId: null,
    });
    await send(brand, "DELETE", itemUrl(list.id, subject.alias));
    await send(brand, "DELETE", `${URL_SHORTLISTS}/${list.id}`);
    expect(await sideEffectsOf(fx)).toEqual(before);
  });

  it("TM12.3: the routes of the shortlists are the nine of the model, no export, no « add them all », no size of page", async () => {
    const routes = routeInventoryOf(server)
      .filter((route) => route.url.startsWith(URL_SHORTLISTS))
      .map((route) => `${route.method} ${route.url}`)
      .sort();
    expect(routes).toEqual([
      "DELETE /v1/me/shortlists/:id",
      "DELETE /v1/me/shortlists/:id/items/:alias",
      "GET /v1/me/shortlists",
      "GET /v1/me/shortlists/:id",
      "POST /v1/me/shortlists",
      "PUT /v1/me/shortlists/:id",
      "PUT /v1/me/shortlists/:id/items/:alias",
      "PUT /v1/me/shortlists/:id/items/:alias/note",
    ]);
    expect(
      routeInventoryOf(server)
        .map((route) => route.url)
        .filter((url) => /shortlist|selection/.test(url))
        .filter((url) => /export|csv|xlsx|download|all|bulk/.test(url)),
    ).toEqual([]);
    const SIZE =
      /^(limit|size|pageSize|perPage|per_page|page_size|count|format|all)$/;
    for (const schema of [
      shortlistCreateBodySchema,
      shortlistUpdateBodySchema,
      shortlistNoteBodySchema,
    ]) {
      expect(Object.keys(schema.shape).filter((key) => SIZE.test(key))).toEqual(
        [],
      );
    }
    const list = await createList(owner, "Sizes");
    const subject = creators[0] as SearchCreator;
    await send(owner, "PUT", itemUrl(list.id, subject.alias));
    await send(
      owner,
      "PUT",
      itemUrl(list.id, (creators[1] as SearchCreator).alias),
    );
    // a size asked for in the address changes nothing: the base holds it
    const plain = await send(owner, "GET", `${URL_SHORTLISTS}/${list.id}`);
    const sized = await send(
      owner,
      "GET",
      `${URL_SHORTLISTS}/${list.id}?limit=1&pageSize=1&format=csv`,
    );
    expect(sized.statusCode, sized.body).toBe(200);
    expect((sized.json() as Read).items).toHaveLength(2);
    expect((sized.json() as Read).items).toEqual((plain.json() as Read).items);
    expect(sized.headers["content-type"]).toContain("application/json");
    // no route adds everything, none exports: unknown addresses
    for (const [method, url] of [
      ["GET", `${URL_SHORTLISTS}/${list.id}/export`],
      ["POST", `${URL_SHORTLISTS}/${list.id}/items`],
      ["PUT", `${URL_SHORTLISTS}/${list.id}/items`],
      ["POST", `${URL_SHORTLISTS}/${list.id}/items/all`],
    ] as const) {
      const response = await send(
        owner,
        method,
        url,
        method === "GET" ? undefined : {},
      );
      expect(fx.errorBody(response), `${method} ${url}`).toEqual(
        unknownAddress,
      );
    }
    await send(owner, "DELETE", `${URL_SHORTLISTS}/${list.id}`);
  });
});

describe("L3G-T3 the six writes are bound per client address, before the session (L3FS-3; member-rate.ts)", () => {
  const LIST = randomUUID();
  const ALIAS = "23456789";
  const WRITES = [
    ["POST", URL_SHORTLISTS, { name: "Over the rate", campaignId: null }],
    ["PUT", `${URL_SHORTLISTS}/${LIST}`, { name: "Renamed", campaignId: null }],
    ["DELETE", `${URL_SHORTLISTS}/${LIST}`, undefined],
    ["PUT", itemUrl(LIST, ALIAS), undefined],
    ["DELETE", itemUrl(LIST, ALIAS), undefined],
    ["PUT", `${itemUrl(LIST, ALIAS)}/note`, { note: "A note" }],
  ] as const;

  let block = 0;
  it.each(WRITES)(
    "%s %s: beyond the bound of an address, 429 rate_limited with Retry-After and nothing written; another address passes",
    async (method, url, body) => {
      block += 1;
      const address = `10.77.${block}.1`;
      const before = await rowsOf(owner);
      // up to the bound, without a session: counted before it is read, and cheap (401 each)
      for (let call = 0; call < SHORTLIST_WRITE_ADDRESS_RATE; call += 1) {
        const response = await sendAsMember(
          server,
          null,
          method,
          url,
          body,
          address,
        );
        expect(response.statusCode, `${method} ${url} #${call}`).toBe(401);
      }
      const refused = await sendAsMember(
        server,
        owner,
        method,
        url,
        body,
        address,
      );
      expect(refused.statusCode, refused.body).toBe(429);
      expect(fx.errorBody(refused).code).toBe("rate_limited");
      expect(Number(refused.headers["retry-after"])).toBeGreaterThanOrEqual(1);
      expect(Number(refused.headers["retry-after"])).toBeLessThanOrEqual(60);
      expect(await rowsOf(owner)).toEqual(before);
      // another address is not affected
      const other = await sendAsMember(
        server,
        null,
        method,
        url,
        body,
        `10.77.${block}.2`,
      );
      expect(other.statusCode).toBe(401);
    },
  );
});

describe("L3G fix-2 L3GS-1 a lock timeout answers 429 (0327; D85 (1))", () => {
  it("the lock of the brand's lists held elsewhere: a write answers 429 rate_limited, Retry-After 1, the envelope alone, no server error line, nothing written", async () => {
    const brand = await newBrand();
    await expectLockTimeoutRefusal(
      fx,
      `search.shortlists:${brand.accountId}`,
      () => send(brand, "POST", URL_SHORTLISTS, { name: "Held" }),
    );
    expect(await rowsOf(brand)).toEqual({ n: 0, items: 0 });
  });
});
