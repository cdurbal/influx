// The route models the error collector and the request metrics may store (L2AS-2, 02 §20.5,
// J4S-7): a CLOSED list, declared once. `routeModelOf` (apps/api/src/domains/ops/scrub.ts) keeps a
// path only when its model is here; any other path is `unmatched` (a request) or no route (an
// error), so that a name or a handle in an address never reaches `ops`.
//
// Three families, each guarded by a test against the place where the routes really live, so that
// the list can neither lag behind a route nor keep one that is gone:
//   - API_ROUTE_MODELS: the Fastify route patterns (`apps/api/tests/route-models.test.ts`, read
//     from the server itself);
//   - WEB_PAGE_MODELS: the member pages (`MEMBER_PAGE_SLUGS`, both languages), the public documents
//     and the landing (`apps/web/tests/route-models.test.ts`);
//   - BACKOFFICE_PAGE_MODELS: the pages under `apps/backoffice/src/app`
//     (`apps/backoffice/tests/route-models.test.ts`).
// A new page or route adds ONE entry per address here, in its own commit; the guards say which.
// A page identifier appears as `:id` (the collector sends the real pathname, whose identifiers
// `routeModelOf` folds into `:id`).

/** Fastify route patterns of apps/api, as registered (a parameter keeps its declared name). */
export const API_ROUTE_MODELS: readonly string[] = [
  "/health",
  "/v1/auth/journey",
  "/v1/auth/journey/reset",
  "/v1/auth/logout",
  "/v1/auth/request-code",
  "/v1/auth/verify-code",
  "/v1/bo/accounts",
  "/v1/bo/accounts/:id",
  "/v1/bo/accounts/:id/brevo-suppression/lift",
  "/v1/bo/accounts/:id/corrections",
  "/v1/bo/accounts/counters",
  "/v1/bo/accounts/search",
  "/v1/bo/alerts",
  "/v1/bo/auth/enroll",
  "/v1/bo/auth/enroll/confirm",
  "/v1/bo/auth/invitation/accept",
  "/v1/bo/auth/login",
  "/v1/bo/auth/logout",
  "/v1/bo/auth/reauthenticate",
  "/v1/bo/dual-control",
  "/v1/bo/dual-control/:id",
  "/v1/bo/dual-control/:id/cancel",
  "/v1/bo/dual-control/:id/confirm",
  "/v1/bo/dual-control/degraded",
  "/v1/bo/internal-accounts",
  "/v1/bo/internal-invitations",
  "/v1/bo/internal-invitations/:id/revoke",
  "/v1/bo/leads/replays",
  "/v1/bo/me",
  "/v1/bo/member-invitations",
  "/v1/bo/member-invitations/:id/revoke",
  "/v1/bo/ops/errors",
  "/v1/bo/ops/errors/:id",
  "/v1/bo/ops/processes",
  "/v1/bo/ops/status",
  "/v1/bo/ops/traffic",
  "/v1/bo/queues/counters",
  "/v1/bo/queues/profiles-advertiser/entries",
  "/v1/bo/queues/profiles-advertiser/entries/:id/extend",
  "/v1/bo/queues/profiles-advertiser/entries/:id/force-release",
  "/v1/bo/queues/profiles-advertiser/entries/:id/logo",
  "/v1/bo/queues/profiles-advertiser/entries/:id/open",
  "/v1/bo/queues/profiles-advertiser/entries/:id/publish",
  "/v1/bo/queues/profiles-advertiser/entries/:id/reject",
  "/v1/bo/queues/profiles-advertiser/entries/:id/release",
  "/v1/bo/queues/profiles-advertiser/entries/search",
  "/v1/bo/settings/apollo",
  "/v1/me",
  "/v1/me/brand-profile",
  "/v1/me/brand-profile/logo",
  "/v1/me/brand-profile/submit",
  "/v1/me/consent",
  "/v1/me/creator-profile",
  "/v1/me/creator-profile/networks",
  "/v1/me/creator-profile/networks/:id",
  "/v1/me/creator-profile/networks/:id/audience",
  "/v1/me/creator-profile/networks/:id/figures",
  "/v1/me/data-export",
  "/v1/me/data-export/:id/download",
  "/v1/me/data-requests",
  "/v1/me/email-change",
  "/v1/me/email-change/:id",
  "/v1/me/email-change/confirm",
  "/v1/me/reauthenticate/request-code",
  "/v1/me/reauthenticate/verify-code",
  "/v1/me/sessions",
  "/v1/me/sessions/:id",
  "/v1/me/terms/accept",
  "/v1/ops/client-errors",
  "/v1/signup",
  "/v1/status",
  "/v1/support/code-not-received",
  "/v1/terms/current",
  "/v1/webhooks/brevo/:pathToken",
];

/** Pages of apps/web: the landing, the member pages and the public documents, per language. */
export const WEB_PAGE_MODELS: readonly string[] = [
  "/en",
  "/en/account",
  "/en/account/data",
  "/en/account/details",
  "/en/account/preferences",
  "/en/account/profile",
  "/en/account/sessions",
  "/en/brand",
  "/en/cookies",
  "/en/creator",
  "/en/privacy",
  "/en/sign-in",
  "/en/signup",
  "/en/signup/brand",
  "/en/signup/creator",
  "/en/terms",
  "/fr",
  "/fr/cgu",
  "/fr/compte",
  "/fr/compte/donnees",
  "/fr/compte/informations",
  "/fr/compte/preferences",
  "/fr/compte/profil",
  "/fr/compte/sessions",
  "/fr/confidentialite",
  "/fr/connexion",
  "/fr/cookies",
  "/fr/createur",
  "/fr/inscription",
  "/fr/inscription/createur",
  "/fr/inscription/marque",
  "/fr/marque",
];

/** Pages of apps/backoffice (route groups removed, `[id]` written `:id`). */
export const BACKOFFICE_PAGE_MODELS: readonly string[] = [
  "/",
  "/accueil",
  "/activation",
  "/comptes-internes",
  "/double-validation",
  "/double-validation/:id",
  "/files/profils-marque",
  "/files/profils-marque/:id",
  "/inscrits",
  "/inscrits/:id",
  "/invitations",
  "/reglages/apollo",
  "/sante-technique",
];

/** Every route model that may be stored; anything else is `unmatched`. */
export const KNOWN_ROUTE_MODELS: ReadonlySet<string> = new Set([
  ...API_ROUTE_MODELS,
  ...WEB_PAGE_MODELS,
  ...BACKOFFICE_PAGE_MODELS,
]);
