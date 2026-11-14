// The 50 fake brands of the staging seed. Names are invented from syllables; domains end in
// `.example` (RFC 2606: never resolves to a real site); phone numbers are fiction ranges. Pure data.
import {
  createRng,
  int,
  pick,
  sample,
  slug,
  weighted,
  type Rng,
} from "./random.ts";

export type FakeBrand = {
  index: number;
  email: string;
  legalName: string;
  websiteDomain: string;
  country: string;
  language: "fr" | "en";
  timezone: string;
  primarySector: string;
  secondarySectors: string[];
  companySizeBand: "1_10" | "11_50" | "51_250" | "251_1000" | "1001_plus";
  presentation: string;
  targetMarkets: string[];
  workingLanguages: string[];
  topics: string[];
  networks: string[];
  formats: string[];
  audienceCountries: string[];
  usageRights: string[];
  exclusivityBand: "none" | "le_1m" | "le_3m" | "negotiable";
  collaborationRhythm: "one_off" | "recurring" | "ambassador";
  offersNonMonetary: boolean;
  contactRole: string;
  contactFirstName: string;
  contactPhone: string;
  contactUrl: string;
  heardFrom:
    "online_search" | "social_media" | "word_of_mouth" | "event" | "other";
  publishedDaysAgo: number;
  logoSeed: number;
};

type Hq = {
  country: string;
  language: "fr" | "en";
  timezone: string;
  weight: number;
  markets: readonly string[];
  languages: readonly string[];
  first: readonly string[];
  phone: (rng: Rng) => string;
};
const d = (rng: Rng, n: number) =>
  Array.from({ length: n }, () => int(rng, 0, 9)).join("");
const FR_FIRST = [
  "Camille",
  "Julie",
  "Thomas",
  "Sophie",
  "Nicolas",
  "Marion",
  "Pierre",
  "Claire",
  "Antoine",
  "Émilie",
  "Guillaume",
  "Laure",
  "Julien",
  "Aurélie",
];
const EN_FIRST = [
  "Emma",
  "Oliver",
  "Sophie",
  "Daniel",
  "Hannah",
  "James",
  "Laura",
  "Ryan",
  "Megan",
  "Adam",
  "Rachel",
  "Ben",
];
const HQ: readonly Hq[] = [
  {
    country: "FR",
    language: "fr",
    timezone: "Europe/Paris",
    weight: 22,
    markets: ["FR", "BE", "CH", "CA"],
    languages: ["fr", "en"],
    first: FR_FIRST,
    phone: (r) => `+3363998${d(r, 4)}`,
  },
  {
    country: "BE",
    language: "fr",
    timezone: "Europe/Brussels",
    weight: 3,
    markets: ["BE", "FR", "NL"],
    languages: ["fr", "en"],
    first: FR_FIRST,
    phone: (r) => `+32470${d(r, 6)}`,
  },
  {
    country: "CH",
    language: "fr",
    timezone: "Europe/Zurich",
    weight: 3,
    markets: ["CH", "FR", "DE"],
    languages: ["fr", "de", "en"],
    first: FR_FIRST,
    phone: (r) => `+41790${d(r, 6)}`,
  },
  {
    country: "CA",
    language: "fr",
    timezone: "America/Toronto",
    weight: 4,
    markets: ["CA", "US", "FR"],
    languages: ["fr", "en"],
    first: FR_FIRST,
    phone: (r) => `+1514555${"01" + d(r, 2)}`,
  },
  {
    country: "GB",
    language: "en",
    timezone: "Europe/London",
    weight: 5,
    markets: ["GB", "IE", "US", "FR"],
    languages: ["en"],
    first: EN_FIRST,
    phone: (r) => `+447700900${d(r, 3)}`,
  },
  {
    country: "US",
    language: "en",
    timezone: "America/New_York",
    weight: 5,
    markets: ["US", "CA", "GB"],
    languages: ["en"],
    first: EN_FIRST,
    phone: (r) => `+1212555${"01" + d(r, 2)}`,
  },
  {
    country: "DE",
    language: "en",
    timezone: "Europe/Berlin",
    weight: 3,
    markets: ["DE", "AT", "CH", "FR"],
    languages: ["de", "en"],
    first: EN_FIRST,
    phone: (r) => `+49151${d(r, 8)}`,
  },
  {
    country: "ES",
    language: "en",
    timezone: "Europe/Madrid",
    weight: 2,
    markets: ["ES", "PT", "FR", "MX"],
    languages: ["es", "en"],
    first: EN_FIRST,
    phone: (r) => `+34612${d(r, 6)}`,
  },
  {
    country: "IT",
    language: "en",
    timezone: "Europe/Rome",
    weight: 2,
    markets: ["IT", "FR", "CH"],
    languages: ["it", "en"],
    first: EN_FIRST,
    phone: (r) => `+39320${d(r, 7)}`,
  },
  {
    country: "NL",
    language: "en",
    timezone: "Europe/Amsterdam",
    weight: 1,
    markets: ["NL", "BE", "DE"],
    languages: ["nl", "en"],
    first: EN_FIRST,
    phone: (r) => `+31612${d(r, 6)}`,
  },
];

type SectorProfile = {
  weight: number;
  suffix: { fr: readonly string[]; en: readonly string[] };
  noun: { fr: string; en: string };
  mission: { fr: readonly string[]; en: readonly string[] };
  topics: readonly string[];
  networks: readonly string[];
  formats: readonly string[];
};
const SECTORS: Record<string, SectorProfile> = {
  beauty_personal_care: {
    weight: 9,
    suffix: {
      fr: ["Cosmétiques", "Soins", "Beauté"],
      en: ["Cosmetics", "Skincare", "Beauty"],
    },
    noun: { fr: "cosmétiques et de soins", en: "cosmetics and skincare" },
    mission: {
      fr: [
        "Nos formules courtes et rassurantes sont pensées avec des dermatologues pour les peaux sensibles.",
        "Nous fabriquons en petites séries et nous détaillons chaque ingrédient sur notre site.",
      ],
      en: [
        "Our short, reassuring formulas are developed with dermatologists for sensitive skin.",
        "We make small batches and list every ingredient on our website.",
      ],
    },
    topics: ["beauty", "wellness", "fashion"],
    networks: ["instagram", "tiktok", "youtube"],
    formats: [
      "instagram_reel",
      "tiktok_video",
      "youtube_integration",
      "ugc_video",
    ],
  },
  fashion_accessories: {
    weight: 8,
    suffix: {
      fr: ["Atelier", "Maison", "Studio"],
      en: ["Atelier", "Studio", "Label"],
    },
    noun: { fr: "mode et d'accessoires", en: "fashion and accessories" },
    mission: {
      fr: [
        "Nos collections capsules sont produites en Europe, dans des ateliers que nous visitons chaque saison.",
        "Nous proposons des pièces intemporelles, pensées pour durer plusieurs années.",
      ],
      en: [
        "Our capsule collections are made in Europe, in workshops we visit every season.",
        "We offer timeless pieces designed to last for years.",
      ],
    },
    topics: ["fashion", "beauty", "travel"],
    networks: ["instagram", "tiktok", "pinterest"],
    formats: [
      "instagram_post",
      "instagram_reel",
      "tiktok_video",
      "pinterest_pin",
      "ugc_photo",
    ],
  },
  food_beverages: {
    weight: 8,
    suffix: {
      fr: ["Gourmandises", "Foods", "Saveurs"],
      en: ["Foods", "Kitchen", "Pantry"],
    },
    noun: { fr: "produits alimentaires", en: "food and drink products" },
    mission: {
      fr: [
        "Nous travaillons avec des producteurs locaux et privilégions les recettes courtes, sans additifs inutiles.",
        "Nos produits sont pensés pour se cuisiner facilement au quotidien.",
      ],
      en: [
        "We work with local producers and favour short recipes without needless additives.",
        "Our products are designed to be easy to cook with every day.",
      ],
    },
    topics: ["food", "family", "wellness"],
    networks: ["instagram", "tiktok", "pinterest"],
    formats: [
      "instagram_reel",
      "instagram_carousel",
      "tiktok_video",
      "pinterest_pin",
    ],
  },
  home_garden: {
    weight: 6,
    suffix: {
      fr: ["Maison", "Intérieurs", "Jardin"],
      en: ["Home", "Living", "Garden"],
    },
    noun: { fr: "décoration et d'aménagement", en: "home and garden products" },
    mission: {
      fr: [
        "Nous concevons du mobilier et des objets de décoration simples à assembler et à entretenir.",
        "Notre équipe accompagne les particuliers de l'idée jusqu'à la livraison.",
      ],
      en: [
        "We design furniture and decor that is easy to assemble and maintain.",
        "Our team supports customers from the first idea to delivery.",
      ],
    },
    topics: ["home", "family", "wellness"],
    networks: ["instagram", "pinterest", "youtube"],
    formats: ["instagram_post", "pinterest_pin", "youtube_video", "ugc_photo"],
  },
  sports_leisure: {
    weight: 6,
    suffix: {
      fr: ["Sport", "Outdoor", "Active"],
      en: ["Sport", "Outdoor", "Active"],
    },
    noun: {
      fr: "équipements de sport et de loisirs",
      en: "sports and leisure equipment",
    },
    mission: {
      fr: [
        "Nous équipons les sportifs du dimanche comme les compétiteurs, avec un matériel testé sur le terrain.",
        "Nos produits sont conçus avec des coachs et des athlètes régionaux.",
      ],
      en: [
        "We equip weekend athletes and competitors alike, with gear tested in the field.",
        "Our products are designed with coaches and regional athletes.",
      ],
    },
    topics: ["sport_fitness", "wellness", "travel"],
    networks: ["instagram", "tiktok", "youtube"],
    formats: [
      "instagram_reel",
      "tiktok_video",
      "youtube_video",
      "youtube_short",
    ],
  },
  consumer_electronics: {
    weight: 5,
    suffix: {
      fr: ["Tech", "Électronique", "Labs"],
      en: ["Tech", "Devices", "Labs"],
    },
    noun: {
      fr: "objets connectés et d'accessoires high-tech",
      en: "connected devices and tech accessories",
    },
    mission: {
      fr: [
        "Nous concevons des accessoires fiables, réparables et garantis deux ans.",
        "Notre support client répond en français et en anglais en moins d'une journée.",
      ],
      en: [
        "We design reliable accessories that can be repaired and carry a two-year warranty.",
        "Our customer support answers in French and English within a day.",
      ],
    },
    topics: ["tech", "gaming", "business_finance"],
    networks: ["youtube", "tiktok", "instagram"],
    formats: [
      "youtube_integration",
      "tiktok_video",
      "instagram_reel",
      "ugc_video",
    ],
  },
  travel_tourism: {
    weight: 5,
    suffix: {
      fr: ["Voyages", "Escapades", "Séjours"],
      en: ["Travel", "Escapes", "Stays"],
    },
    noun: { fr: "voyages et d'hébergements", en: "travel and accommodation" },
    mission: {
      fr: [
        "Nous organisons des séjours à taille humaine, avec des hébergements choisis un par un.",
        "Nos circuits privilégient les transports bas carbone quand c'est possible.",
      ],
      en: [
        "We organise human-sized trips with accommodation chosen one by one.",
        "Our itineraries favour low-carbon transport whenever possible.",
      ],
    },
    topics: ["travel", "food", "culture"],
    networks: ["instagram", "youtube", "tiktok"],
    formats: [
      "instagram_carousel",
      "youtube_video",
      "tiktok_video",
      "ugc_photo",
    ],
  },
  restaurants_hospitality: {
    weight: 4,
    suffix: {
      fr: ["Table", "Hôtels", "Maison"],
      en: ["Table", "Hotels", "House"],
    },
    noun: {
      fr: "restaurants et d'hôtellerie",
      en: "restaurants and hospitality",
    },
    mission: {
      fr: [
        "Nos adresses misent sur une cuisine de saison et un accueil chaleureux.",
        "Nous ouvrons régulièrement nos tables aux créateurs pour des soirées découverte.",
      ],
      en: [
        "Our venues focus on seasonal cooking and a warm welcome.",
        "We regularly open our tables to creators for discovery evenings.",
      ],
    },
    topics: ["food", "travel", "culture"],
    networks: ["instagram", "tiktok", "facebook"],
    formats: ["instagram_reel", "instagram_story", "tiktok_video", "ugc_photo"],
  },
  software_telecom: {
    weight: 5,
    suffix: {
      fr: ["Software", "Cloud", "Digital"],
      en: ["Software", "Cloud", "Digital"],
    },
    noun: {
      fr: "logiciels et de services numériques",
      en: "software and digital services",
    },
    mission: {
      fr: [
        "Notre application aide les indépendants et les petites équipes à gagner du temps au quotidien.",
        "Nous proposons un essai gratuit de 30 jours, sans carte bancaire.",
      ],
      en: [
        "Our app helps freelancers and small teams save time every day.",
        "We offer a free 30-day trial with no credit card.",
      ],
    },
    topics: ["tech", "business_finance", "education"],
    networks: ["linkedin", "youtube", "instagram"],
    formats: [
      "linkedin_post",
      "youtube_integration",
      "instagram_reel",
      "ugc_video",
    ],
  },
  baby_kids: {
    weight: 4,
    suffix: { fr: ["Kids", "Bébé", "Petits"], en: ["Kids", "Baby", "Little"] },
    noun: { fr: "puériculture et de jouets", en: "childcare and toys" },
    mission: {
      fr: [
        "Nos jouets et accessoires respectent les normes européennes les plus strictes.",
        "Nous les testons avec des familles avant chaque lancement.",
      ],
      en: [
        "Our toys and accessories meet the strictest European standards.",
        "We test them with families before every launch.",
      ],
    },
    topics: ["family", "home", "education"],
    networks: ["instagram", "facebook", "pinterest"],
    formats: ["instagram_post", "instagram_reel", "facebook_post", "ugc_photo"],
  },
  pet_care: {
    weight: 4,
    suffix: {
      fr: ["Animaux", "Pets", "Compagnons"],
      en: ["Pets", "Paws", "Companions"],
    },
    noun: {
      fr: "alimentation et d'accessoires pour animaux",
      en: "pet food and accessories",
    },
    mission: {
      fr: [
        "Nos croquettes sont élaborées avec des vétérinaires et fabriquées en petites séries.",
        "Nous reversons une partie de nos ventes à des refuges locaux.",
      ],
      en: [
        "Our food is formulated with vets and made in small batches.",
        "We donate part of our sales to local shelters.",
      ],
    },
    topics: ["pets", "family", "wellness"],
    networks: ["instagram", "tiktok", "youtube"],
    formats: ["instagram_reel", "tiktok_video", "youtube_video", "ugc_photo"],
  },
  video_games: {
    weight: 3,
    suffix: {
      fr: ["Games", "Studio", "Interactive"],
      en: ["Games", "Studio", "Interactive"],
    },
    noun: { fr: "jeux vidéo", en: "video games" },
    mission: {
      fr: [
        "Notre studio indépendant développe des jeux narratifs pour PC et consoles.",
        "Nous associons notre communauté à chaque sortie, de la bêta au lancement.",
      ],
      en: [
        "Our independent studio develops narrative games for PC and consoles.",
        "We involve our community in every release, from beta to launch.",
      ],
    },
    topics: ["gaming", "entertainment", "tech"],
    networks: ["twitch", "youtube", "tiktok"],
    formats: [
      "twitch_live",
      "youtube_live",
      "tiktok_video",
      "youtube_integration",
    ],
  },
  education_training: {
    weight: 3,
    suffix: {
      fr: ["Académie", "Formation", "Campus"],
      en: ["Academy", "Learning", "Campus"],
    },
    noun: {
      fr: "formation et d'apprentissage en ligne",
      en: "online training and learning",
    },
    mission: {
      fr: [
        "Nos parcours courts préparent à des métiers du numérique avec des projets concrets.",
        "Plus de la moitié de nos intervenants sont des professionnels en activité.",
      ],
      en: [
        "Our short courses prepare learners for digital jobs through real projects.",
        "More than half of our instructors are working professionals.",
      ],
    },
    topics: ["education", "business_finance", "tech"],
    networks: ["youtube", "linkedin", "tiktok"],
    formats: [
      "youtube_integration",
      "linkedin_post",
      "tiktok_video",
      "ugc_video",
    ],
  },
  retail_ecommerce: {
    weight: 5,
    suffix: {
      fr: ["Boutique", "Market", "Shop"],
      en: ["Shop", "Market", "Store"],
    },
    noun: { fr: "commerce en ligne", en: "online retail" },
    mission: {
      fr: [
        "Nous sélectionnons des produits de créateurs européens et livrons en 48 heures.",
        "Notre service client est joignable par chat du lundi au samedi.",
      ],
      en: [
        "We select products from European makers and deliver within 48 hours.",
        "Our customer service is reachable by chat Monday to Saturday.",
      ],
    },
    topics: ["fashion", "home", "beauty"],
    networks: ["instagram", "tiktok", "pinterest"],
    formats: ["instagram_reel", "tiktok_video", "pinterest_pin", "ugc_photo"],
  },
  automotive_mobility: {
    weight: 3,
    suffix: {
      fr: ["Mobilité", "Motors", "Ride"],
      en: ["Mobility", "Motors", "Ride"],
    },
    noun: {
      fr: "mobilité et d'accessoires automobiles",
      en: "mobility and car accessories",
    },
    mission: {
      fr: [
        "Nous proposons des vélos électriques et des accessoires pensés pour la ville.",
        "Notre réseau d'ateliers partenaires assure l'entretien partout en Europe.",
      ],
      en: [
        "We offer e-bikes and accessories designed for city life.",
        "Our network of partner workshops handles servicing across Europe.",
      ],
    },
    topics: ["automotive", "tech", "travel"],
    networks: ["youtube", "instagram", "tiktok"],
    formats: [
      "youtube_integration",
      "instagram_reel",
      "tiktok_video",
      "youtube_short",
    ],
  },
  health: {
    weight: 3,
    suffix: {
      fr: ["Santé", "Bien-être", "Vitalité"],
      en: ["Health", "Wellness", "Vital"],
    },
    noun: {
      fr: "bien-être et de santé au quotidien",
      en: "everyday wellbeing and health",
    },
    mission: {
      fr: [
        "Nos produits ne revendiquent aucune allégation thérapeutique et suivent la réglementation en vigueur.",
        "Nous travaillons avec des professionnels de santé pour des conseils sûrs.",
      ],
      en: [
        "Our products make no therapeutic claims and follow current regulations.",
        "We work with health professionals to give safe advice.",
      ],
    },
    topics: ["wellness", "sport_fitness", "food"],
    networks: ["instagram", "youtube", "tiktok"],
    formats: [
      "instagram_carousel",
      "youtube_video",
      "tiktok_video",
      "ugc_video",
    ],
  },
  media_entertainment: {
    weight: 3,
    suffix: {
      fr: ["Médias", "Productions", "Live"],
      en: ["Media", "Productions", "Live"],
    },
    noun: { fr: "médias et de divertissement", en: "media and entertainment" },
    mission: {
      fr: [
        "Nous produisons des contenus originaux et organisons des événements en direct toute l'année.",
        "Nous collaborons avec des créateurs pour toucher de nouveaux publics.",
      ],
      en: [
        "We produce original content and run live events throughout the year.",
        "We collaborate with creators to reach new audiences.",
      ],
    },
    topics: ["entertainment", "music", "culture"],
    networks: ["tiktok", "instagram", "youtube"],
    formats: [
      "tiktok_video",
      "instagram_reel",
      "youtube_video",
      "instagram_story",
    ],
  },
  business_services: {
    weight: 3,
    suffix: {
      fr: ["Conseil", "Services", "Partners"],
      en: ["Consulting", "Services", "Partners"],
    },
    noun: { fr: "services aux entreprises", en: "business services" },
    mission: {
      fr: [
        "Nous accompagnons les PME dans leur organisation, leur gestion et leur croissance.",
        "Nos offres sont sans engagement de durée.",
      ],
      en: [
        "We support small businesses with organisation, management and growth.",
        "Our plans carry no minimum term.",
      ],
    },
    topics: ["business_finance", "tech", "education"],
    networks: ["linkedin", "youtube", "instagram"],
    formats: [
      "linkedin_post",
      "youtube_integration",
      "instagram_carousel",
      "ugc_video",
    ],
  },
  nonprofit_public: {
    weight: 2,
    suffix: {
      fr: ["Association", "Fondation", "Collectif"],
      en: ["Foundation", "Collective", "Trust"],
    },
    noun: {
      fr: "actions solidaires et d'intérêt général",
      en: "charitable and public-interest work",
    },
    mission: {
      fr: [
        "Nous menons des campagnes de sensibilisation et de collecte avec l'aide de bénévoles.",
        "Chaque collaboration est entièrement transparente sur l'usage des fonds.",
      ],
      en: [
        "We run awareness and fundraising campaigns with the help of volunteers.",
        "Every collaboration is fully transparent about how funds are used.",
      ],
    },
    topics: ["culture", "education", "family"],
    networks: ["instagram", "tiktok", "facebook"],
    formats: [
      "instagram_reel",
      "tiktok_video",
      "facebook_post",
      "instagram_story",
    ],
  },
  real_estate: {
    weight: 2,
    suffix: {
      fr: ["Immobilier", "Habitat", "Résidences"],
      en: ["Properties", "Homes", "Residences"],
    },
    noun: { fr: "services immobiliers", en: "property services" },
    mission: {
      fr: [
        "Nous accompagnons l'achat, la vente et la location avec des visites vidéo détaillées.",
        "Nos agents sont disponibles en soirée et le week-end.",
      ],
      en: [
        "We support buying, selling and renting with detailed video tours.",
        "Our agents are available evenings and weekends.",
      ],
    },
    topics: ["home", "business_finance", "travel"],
    networks: ["instagram", "youtube", "linkedin"],
    formats: ["instagram_reel", "youtube_video", "linkedin_post", "ugc_video"],
  },
};
const SIZE_BY_WEIGHT = [
  ["1_10", 25],
  ["11_50", 35],
  ["51_250", 25],
  ["251_1000", 10],
  ["1001_plus", 5],
] as const;
const SYLLABLES = [
  "ka",
  "vo",
  "li",
  "sa",
  "ne",
  "mi",
  "ra",
  "lu",
  "to",
  "be",
  "do",
  "fa",
  "ni",
  "pe",
  "su",
  "zo",
  "ar",
  "el",
  "or",
  "vi",
  "ma",
  "re",
  "co",
  "ty",
];
const ROLES = [
  ["marketing", 35],
  ["partnerships_influence", 25],
  ["communication", 15],
  ["ecommerce", 10],
  ["executive", 8],
  ["mandated_agency", 5],
  ["procurement", 2],
] as const;

function inventName(rng: Rng): string {
  const word = Array.from({ length: int(rng, 2, 3) }, () =>
    pick(rng, SYLLABLES),
  ).join("");
  return word.charAt(0).toUpperCase() + word.slice(1);
}

export function generateBrands(count: number, seed: number): FakeBrand[] {
  const rng = createRng(seed);
  const sectors = Object.entries(SECTORS);
  const names = new Set<string>();
  const emails = new Set<string>();
  const brands: FakeBrand[] = [];
  for (let index = 0; index < count; index += 1) {
    const hq = weighted(
      rng,
      HQ.map((h) => [h, h.weight] as const),
    );
    const [primarySector, profile] = weighted(
      rng,
      sectors.map((entry) => [entry, entry[1].weight] as const),
    );
    const language = hq.language;
    let core = inventName(rng);
    while (names.has(core)) {
      core = inventName(rng);
    }
    names.add(core);
    const legalName = `${core} ${pick(rng, profile.suffix[language])}`;
    const domainBase = slug(core, "");
    const contactFirstName = pick(rng, hq.first);
    let local = `${slug(contactFirstName)}.${domainBase}`;
    while (emails.has(local)) {
      local = `${local}${int(rng, 2, 9)}`;
    }
    emails.add(local);

    const year = int(rng, 1998, 2023);
    const mission = sample(rng, profile.mission[language], 2);
    const presentation =
      language === "fr"
        ? `${legalName} est une marque ${pick(rng, ["indépendante", "française", "engagée", "familiale"])} de ${profile.noun.fr}, fondée en ${year}. ${mission.join(" ")} Nous collaborons avec des créateurs de contenu pour faire découvrir nos produits de manière authentique, avec des briefs clairs et des délais réalistes.`
        : `${legalName} is an ${pick(rng, ["independent", "ambitious", "design-led", "family-run"])} brand of ${profile.noun.en}, founded in ${year}. ${mission.join(" ")} We work with content creators to introduce our products authentically, with clear briefs and realistic deadlines.`;
    if (presentation.length < 120 || presentation.length > 1000) {
      throw new Error(
        `brand ${index}: presentation ${presentation.length} out of bounds`,
      );
    }

    const networks = sample(
      rng,
      profile.networks,
      int(rng, 2, profile.networks.length),
    );
    const formats = profile.formats.filter(
      (format) =>
        networks.some((n) => format.startsWith(n)) || format.startsWith("ugc"),
    );
    const markets = sample(
      rng,
      hq.markets,
      int(rng, 1, Math.min(4, hq.markets.length)),
    );
    if (!markets.includes(hq.country)) {
      markets[0] = hq.country;
    }
    brands.push({
      index,
      email: `${local}@cadaero.ovh`,
      legalName,
      websiteDomain: `${domainBase}.example`,
      country: hq.country,
      language,
      timezone: hq.timezone,
      primarySector,
      secondarySectors: sample(
        rng,
        sectors.map(([code]) => code).filter((code) => code !== primarySector),
        int(rng, 0, 2),
      ),
      companySizeBand: weighted(rng, SIZE_BY_WEIGHT),
      presentation,
      targetMarkets: [...new Set(markets)],
      // advertiser_working_languages is closed to fr and en (0202)
      workingLanguages: sample(
        rng,
        hq.languages.filter((code) => code === "fr" || code === "en"),
        int(rng, 1, 2),
      ),
      topics: sample(rng, profile.topics, int(rng, 2, 3)),
      networks,
      formats: formats.length > 0 ? formats : ["ugc_photo"],
      audienceCountries: sample(rng, hq.markets, int(rng, 1, 2)),
      usageRights: sample(
        rng,
        ["organic_repost", "paid_whitelisting", "media_buy"],
        int(rng, 1, 2),
      ),
      exclusivityBand: weighted(rng, [
        ["none", 35],
        ["le_1m", 30],
        ["le_3m", 20],
        ["negotiable", 15],
      ] as const),
      collaborationRhythm: weighted(rng, [
        ["one_off", 35],
        ["recurring", 45],
        ["ambassador", 20],
      ] as const),
      offersNonMonetary: rng() < 0.3,
      contactRole: weighted(rng, ROLES),
      contactFirstName,
      contactPhone: hq.phone(rng),
      contactUrl: `https://www.${domainBase}.example/contact`,
      heardFrom: pick(rng, [
        "online_search",
        "social_media",
        "word_of_mouth",
        "event",
        "other",
      ] as const),
      publishedDaysAgo: int(rng, 1, 60),
      logoSeed: int(rng, 1, 1_000_000),
    });
  }
  return brands;
}
