// The frozen mockups of the Lot 3bis (docs/mvp/22-refonte-ux-ui/05 §1 and §2; RUA-03, jalons/rua/
// modele-archi.md §5): 23 files, 147 states (138 of the prototype's selector, 9 reached by the anchor
// only), the windows of each space, and the SHA-256 of every file at commit 954e009. Pure data, read
// by the visual specs (e2e/visual/) and by the unit tests of the tool (tests/visual-compare.test.ts):
// a mockup touched after 954e009 fails the manifest, and is reported to the founder (05 §1).
import path from "node:path";
import { fileURLToPath } from "node:url";

/** The commit the mockups are frozen at (05 §1). */
export const MOCKUP_COMMIT = "954e009";

/** The directory of the mockups, from the repository root. */
export const MOCKUP_DIRECTORY = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
  "..",
  "..",
  "docs",
  "audit-ux-ui",
  "prototypes",
);

/**
 * The SHA-256 of each `proto-*.html` and of each file of `assets/`, at 954e009 (LF line endings,
 * `.gitattributes`). Never updated to make a run pass: a change of a mockup goes to the founder.
 */
export const MOCKUP_MANIFEST: Readonly<Record<string, string>> = {
  "proto-accueils.html":
    "6ceb35162aaad6be23ddd760043166b94fb126f1b119ff72897ef4fba2c0b765",
  "proto-apercu.html":
    "22d56bbde87bdad1f119497986af526717e2db13be5a0759285c6b755a82a92a",
  "proto-bo-accueil.html":
    "5121cf807ad6b9545fba87cb5d0a36b29b9862b8b9df65f750c820729bab4ca4",
  "proto-bo-admin.html":
    "8051e4a5a88a8e1ccf6197941fd11799f1fe414fda3bb7142697e6262e1125c4",
  "proto-bo-campagne.html":
    "3c656c8731d729c2b9ddbcad97c3aec6d46639c7d69fd230bdb3db0b3cd11b3f",
  "proto-bo-decision.html":
    "b09823e35db00946c0aecbbaa21b46d7e6a94ef6141ff51ce84a73250e9fa64e",
  "proto-bo-fiche-compte.html":
    "22c24a55ec351ab6e83e49974185845f6d7b729c1f1f6f3443ee9041739959f6",
  "proto-bo-listes.html":
    "9bf884018d07f8cf5f155c25a4efd0405d9459b02e22d70dfc1d3924e723ab79",
  "proto-bo-mobile.html":
    "2bebd1ce6b2526450fd03bb6e36a407b170f92014ac7962cb0c97b830f28d81e",
  "proto-bo-recherche.html":
    "e42bc1239b8c6eda949d3d058aa1f8b5a583669391bbb62e8d688354cab4525e",
  "proto-campagne-marque.html":
    "902c86c3bb67b63f4e323514a051a1a5427b5bebe04eaaba50378a5a6c2156cd",
  "proto-campagne.html":
    "f526f3d61ebd269b150b141a5e836f0527bc0e33f2bf60266ffcf9bf76907722",
  "proto-campagnes-createur.html":
    "9d77d3aec14ce03004c4b61b4a6400c9ae3cbf12d08802cd30fa51f3a0ce3808",
  "proto-compte.html":
    "ae52ffedca64068c127d9e7f1f31b3565505c4c9576dca75c0e82313726fc934",
  "proto-entree.html":
    "a88f74f9bfaca1d50e2c8623fc7fa6926b98cd11d850f6e60b86dc8f6c4c7bea",
  "proto-marque.html":
    "6a287ea65841972b23cc4347adeacfb7866170b3d7525a6a52c3774eeacfd547",
  "proto-mes-campagnes.html":
    "f193dedb3daaa2d7d701a11f0253a10ceb1e4830a6354483fa9ab4449e946511",
  "proto-profil-anonyme.html":
    "f2d1e61fa58eb27d628db70d5142d91c2dd732181d730db6d7e73dadc7eadabc",
  "proto-profil-marque.html":
    "de5f2bcebed98cb386bb8b7b6f0c616a8f57f7b4f8cd3dbf08f4425d08e0b381",
  "proto-profil.html":
    "b4e779800ec2b027df20fbb969e0acefda7c90171396bc206cc3eda84ef867ab",
  "proto-recherche.html":
    "ed4d72ba0531dbb379e9e5a469f37906b64c574030291bfdd6308e01dface842",
  "proto-selections.html":
    "c1fa6d248dc96a11d7a80a14d79a9d80deb5ca15d5a951fd69896e2ae11fdd0c",
  "proto-verifications.html":
    "1d99e66fa2feecfb065ba7d06335a9583e6abe78edbbb7a3553e528471dff92d",
  "assets/doc.css":
    "929340097f507f30416af232706d35770f995a99884b7e15294e6ee1d649ea27",
  "assets/doc.js":
    "1d7aa428913568e2b8ecf14bd2ecf8a2379fa30066295447f27c2eb52ba49bdc",
  "assets/fonts.css":
    "1abf02a78d36a2f49f86314d815a53ff80c6d0a065afebeb4adb2a9ee80b29cc",
  "assets/icons.js":
    "76006fa982a992676b8ce43ffb7a32a9c11d271b70d19c07319d982e1a7fda77",
  "assets/keo.css":
    "281f6fdd9d8478a1543222f47148a0c8e62cb93f1ded97f7abc08180ffe0fdfb",
  "assets/proto.js":
    "80b5cc1fe0a69a23dfd2b183e2ffcc46788ed9d4cf9d2636aad62a435dac4855",
  "assets/tokens.css":
    "dd48df291e006d672d5456304d92ed96576b66271af769706313ade5b42ca293",
};

/** A browser window of the comparison (05 §2). */
export type VisualWindow = { width: number; height: number };

/**
 * The space a mockup belongs to: its windows follow. `small-window` is screen 19 (the backoffice on
 * a telephone or a low window, 17b §1.7).
 */
export type MockupSpace = "member" | "backoffice" | "small-window";

/**
 * The family of a mockup: the frame it is drawn in (the member shell, the entry pages, the backoffice
 * shell, the small window). The self-comparison of the tool takes one state per family.
 */
export type MockupFamily = "member" | "entry" | "backoffice" | "small-window";

/**
 * The windows of each space (05 §2). Members: the four widths of the survey. Backoffice: 1 280 and
 * 1 440, the 1 024 × 768 control, and 375 (screen 19 in the application, 05 §1). Small window: 375,
 * the low window of 1 280 × 480, 1 280 and 1 440 (the gestures of E19.2 to E19.4). Never a
 * backoffice window from 768 to 1 023 px (RU-19): `visualWindowRefusal` says why.
 */
export const VISUAL_WINDOWS: Readonly<
  Record<MockupSpace, readonly VisualWindow[]>
> = {
  member: [
    { width: 375, height: 812 },
    { width: 768, height: 1024 },
    { width: 1280, height: 800 },
    { width: 1440, height: 900 },
  ],
  backoffice: [
    { width: 375, height: 812 },
    { width: 1024, height: 768 },
    { width: 1280, height: 800 },
    { width: 1440, height: 900 },
  ],
  "small-window": [
    { width: 375, height: 812 },
    { width: 1280, height: 480 },
    { width: 1280, height: 800 },
    { width: 1440, height: 900 },
  ],
};

/** The band of the backoffice kept out of N1 to N3 (RU-19, D87): the strip, not the rail. */
export const BACKOFFICE_EXCLUDED_BAND = { from: 768, to: 1023 } as const;

/** Why a window is refused to a space (RU-19), or null when it is allowed. */
export function visualWindowRefusal(
  space: MockupSpace,
  window: VisualWindow,
): string | null {
  if (
    space !== "member" &&
    window.width >= BACKOFFICE_EXCLUDED_BAND.from &&
    window.width <= BACKOFFICE_EXCLUDED_BAND.to
  ) {
    return `RU-19: the backoffice from ${BACKOFFICE_EXCLUDED_BAND.from} to ${BACKOFFICE_EXCLUDED_BAND.to} px keeps its strip, out of N1 to N3 (${window.width} × ${window.height})`;
  }
  return null;
}

/** A mockup: its file, its space and family, the states of its selector and of its anchor only. */
export type Mockup = {
  file: string;
  space: MockupSpace;
  family: MockupFamily;
  /** The options of `#demo-state`, in their order. */
  selectorStates: readonly string[];
  /** The states reached by the anchor only (05 §1). */
  anchorStates: readonly string[];
};

const member = (
  file: string,
  selectorStates: readonly string[],
  anchorStates: readonly string[] = [],
): Mockup => ({
  file,
  space: "member",
  family: "member",
  selectorStates,
  anchorStates,
});

const backoffice = (
  file: string,
  selectorStates: readonly string[],
): Mockup => ({
  file,
  space: "backoffice",
  family: "backoffice",
  selectorStates,
  anchorStates: [],
});

/** The 23 mockups of 05 §1, in alphabetical order of their file. */
export const MOCKUPS: readonly Mockup[] = [
  member("proto-accueils.html", [
    "marque-neuve",
    "marque",
    "createur-neuf",
    "createur",
  ]),
  member("proto-apercu.html", ["avant", "apres", "non-publie", "sans-visuel"]),
  backoffice("proto-bo-accueil.html", ["matin", "calme"]),
  backoffice("proto-bo-admin.html", [
    "synchro",
    "synchro-normaux",
    "dv-liste",
    "dv",
    "dv-degrade",
    "invitations",
    "invitation-creee",
    "comptes",
    "desactiver",
    "apollo",
    "sante",
  ]),
  backoffice("proto-bo-campagne.html", [
    "ouverte",
    "validation",
    "pause",
    "close",
    "corriger",
  ]),
  backoffice("proto-bo-decision.html", [
    "decision",
    "modification",
    "refus",
    "publie",
  ]),
  backoffice("proto-bo-fiche-compte.html", [
    "marque",
    "createur",
    "corriger",
    "calme",
  ]),
  backoffice("proto-bo-listes.html", [
    "file",
    "file-retard",
    "file-vide",
    "inscrits",
    "inscrits-recherche",
  ]),
  {
    file: "proto-bo-mobile.html",
    space: "small-window",
    family: "small-window",
    selectorStates: [
      "provisoire",
      "files",
      "entree",
      "prise",
      "refuser",
      "decide",
      "convs",
      "conv",
    ],
    anchorStates: [],
  },
  backoffice("proto-bo-recherche.html", [
    "prerempli",
    "libre",
    "vide",
    "chargement",
    "lot4",
  ]),
  member("proto-campagne-marque.html", [
    "publiee",
    "pause",
    "close",
    "validation",
    "corriger",
  ]),
  member("proto-campagne.html", [
    "etape-1",
    "etape-2",
    "etape-3",
    "etape-4",
    "etape-5",
    "verifier",
    "verifier-complet",
    "profil-attente",
    "envoyee",
  ]),
  member("proto-campagnes-createur.html", [
    "fil",
    "vide",
    "fiche",
    "fiche-lot4",
    "fiche-close",
  ]),
  member("proto-compte.html", [
    "hub",
    "infos",
    "email",
    "email-codes",
    "email-fait",
    "preferences",
    "sessions",
    "donnees",
    "supprimer",
  ]),
  {
    ...member(
      "proto-entree.html",
      [
        "porte",
        "email",
        "email-erreur",
        "connexion",
        "code",
        "code-connexion",
        "code-erreur",
        "code-aide",
        "infos-marque",
        "infos-createur",
        "autre-role",
      ],
      ["email-createur"],
    ),
    family: "entry",
  },
  member("proto-marque.html", ["createur", "soumise"]),
  member("proto-mes-campagnes.html", [
    "liste",
    "pause",
    "un-brouillon",
    "neuve",
  ]),
  member("proto-profil-anonyme.html", ["profil", "ajoute", "galerie"]),
  member(
    "proto-profil-marque.html",
    [
      "etape-1",
      "etape-2",
      "etape-2-vide",
      "etape-3",
      "verifier",
      "verifier-complet",
      "envoye",
      "profil",
      "modif-2",
    ],
    ["modif-1", "modif-3"],
  ),
  member(
    "proto-profil.html",
    [
      "etape-1",
      "etape-3",
      "etape-3-tout",
      "etape-5",
      "verifier",
      "profil",
      "modif-3",
    ],
    ["etape-2", "etape-4", "modif-1", "modif-2", "modif-4", "modif-5"],
  ),
  member("proto-recherche.html", ["resultats", "chargement", "vide"]),
  member("proto-selections.html", [
    "liste",
    "liste-vide",
    "cible-equipe",
    "selection",
    "tableau",
    "demande",
    "demande-envoyee",
  ]),
  member("proto-verifications.html", [
    "hub",
    "hub-vide",
    "propriete",
    "propriete-envoyee",
    "audience",
    "audience-examen",
    "audience-refusee",
    "audience-accordee",
    "contestation",
    "contestation-envoyee",
    "contestation-maintenue",
    "contestation-infirmee",
  ]),
];

/** The counts of the survey of 2026-11-24 (05 §1), asserted by the tool. */
export const SURVEY_COUNTS = {
  mockups: 23,
  selectorStates: 138,
  anchorStates: 9,
  states: 147,
  captures: 588,
} as const;

/** Every state of a mockup: those of its selector, then those of its anchor only. */
export function statesOf(mockup: Mockup): readonly string[] {
  return [...mockup.selectorStates, ...mockup.anchorStates];
}

/** One capture of the survey: a state of a mockup in a window of its space. */
export type MockupCapture = {
  mockup: Mockup;
  state: string;
  window: VisualWindow;
};

/** The captures of the survey (05 §1: 147 states, 4 windows each, 588 captures). */
export function surveyCaptures(): MockupCapture[] {
  return MOCKUPS.flatMap((mockup) =>
    statesOf(mockup).flatMap((state) =>
      VISUAL_WINDOWS[mockup.space].map((window) => ({ mockup, state, window })),
    ),
  );
}

/** The state each family is compared on by the self-comparison (one per family). */
export const FAMILY_SAMPLES: Readonly<
  Record<MockupFamily, { file: string; state: string }>
> = {
  member: { file: "proto-accueils.html", state: "marque" },
  entry: { file: "proto-entree.html", state: "code" },
  backoffice: { file: "proto-bo-decision.html", state: "decision" },
  "small-window": { file: "proto-bo-mobile.html", state: "provisoire" },
};

/** The mockup of a file; throws on a file that is not one of the 23. */
export function mockupOf(file: string): Mockup {
  const mockup = MOCKUPS.find((candidate) => candidate.file === file);
  if (mockup === undefined) throw new Error(`${file} is not a mockup of 05 §1`);
  return mockup;
}

/** A short, file-safe name of a capture: `proto-entree.code@375x812`. */
export function captureName(
  file: string,
  state: string,
  window: VisualWindow,
): string {
  return `${file.replace(/\.html$/, "")}.${state}@${window.width}x${window.height}`;
}
