/*
 * FICTITIOUS CONTENT MODULE — the only place where invented or mockup-only content lives (CA15).
 *
 * Deleting this folder removes every fictitious figure, brand, case study, profile, message,
 * photo and mockup notice. Removal procedure: docs/landing-page/01-architecture.md §6.1.
 * Only src/app/[locale]/layout.tsx and src/app/[locale]/page.tsx may import it (ESLint).
 * Texts: docs/landing-page/04-contenus.md (FR texts contain real U+00A0 and U+202F non-breaking spaces, 04 §0).
 */
import type {
  CreatorCard,
  ImageFocus,
  LandingImage,
  PlaceholderContent,
} from "@/content/landing-content";
import type { AppLocale } from "@/i18n/routing";
import type { StaticImageData } from "next/image";
import imgCase01 from "./images/img-case-01.jpg";
import imgCase02 from "./images/img-case-02.jpg";
import imgCase03 from "./images/img-case-03.jpg";
import imgCase04 from "./images/img-case-04.jpg";
import imgCase05 from "./images/img-case-05.jpg";
import imgCre01 from "./images/img-cre-01.jpg";
import imgCre02 from "./images/img-cre-02.jpg";
import imgCre03 from "./images/img-cre-03.jpg";
import imgCre04 from "./images/img-cre-04.jpg";
import imgCre05 from "./images/img-cre-05.jpg";
import imgCre06 from "./images/img-cre-06.jpg";
import imgCre07 from "./images/img-cre-07.jpg";
import imgCre08 from "./images/img-cre-08.jpg";
import imgCre09 from "./images/img-cre-09.jpg";
import imgCre10 from "./images/img-cre-10.jpg";
import imgForm01 from "./images/img-form-01.jpg";
import imgHero01 from "./images/img-hero-01.jpg";
import imgHero02 from "./images/img-hero-02.jpg";
import imgMethod01 from "./images/img-method-01.jpg";
import imgProblem01 from "./images/img-problem-01.jpg";
import imgResult01 from "./images/img-result-01.jpg";
import imgStep01 from "./images/img-step-01.jpg";
import imgStep02 from "./images/img-step-02.jpg";
import imgStep03 from "./images/img-step-03.jpg";
import imgUse01 from "./images/img-use-01.jpg";
import imgUse02 from "./images/img-use-02.jpg";
import imgUse03 from "./images/img-use-03.jpg";
import imgUse04 from "./images/img-use-04.jpg";
import imgWhy01 from "./images/img-why-01.jpg";
import imgWhy02 from "./images/img-why-02.jpg";
import imgWhy03 from "./images/img-why-03.jpg";

/**
 * Single switch of the mockup mode: "Mockup" banner and noindex robots tag (CA13, CA14).
 * Guard test G6 requires `true` as long as this module exists.
 */
export const IS_MOCKUP: boolean = true;

type ShowcaseCardId = "beauty" | "cooking" | "travel";
type NetworkCardId = "sport" | "techGaming" | "music" | "homeDecor";
type FinalCtaCardId = "fashion" | "crafts" | "wellness";
type CaseId = "case01" | "case02" | "case03" | "case04" | "case05";
type CardText = { theme: string; country: string };
type CaseText = { sector: string; metricLabel: string; summary: string };

/** Every localized fictitious text. FR and EN share this type: identical keys (CA15, CA23). */
type LocalizedTexts = {
  mockupBanner: { regionLabel: string; label: string; detail: string };
  keyFigureSourceNote: string;
  creatorCardsSourceNote: string;
  showcaseCards: Record<ShowcaseCardId, CardText>;
  featuredResult: { metricLabel: string; context: string; sourceNote: string };
  brandLogosSourceNote: string;
  cases: Record<CaseId, CaseText>;
  caseStudiesSourceNote: string;
  conversation: { m1: string; m2: string; m3: string; m4: string };
  conversationSourceNote: string;
  creatorNetworkSourceNote: string;
  networkCards: Record<NetworkCardId, CardText>;
  finalCtaCards: Record<FinalCtaCardId, CardText>;
  mockupNotice: { title: string; body: string; restart: string };
  alts: {
    hero01: string;
    case01: string;
    case02: string;
    case03: string;
    case04: string;
    case05: string;
    use01: string;
    use02: string;
    use03: string;
    use04: string;
  };
};

const TEXTS: Record<AppLocale, LocalizedTexts> = {
  fr: {
    mockupBanner: {
      regionLabel: "Avis de maquette",
      label: "Maquette : contenus fictifs",
      detail:
        "Chiffres, marques, études de cas, profils et messages sont inventés. Boutons inactifs. Rien n’est envoyé.",
    },
    keyFigureSourceNote: "Donnée fictive, affichée pour la maquette",
    creatorCardsSourceNote: "Profils fictifs, affichés pour la maquette",
    showcaseCards: {
      beauty: { theme: "Beauté", country: "France" },
      cooking: { theme: "Cuisine", country: "Belgique" },
      travel: { theme: "Voyage", country: "Canada" },
    },
    featuredResult: {
      metricLabel: "Taux de clic moyen des stories vers la boutique en ligne",
      context:
        "Thés et infusions : 6 créateurs bien-être et cuisine, vidéos courtes et stories, sur 3 mois de campagne.",
      sourceNote: "Résultat fictif, affiché pour la maquette",
    },
    brandLogosSourceNote: "Marques fictives, inventées pour la maquette",
    cases: {
      case01: {
        sector: "Cosmétique",
        metricLabel: "Hausse des visites de la page produit",
        summary:
          "Lancement d’un sérum : 8 créateurs beauté, vidéos courtes et tutoriels, sur 6 semaines.",
      },
      case02: {
        sector: "Café de spécialité",
        metricLabel: "Hausse des abonnements à la box mensuelle",
        summary:
          "Offre d’abonnement : 5 créateurs cuisine et lifestyle, recettes en vidéo et posts, sur 2 mois.",
      },
      case03: {
        sector: "Audio",
        metricLabel: "Hausse des ventes suivies par code promo",
        summary:
          "Casque sans fil : 12 créateurs tech et musique, tests en vidéo longue et stories, sur 4 semaines.",
      },
      case04: {
        sector: "Art de la table",
        metricLabel: "Hausse des ajouts au panier sur la collection",
        summary:
          "Collection de tasses : 6 créateurs maison et déco, contenus UGC et posts, sur 5 semaines.",
      },
      case05: {
        sector: "Accessoires tech",
        metricLabel: "Hausse des inscriptions à la liste d’attente",
        summary:
          "Précommande d’un clavier : 4 créateurs tech et jeux vidéo, vidéos de montage et stories, sur 3 semaines.",
      },
    },
    caseStudiesSourceNote: "Études de cas fictives, créées pour la maquette",
    conversation: {
      m1: "Bonjour ! Votre univers cuisine colle à notre lancement de café. Seriez-vous disponible pour deux vidéos courtes en mars ?",
      m2: "Avec plaisir. Je peux proposer une recette filmée et une story des coulisses. Le brief précise-t-il le ton attendu ?",
      m3: "Oui : chaleureux et simple. Je vous envoie une proposition de contrat ici, avec le montant et les dates.",
      m4: "Parfait, je la relirai ici. Pratique de voir mon net avant de signer.",
    },
    conversationSourceNote: "Conversation fictive, écrite pour la maquette",
    creatorNetworkSourceNote: "Nombre fictif, affiché pour la maquette",
    networkCards: {
      sport: { theme: "Sport", country: "Suisse" },
      techGaming: { theme: "Tech et jeux vidéo", country: "Espagne" },
      music: { theme: "Musique", country: "Brésil" },
      homeDecor: { theme: "Maison et déco", country: "États-Unis" },
    },
    finalCtaCards: {
      fashion: { theme: "Mode", country: "Maroc" },
      crafts: { theme: "Loisirs créatifs", country: "Italie" },
      wellness: { theme: "Bien-être", country: "Royaume-Uni" },
    },
    mockupNotice: {
      title: "Maquette : rien n’a été envoyé",
      body: "Cette page est une maquette. Aucune donnée n’a été transmise ni enregistrée, et aucun compte n’a été créé. Les informations saisies disparaissent si vous rechargez la page.",
      restart: "Recommencer",
    },
    alts: {
      hero01:
        "Mains photographiant au smartphone un produit tout juste sorti de son colis",
      case01:
        "Flacon de sérum à pipette posé sur un pot en verre, dans une lumière douce",
      case02: "Sachet ouvert rempli de grains de café torréfiés",
      case03: "Casque audio sans fil blanc sur fond blanc",
      case04: "Deux tasses en céramique blanches sur fond gris clair",
      case05:
        "Clavier mécanique compact aux touches grises et orange sur une table en bois",
      use01: "Boîtes d’emballage en carton kraft sur fond orange",
      use02: "Public en silhouette filmant un concert avec des smartphones",
      use03: "Main photographiant une tarte aux fruits avec un smartphone",
      use04:
        "Mains tenant un smartphone et une carte bancaire pour un achat en ligne",
    },
  },
  en: {
    mockupBanner: {
      regionLabel: "Mockup notice",
      label: "Mockup: fictitious content",
      detail:
        "Figures, brands, case studies, profiles and messages are invented. Buttons are inactive. Nothing is sent.",
    },
    keyFigureSourceNote: "Fictitious figure, shown for the mockup",
    creatorCardsSourceNote: "Fictitious profiles, shown for the mockup",
    showcaseCards: {
      beauty: { theme: "Beauty", country: "France" },
      cooking: { theme: "Cooking", country: "Belgium" },
      travel: { theme: "Travel", country: "Canada" },
    },
    featuredResult: {
      metricLabel: "Average click-through rate from stories to the online shop",
      context:
        "Teas and herbal infusions: 6 wellness and food creators, short videos and stories, over a 3-month campaign.",
      sourceNote: "Fictitious result, shown for the mockup",
    },
    brandLogosSourceNote: "Fictitious brands, invented for the mockup",
    cases: {
      case01: {
        sector: "Cosmetics",
        metricLabel: "Increase in product page visits",
        summary:
          "Serum launch: 8 beauty creators, short videos and tutorials, over 6 weeks.",
      },
      case02: {
        sector: "Specialty coffee",
        metricLabel: "Increase in monthly box subscriptions",
        summary:
          "Subscription offer: 5 food and lifestyle creators, recipe videos and posts, over 2 months.",
      },
      case03: {
        sector: "Audio",
        metricLabel: "Increase in sales tracked by promo code",
        summary:
          "Wireless headphones: 12 tech and music creators, long-form video reviews and stories, over 4 weeks.",
      },
      case04: {
        sector: "Tableware",
        metricLabel: "Increase in add-to-carts for the collection",
        summary:
          "Mug collection: 6 home and decor creators, UGC content and posts, over 5 weeks.",
      },
      case05: {
        sector: "Tech accessories",
        metricLabel: "Increase in waiting list sign-ups",
        summary:
          "Keyboard pre-order: 4 tech and gaming creators, build videos and stories, over 3 weeks.",
      },
    },
    caseStudiesSourceNote: "Fictitious case studies, created for the mockup",
    conversation: {
      m1: "Hi! Your cooking content fits our coffee launch really well. Would you be up for two short videos in March?",
      m2: "Happy to. I can offer a filmed recipe and a behind-the-scenes story. Does the brief specify the tone you want?",
      m3: "Yes: warm and simple. I’ll send you a contract proposal right here, with the amount and dates.",
      m4: "Perfect, I’ll review it here. Handy to see my net amount before signing.",
    },
    conversationSourceNote: "Fictitious conversation, written for the mockup",
    creatorNetworkSourceNote: "Fictitious number, shown for the mockup",
    networkCards: {
      sport: { theme: "Sport", country: "Switzerland" },
      techGaming: { theme: "Tech & gaming", country: "Spain" },
      music: { theme: "Music", country: "Brazil" },
      homeDecor: { theme: "Home & decor", country: "United States" },
    },
    finalCtaCards: {
      fashion: { theme: "Fashion", country: "Morocco" },
      crafts: { theme: "Arts & crafts", country: "Italy" },
      wellness: { theme: "Wellness", country: "United Kingdom" },
    },
    mockupNotice: {
      title: "Mockup: nothing was sent",
      body: "This page is a mockup. No data was sent or stored, and no account was created. Anything you entered disappears when you reload the page.",
      restart: "Start over",
    },
    alts: {
      hero01: "Hands photographing a freshly unboxed product with a smartphone",
      case01: "Dropper serum bottle resting on a glass jar in soft light",
      case02: "Open bag filled with roasted coffee beans",
      case03: "White wireless headphones on a white background",
      case04: "Two white ceramic mugs on a light grey background",
      case05:
        "Compact mechanical keyboard with grey and orange keys on a wooden table",
      use01: "Kraft cardboard packaging boxes on an orange background",
      use02: "Silhouetted audience filming a concert on smartphones",
      use03: "Hand photographing a fruit pie with a smartphone",
      use04: "Hands holding a smartphone and a bank card to shop online",
    },
  },
};

/** Fictitious brand names, identical in FR and EN (04 §2.7, checked in 04 §3.2). */
const BRANDS: readonly string[] = [
  "Lysmouré",
  "Kaffrune",
  "Ondarive",
  "Bolbruyère",
  "Clavembre",
  "Cousevaine",
  "Pédalune",
  "Aurifane",
  "Crêtenval",
  "Vuescarde",
  "Fjelmora",
  "Flammoisy",
  "Croquembel",
  "Semavrille",
  "Infuvelle",
];

type CardSpec<Id extends string> = {
  id: Id;
  audienceMin: number;
  audienceMax: number;
  image: StaticImageData;
  focus: ImageFocus;
};

const SHOWCASE_CARDS: readonly CardSpec<ShowcaseCardId>[] = [
  {
    id: "beauty",
    audienceMin: 10000,
    audienceMax: 50000,
    image: imgCre01,
    focus: "center",
  },
  {
    id: "cooking",
    audienceMin: 50000,
    audienceMax: 100000,
    image: imgCre02,
    focus: "center",
  },
  {
    id: "travel",
    audienceMin: 100000,
    audienceMax: 500000,
    image: imgCre03,
    focus: "center 60%",
  },
];

const NETWORK_CARDS: readonly CardSpec<NetworkCardId>[] = [
  {
    id: "sport",
    audienceMin: 5000,
    audienceMax: 10000,
    image: imgCre04,
    focus: "60% center",
  },
  {
    id: "techGaming",
    audienceMin: 10000,
    audienceMax: 50000,
    image: imgCre05,
    focus: "35% center",
  },
  {
    id: "music",
    audienceMin: 50000,
    audienceMax: 100000,
    image: imgCre06,
    focus: "55% center",
  },
  {
    id: "homeDecor",
    audienceMin: 10000,
    audienceMax: 50000,
    image: imgCre07,
    focus: "center 70%",
  },
];

const FINAL_CTA_CARDS: readonly CardSpec<FinalCtaCardId>[] = [
  {
    id: "fashion",
    audienceMin: 10000,
    audienceMax: 50000,
    image: imgCre08,
    focus: "center",
  },
  {
    id: "crafts",
    audienceMin: 5000,
    audienceMax: 10000,
    image: imgCre09,
    focus: "center",
  },
  {
    id: "wellness",
    audienceMin: 50000,
    audienceMax: 100000,
    image: imgCre10,
    focus: "center",
  },
];

const CASES: readonly {
  id: CaseId;
  brandName: string;
  metricValue: number;
  image: StaticImageData;
  focus: ImageFocus;
}[] = [
  {
    id: "case01",
    brandName: "Lysmouré",
    metricValue: 0.38,
    image: imgCase01,
    focus: "center",
  },
  {
    id: "case02",
    brandName: "Kaffrune",
    metricValue: 0.24,
    image: imgCase02,
    focus: "center",
  },
  {
    id: "case03",
    brandName: "Ondarive",
    metricValue: 0.52,
    image: imgCase03,
    focus: "center",
  },
  {
    id: "case04",
    brandName: "Bolbruyère",
    metricValue: 0.31,
    image: imgCase04,
    focus: "center",
  },
  {
    id: "case05",
    brandName: "Clavembre",
    metricValue: 0.45,
    image: imgCase05,
    focus: "45% center",
  },
];

function decorative(src: StaticImageData, focus: ImageFocus): LandingImage {
  return { src, alt: "", focus };
}

function buildCards<Id extends string>(
  specs: readonly CardSpec<Id>[],
  texts: Record<Id, CardText>,
): CreatorCard[] {
  return specs.map((spec) => ({
    id: spec.id,
    theme: texts[spec.id].theme,
    country: texts[spec.id].country,
    audienceMin: spec.audienceMin,
    audienceMax: spec.audienceMax,
    verified: true,
    // Creator card photos are decorative: they illustrate a topic, never a person (05 §3).
    image: decorative(spec.image, spec.focus),
  }));
}

/** Fictitious and mockup-only content for one locale. */
export function getPlaceholderContent(locale: AppLocale): PlaceholderContent {
  const texts = TEXTS[locale];

  return {
    mockupBanner: texts.mockupBanner,
    contact: { email: "contact@influx.example" },
    hero: {
      mainImage: {
        src: imgHero01,
        alt: texts.alts.hero01,
        focus: "center 35%",
      },
      secondaryImage: decorative(imgHero02, "center"),
    },
    keyFigure: { value: 1240, sourceNote: texts.keyFigureSourceNote },
    creatorCards: { sourceNote: texts.creatorCardsSourceNote },
    creatorShowcase: { cards: buildCards(SHOWCASE_CARDS, texts.showcaseCards) },
    featuredResult: {
      value: 0.036,
      metricLabel: texts.featuredResult.metricLabel,
      trend: { value: 0.9, months: 3 },
      context: texts.featuredResult.context,
      sourceNote: texts.featuredResult.sourceNote,
      image: decorative(imgResult01, "center"),
    },
    brandLogos: { brands: BRANDS, sourceNote: texts.brandLogosSourceNote },
    caseStudies: {
      items: CASES.map((item) => ({
        id: item.id,
        brandName: item.brandName,
        metricValue: item.metricValue,
        sector: texts.cases[item.id].sector,
        metricLabel: texts.cases[item.id].metricLabel,
        summary: texts.cases[item.id].summary,
        image: { src: item.image, alt: texts.alts[item.id], focus: item.focus },
      })),
      sourceNote: texts.caseStudiesSourceNote,
    },
    problem: {
      messages: [
        { id: "m1", author: "advertiser", text: texts.conversation.m1 },
        { id: "m2", author: "creator", text: texts.conversation.m2 },
        { id: "m3", author: "advertiser", text: texts.conversation.m3 },
        { id: "m4", author: "creator", text: texts.conversation.m4 },
      ],
      sourceNote: texts.conversationSourceNote,
      image: decorative(imgProblem01, "center"),
    },
    method: { image: decorative(imgMethod01, "center") },
    creatorNetwork: {
      count: 2400,
      sourceNote: texts.creatorNetworkSourceNote,
      cards: buildCards(NETWORK_CARDS, texts.networkCards),
    },
    useCases: {
      images: {
        ugc: { src: imgUse03, alt: texts.alts.use03, focus: "center" },
        acquisition: {
          src: imgUse04,
          alt: texts.alts.use04,
          focus: "center 40%",
        },
        productLaunch: {
          src: imgUse01,
          alt: texts.alts.use01,
          focus: "center",
        },
        awareness: { src: imgUse02, alt: texts.alts.use02, focus: "center" },
      },
    },
    howItWorks: {
      images: {
        createAccount: decorative(imgStep01, "center"),
        completeProfile: decorative(imgStep02, "center 40%"),
        receiveProposals: decorative(imgStep03, "center"),
      },
    },
    whyInflux: {
      images: {
        qualifiedMatching: decorative(imgWhy01, "center"),
        secureContract: decorative(imgWhy02, "center"),
        allInInflux: decorative(imgWhy03, "65% center"),
      },
    },
    finalCta: { cards: buildCards(FINAL_CTA_CARDS, texts.finalCtaCards) },
    startForm: {
      mockupNotice: texts.mockupNotice,
      image: decorative(imgForm01, "70% center"),
    },
  };
}
