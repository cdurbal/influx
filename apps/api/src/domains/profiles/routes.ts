// Routes of the brand profile, "mon profil" (docs/mvp/06 RG2, RG5, RG14; 18 T14; jalons/l2b,
// commit 07). Web surface only, member session required. The account is always the session's: no
// route takes an account id, and no path carries an object identifier.
// - GET   /v1/me/brand-profile         the profile, its completeness, what is missing, the active codes
// - PATCH /v1/me/brand-profile         autosave of what changed (partial, one transaction)
// - POST  /v1/me/brand-profile/submit  draft or rejected to pending_review (06 RG5)
// - GET    /v1/me/brand-profile/logo   the logo, its bytes in base64 (commit 09, D80)
// - PUT    /v1/me/brand-profile/logo   the raw bytes of an image, 2 MiB at most, re-encoded
// - DELETE /v1/me/brand-profile/logo   the logo removed
// Any role but advertiser (a creator included) gets the answer of a route that does not exist:
// the same code and the same body as an unknown address (T14.3, T14.4). The terms gate applies to
// an advertiser only, for that reason checked here and not by the session helper.
import {
  BRAND_LOGO_MAX_UPLOAD_BYTES,
  brandLogoRemovalResponseSchema,
  brandLogoResponseSchema,
  brandLogoUploadResponseSchema,
  brandProfileResponseSchema,
  submitBrandProfileResponseSchema,
  updateBrandProfileBodySchema,
  updateBrandProfileResponseSchema,
  type BrandLogoRemovalResponse,
  type BrandLogoResponse,
  type BrandLogoUploadResponse,
  type BrandProfileResponse,
  type SubmitBrandProfileResponse,
  type UpdateBrandProfileBody,
  type UpdateBrandProfileResponse,
} from "@influx/contracts/brand-profile";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { ApiDatabase, Transaction } from "../../db/index.ts";
import { ApiError } from "../../platform/errors.ts";
import type { ImageSlots } from "../../platform/images.ts";
import type { ObjectStore } from "../../platform/storage.ts";
import {
  withMemberSession,
  type MemberContext,
} from "../identity/member-session.ts";
import type { IdentityApp } from "../identity/routes.ts";
import {
  readBrandLogo,
  removeBrandLogo,
  uploadBrandLogo,
  type BrandLogoDependencies,
} from "./brand-logo.ts";
import {
  readBrandProfile,
  saveBrandProfile,
  submitBrandProfile,
} from "./brand-profile.ts";

export type BrandProfileRoutesDependencies = {
  database: ApiDatabase;
  now: () => Date;
  /** Supabase Storage, through src/platform/storage.ts (D80). */
  store: ObjectStore;
  /** The two slots of re-encoding of the process (stockage.md §1). */
  slots: ImageSlots;
};

/** The route of the logo (stockage.md §3, §4). */
export const BRAND_LOGO_ROUTE = "/v1/me/brand-profile/logo";

/** The only type of body the deposit reads: the raw bytes of the file (stockage.md §3). */
export const BRAND_LOGO_CONTENT_TYPE = "application/octet-stream";

export function registerBrandProfileRoutes(
  app: IdentityApp,
  dependencies: BrandProfileRoutesDependencies,
): void {
  const { database, now, store, slots } = dependencies;

  /** The member session of an advertiser; anything else is "no such route" (T14.3, T14.4). */
  function asAdvertiser<T>(
    request: FastifyRequest,
    reply: FastifyReply,
    work: (tx: Transaction) => Promise<T>,
  ): Promise<T> {
    // Personal data of the member: never kept by a cache.
    void reply.header("cache-control", "no-store");
    return withMemberSession(
      database,
      request,
      reply,
      now,
      async (tx, context: MemberContext) => {
        if (context.role !== "advertiser") {
          throw new ApiError("not_found");
        }
        if (context.termsToAccept !== null) {
          throw new ApiError("terms_acceptance_required");
        }
        return work(tx);
      },
      { terms: "exempt" },
    );
  }

  app.get(
    "/v1/me/brand-profile",
    { schema: { response: { 200: brandProfileResponseSchema } } },
    async (request, reply): Promise<BrandProfileResponse> =>
      asAdvertiser(request, reply, async (tx) => {
        const profile = await readBrandProfile(tx);
        if (profile === null) {
          throw new ApiError("not_found");
        }
        return profile;
      }),
  );

  app.patch(
    "/v1/me/brand-profile",
    {
      schema: {
        body: updateBrandProfileBodySchema,
        response: { 200: updateBrandProfileResponseSchema },
      },
    },
    async (request, reply): Promise<UpdateBrandProfileResponse> => {
      const body = request.body as UpdateBrandProfileBody;
      return asAdvertiser(request, reply, (tx) => saveBrandProfile(tx, body));
    },
  );

  app.post(
    "/v1/me/brand-profile/submit",
    { schema: { response: { 200: submitBrandProfileResponseSchema } } },
    async (request, reply): Promise<SubmitBrandProfileResponse> =>
      asAdvertiser(request, reply, (tx) => submitBrandProfile(tx)),
  );

  /** The logo service, with the member's transactions of THIS request (session checked each time). */
  function logoOf(
    request: FastifyRequest,
    reply: FastifyReply,
  ): BrandLogoDependencies {
    return {
      inTransaction: (work) => asAdvertiser(request, reply, work),
      store,
      slots,
      log: request.log,
      now,
    };
  }

  // The logo has a context of its own: the deposit reads raw bytes only, up to 2 MiB (the relay's
  // limit, D80), whatever the 1 MiB of every other route; any other type is refused (415, read as
  // validation_failed) before the handler. Model: the Brevo webhook (brevo-webhook.ts).
  void app.register(async (scope) => {
    scope.removeAllContentTypeParsers();
    scope.addContentTypeParser(
      BRAND_LOGO_CONTENT_TYPE,
      { parseAs: "buffer", bodyLimit: BRAND_LOGO_MAX_UPLOAD_BYTES },
      (_request, body, done) => {
        done(null, body);
      },
    );

    scope.get(
      BRAND_LOGO_ROUTE,
      { schema: { response: { 200: brandLogoResponseSchema } } },
      async (request, reply): Promise<BrandLogoResponse> =>
        readBrandLogo(logoOf(request, reply)),
    );

    scope.put(
      BRAND_LOGO_ROUTE,
      {
        bodyLimit: BRAND_LOGO_MAX_UPLOAD_BYTES,
        schema: { response: { 200: brandLogoUploadResponseSchema } },
      },
      async (request, reply): Promise<BrandLogoUploadResponse> => {
        const body: unknown = request.body;
        const bytes = body instanceof Uint8Array ? body : new Uint8Array(0);
        if (bytes.length === 0) {
          // The session first: a creator or a stranger learns nothing of the route (T14).
          await asAdvertiser(request, reply, async () => undefined);
          throw new ApiError("image_rejected", [
            { path: "logo", issue: "empty" },
          ]);
        }
        return uploadBrandLogo(logoOf(request, reply), bytes);
      },
    );

    scope.delete(
      BRAND_LOGO_ROUTE,
      { schema: { response: { 200: brandLogoRemovalResponseSchema } } },
      async (request, reply): Promise<BrandLogoRemovalResponse> =>
        removeBrandLogo(logoOf(request, reply)),
    );
  });
}
