// The boundary between the two charters of apps/web, page by page (02 §21.2; 20 §11.1; F1 settled
// by the founder on 2026-10-29: the public legal pages stay in the vitrine). The one list of it in
// the journeys (18 §12.1 TD4.4): e2e/charter-cascade.spec.ts reads it, nothing copies it.
// `session`: the role of the member the page needs, seeded before it is opened.

export type Charter = "vitrine" | "keo";

export type BoundaryPage = {
  path: string;
  charter: Charter;
  session?: "advertiser" | "creator";
};

export const CHARTER_BOUNDARY: readonly BoundaryPage[] = [
  // Vitrine: reached without an account, from the landing (D59).
  { path: "/fr", charter: "vitrine" },
  { path: "/en", charter: "vitrine" },
  { path: "/fr/cgu", charter: "vitrine" },
  { path: "/en/terms", charter: "vitrine" },
  { path: "/fr/confidentialite", charter: "vitrine" },
  { path: "/en/privacy", charter: "vitrine" },
  { path: "/fr/cookies", charter: "vitrine" },
  { path: "/en/cookies", charter: "vitrine" },
  // The 404 of the [locale] level: an unknown address is no member page.
  { path: "/fr/absente", charter: "vitrine" },
  { path: "/en/absente", charter: "vitrine" },
  // KEO: sign-in and sign-up (17 §3), from the click on a door.
  { path: "/fr/connexion", charter: "keo" },
  { path: "/en/sign-in", charter: "keo" },
  { path: "/fr/inscription", charter: "keo" },
  { path: "/en/signup", charter: "keo" },
  { path: "/fr/inscription/marque", charter: "keo" },
  { path: "/en/signup/brand", charter: "keo" },
  { path: "/fr/inscription/createur", charter: "keo" },
  { path: "/en/signup/creator", charter: "keo" },
  // KEO: the homes and "mon compte", behind the session.
  { path: "/fr/marque", charter: "keo", session: "advertiser" },
  { path: "/en/brand", charter: "keo", session: "advertiser" },
  { path: "/fr/createur", charter: "keo", session: "creator" },
  { path: "/en/creator", charter: "keo", session: "creator" },
  { path: "/fr/compte", charter: "keo", session: "creator" },
  { path: "/fr/compte/preferences", charter: "keo", session: "creator" },
  { path: "/fr/compte/sessions", charter: "keo", session: "creator" },
  { path: "/fr/compte/donnees", charter: "keo", session: "creator" },
  { path: "/en/account", charter: "keo", session: "creator" },
  { path: "/en/account/preferences", charter: "keo", session: "creator" },
  { path: "/en/account/sessions", charter: "keo", session: "creator" },
  { path: "/en/account/data", charter: "keo", session: "creator" },
];
