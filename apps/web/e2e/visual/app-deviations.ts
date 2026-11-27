// The differences of the couples submitted to the founder (RUB line 11; 22-refonte-ux-ui/05 §3, §8):
// each is either corrected by a `fix` or written in 06b §7 with the founder's consent at F1, there is
// no third way. Until F1, app.spec.ts requires exactly these differences: a new one fails, and so does
// one that no longer shows (a fix removes its entry; a consent moves it to 06b §7 and keeps it here,
// its status changed). Pure data, read by app.spec.ts and tests/visual-compare.test.ts.

/** A difference of a couple: the lines app.spec.ts writes for it, where, and why. */
export type SubmittedDeviation = {
  /** `RUB-11-D<n>`: the line of the table of the commit and of F1. */
  id: string;
  /** The widths it shows at. */
  widths: readonly number[];
  /** The lines of app.spec.ts, without their width. */
  lines: readonly string[];
  /** Why the application differs, and what it rests on. */
  why: string;
  /** `submitted`: awaiting F1; `granted`: written in 06b §7 (date, consent). */
  status: "submitted" | "granted";
};

const NARROW = [375, 768] as const;
const WIDE = [1280, 1440] as const;
const ALL = [...NARROW, ...WIDE] as const;

/** A line of N1 as compareStructure writes it. */
function aria(
  part: string,
  line: number,
  before: string | null,
  after: string | null,
): string {
  return `N1 ${part}: aria line ${line}: ${JSON.stringify(before)} → ${JSON.stringify(after)}`;
}

const CORNERS = ["top-left", "top-right", "bottom-right", "bottom-left"];

function radius(line: string, tag: string): string[] {
  return CORNERS.map(
    (corner) => `N2 ${line}[0] <${tag}> border-${corner}-radius: 0px → 12px`,
  );
}

/** The differences every state of the member shell shows. */
function shellDeviations(state: {
  /** The first line of the state block: its words, and the count of what is missing. */
  title: string;
  missing: boolean;
}): SubmittedDeviation[] {
  return [
    {
      id: "RUB-11-D1",
      widths: NARROW,
      lines: [
        aria("header", 5, '  - button "English"', '  - link "English":'),
        aria("header", 6, null, "    - /url: {variable}"),
        "N2 E01.0-S05[0] <button> tag: button → a",
      ],
      why: "S05 (and S14, in D3): the language is a link, not a button (it changes the address, 17 §3.1; MemberShell LanguageLinks, CA06); same pill, same look",
      status: "submitted",
    },
    {
      id: "RUB-11-D2",
      widths: ALL,
      lines: radius("E01.0-S03", "a"),
      why: "S03: INFLUX keeps radius-md (12 px), the shape of its focus ring; the mockup's link has none; seen under focus only",
      status: "submitted",
    },
    {
      id: "RUB-11-D3",
      widths: WIDE,
      lines: [
        'N1 zones: banner | navigation "Navigation principale" | contentinfo → banner | navigation "Navigation principale" | complementary "Votre compte"',
        ...(state.missing
          ? [
              aria(
                "state",
                1,
                `- text: "${state.title} {variable}"`,
                `- paragraph: "${state.title}"`,
              ),
              aria("state", 2, null, "- paragraph: {variable}"),
            ]
          : [
              aria(
                "state",
                1,
                `- text: "${state.title}"`,
                `- paragraph: "${state.title}"`,
              ),
            ]),
        aria("foot", 1, "- contentinfo:", '- link "English":'),
        aria("foot", 2, '  - button "English"', "  - /url: {variable}"),
        aria(
          "foot",
          3,
          "  - paragraph: Connecté avec {variable}",
          "- paragraph: Connecté avec {variable}",
        ),
        aria(
          "foot",
          4,
          '  - button "Se déconnecter"',
          '- button "Se déconnecter"',
        ),
        "N2 E01.0-S11[0] <b> tag: b → p",
        ...(state.missing ? ["N2 E01.0-S12[0] <span> tag: span → p"] : []),
        "N2 E01.0-S14[0] <button> tag: button → a",
      ],
      why: "S11, S12, S14 to S16: the state and the foot in the aside « Votre compte » (RUB-B §1, 17 §2.3, D89; axe `region` of the mockup, 06b §3 and RU-12), its lines as paragraphs, the foot no contentinfo; the language a link (D1); same look",
      status: "submitted",
    },
    ...(state.missing
      ? [
          {
            id: "RUB-11-D4",
            widths: WIDE,
            lines: [
              ...radius("E01.0-S13", "a"),
              "N2 E01.0-S13[0] <a> stacking: static/auto → relative/auto",
            ],
            why: "S13: « Compléter mon profil » (C11 `go`) holds its 44 px target in a pseudo-element (RUB-B, 20 §11.8 « zone 44 px »): relative, radius-md for its focus ring; same box, same look",
            status: "submitted" as const,
          },
        ]
      : []),
  ];
}

/** The deviations of each couple of VISUAL_COUPLES, by its identifier. */
export const SUBMITTED_DEVIATIONS: Readonly<
  Record<string, readonly SubmittedDeviation[]>
> = {
  "E01.0:marque-neuve": shellDeviations({
    title: "Profil : Brouillon",
    missing: true,
  }),
  "E01.0:marque": shellDeviations({ title: "Profil : Publié", missing: false }),
  "E01.0:createur-neuf": shellDeviations({
    title: "Profil : En cours de saisie",
    missing: true,
  }),
  "E01.0:createur": shellDeviations({
    title: "Profil : Publié",
    missing: false,
  }),
};

/** The lines app.spec.ts must find for a couple at a width, sorted. */
export function expectedDifferences(
  deviations: readonly SubmittedDeviation[],
  width: number,
): string[] {
  return deviations
    .filter((deviation) => deviation.widths.includes(width))
    .flatMap((deviation) => deviation.lines.map((line) => `${width}: ${line}`))
    .sort();
}
