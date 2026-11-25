// The 100 fake creators of the staging seed: identities, storefront texts, network lines with
// coherent figures, audiences, offers and the shape of their portfolio. Pure data, no I/O.
// Every figure follows the bands of reference.* (nano < 10k, micro < 50k, mid < 500k, macro < 1M,
// mega), every text the length limits of 0216/0243. Phone numbers are the ranges reserved for
// fiction (ARCEP 06 39 98, Ofcom 07700 900, NANP 555-01xx): none rings a real person.
import {
  createRng,
  int,
  logUniform,
  pick,
  sample,
  slug,
  weighted,
  type Rng,
} from "./random.ts";

export type FakeAudienceCountry = { slot: number; code: string; share: number };
export type FakeLine = {
  network: string;
  isPrimary: boolean;
  handle: string;
  pseudonym: string | null;
  profileUrl: string;
  followers: number;
  postsLast30Days: number;
  avgComments: number;
  avgReach: number;
  engagementBp: number;
  countries: FakeAudienceCountry[];
  ages: { code: string; share: number }[];
  genders: { code: string; share: number }[];
};
export type FakeCreator = {
  index: number;
  email: string;
  firstName: string;
  lastName: string;
  language: "fr" | "en";
  timezone: string;
  country: string;
  region: string | null;
  city: string;
  postalCode: string;
  addressLine: string;
  phone: string;
  heardFrom:
    "online_search" | "social_media" | "word_of_mouth" | "event" | "other";
  headline: string;
  bio: string;
  primaryTopic: string;
  secondaryTopics: string[];
  publicationLanguages: string[];
  tones: string[];
  formats: string[];
  usageRights: { code: string; inclusion: "included" | "optional" }[];
  refusedSectors: string[];
  travelScope: "none" | "domestic" | "international";
  collaborationExperienceBand: "none" | "1_5" | "6_20" | "gt_20";
  deliveryLeadBand: "lt_7d" | "7_14d" | "15_30d" | "gt_30d";
  maxExclusivityBand: "none" | "le_1m" | "le_3m" | "negotiable";
  acceptsNonMonetary: boolean;
  availabilityBand: "lt_2w" | "lt_1m" | "full";
  lines: FakeLine[];
  publishedDaysAgo: number;
  portfolioCount: number;
  portfolioTopics: string[];
  captions: (string | null)[];
};

type City = {
  name: string;
  region: string | null;
  postal: () => string;
  timezone: string;
};
type Place = {
  country: string;
  language: "fr" | "en";
  nameSet: "fr" | "en" | "de" | "es" | "it" | "pt" | "br" | "nl";
  publicationLanguages: readonly string[];
  audienceCountries: readonly string[];
  cities: readonly City[];
  phone: (rng: Rng) => string;
  street: readonly string[];
};

const digits = (rng: Rng, n: number) =>
  Array.from({ length: n }, () => int(rng, 0, 9)).join("");

const FR_STREETS = [
  "rue des Lilas",
  "avenue Victor Hugo",
  "rue de la République",
  "boulevard Gambetta",
  "rue du Marché",
  "rue Pasteur",
  "allée des Tilleuls",
  "rue Saint-Michel",
];
const EN_STREETS = [
  "High Street",
  "Maple Avenue",
  "Station Road",
  "Church Lane",
  "Park Terrace",
  "Oak Street",
  "Elm Road",
  "Victoria Road",
];

const PLACES: readonly (Place & { weight: number })[] = [
  {
    weight: 40,
    country: "FR",
    language: "fr",
    nameSet: "fr",
    publicationLanguages: ["fr"],
    audienceCountries: ["BE", "CH", "CA", "MA", "DE"],
    street: FR_STREETS,
    phone: (rng) => `+3363998${digits(rng, 4)}`,
    cities: [
      {
        name: "Paris",
        region: "FR-IDF",
        postal: () => "750" + String(int(Math.random, 1, 20)).padStart(2, "0"),
        timezone: "Europe/Paris",
      },
      {
        name: "Lyon",
        region: "FR-ARA",
        postal: () => "6900" + int(Math.random, 1, 9),
        timezone: "Europe/Paris",
      },
      {
        name: "Marseille",
        region: "FR-PAC",
        postal: () => "130" + String(int(Math.random, 1, 16)).padStart(2, "0"),
        timezone: "Europe/Paris",
      },
      {
        name: "Toulouse",
        region: "FR-OCC",
        postal: () => "31000",
        timezone: "Europe/Paris",
      },
      {
        name: "Nantes",
        region: "FR-PDL",
        postal: () => "44000",
        timezone: "Europe/Paris",
      },
      {
        name: "Bordeaux",
        region: "FR-NAQ",
        postal: () => "33000",
        timezone: "Europe/Paris",
      },
      {
        name: "Lille",
        region: "FR-HDF",
        postal: () => "59000",
        timezone: "Europe/Paris",
      },
      {
        name: "Strasbourg",
        region: "FR-GES",
        postal: () => "67000",
        timezone: "Europe/Paris",
      },
      {
        name: "Rennes",
        region: "FR-BRE",
        postal: () => "35000",
        timezone: "Europe/Paris",
      },
      {
        name: "Montpellier",
        region: "FR-OCC",
        postal: () => "34000",
        timezone: "Europe/Paris",
      },
      {
        name: "Nice",
        region: "FR-PAC",
        postal: () => "06000",
        timezone: "Europe/Paris",
      },
      {
        name: "Dijon",
        region: "FR-BFC",
        postal: () => "21000",
        timezone: "Europe/Paris",
      },
      {
        name: "Rouen",
        region: "FR-NOR",
        postal: () => "76000",
        timezone: "Europe/Paris",
      },
      {
        name: "Tours",
        region: "FR-CVL",
        postal: () => "37000",
        timezone: "Europe/Paris",
      },
      {
        name: "Grenoble",
        region: "FR-ARA",
        postal: () => "38000",
        timezone: "Europe/Paris",
      },
    ],
  },
  {
    weight: 6,
    country: "BE",
    language: "fr",
    nameSet: "fr",
    publicationLanguages: ["fr"],
    audienceCountries: ["FR", "NL", "LU"],
    street: FR_STREETS,
    phone: (rng) => `+32470${digits(rng, 6)}`,
    cities: [
      {
        name: "Bruxelles",
        region: null,
        postal: () => "1000",
        timezone: "Europe/Brussels",
      },
      {
        name: "Liège",
        region: null,
        postal: () => "4000",
        timezone: "Europe/Brussels",
      },
      {
        name: "Namur",
        region: null,
        postal: () => "5000",
        timezone: "Europe/Brussels",
      },
      {
        name: "Gand",
        region: null,
        postal: () => "9000",
        timezone: "Europe/Brussels",
      },
    ],
  },
  {
    weight: 5,
    country: "CH",
    language: "fr",
    nameSet: "fr",
    publicationLanguages: ["fr"],
    audienceCountries: ["FR", "DE", "BE"],
    street: FR_STREETS,
    phone: (rng) => `+41790${digits(rng, 6)}`,
    cities: [
      {
        name: "Genève",
        region: null,
        postal: () => "1201",
        timezone: "Europe/Zurich",
      },
      {
        name: "Lausanne",
        region: null,
        postal: () => "1003",
        timezone: "Europe/Zurich",
      },
      {
        name: "Fribourg",
        region: null,
        postal: () => "1700",
        timezone: "Europe/Zurich",
      },
    ],
  },
  {
    weight: 8,
    country: "CA",
    language: "fr",
    nameSet: "fr",
    publicationLanguages: ["fr", "en"],
    audienceCountries: ["FR", "US", "BE"],
    street: FR_STREETS,
    phone: (rng) => `+1514555${"01" + digits(rng, 2)}`,
    cities: [
      {
        name: "Montréal",
        region: "CA-QC",
        postal: () => "H2X 1Y4",
        timezone: "America/Toronto",
      },
      {
        name: "Québec",
        region: "CA-QC",
        postal: () => "G1R 4P5",
        timezone: "America/Toronto",
      },
      {
        name: "Gatineau",
        region: "CA-QC",
        postal: () => "J8X 2T3",
        timezone: "America/Toronto",
      },
    ],
  },
  {
    weight: 8,
    country: "GB",
    language: "en",
    nameSet: "en",
    publicationLanguages: ["en"],
    audienceCountries: ["US", "IE", "AU", "CA"],
    street: EN_STREETS,
    phone: (rng) => `+447700900${digits(rng, 3)}`,
    cities: [
      {
        name: "London",
        region: "GB-ENG",
        postal: () => "SW1A 1AA",
        timezone: "Europe/London",
      },
      {
        name: "Manchester",
        region: "GB-ENG",
        postal: () => "M1 1AE",
        timezone: "Europe/London",
      },
      {
        name: "Bristol",
        region: "GB-ENG",
        postal: () => "BS1 4DJ",
        timezone: "Europe/London",
      },
      {
        name: "Edinburgh",
        region: "GB-SCT",
        postal: () => "EH1 1YZ",
        timezone: "Europe/London",
      },
      {
        name: "Cardiff",
        region: "GB-WLS",
        postal: () => "CF10 1AA",
        timezone: "Europe/London",
      },
    ],
  },
  {
    weight: 8,
    country: "US",
    language: "en",
    nameSet: "en",
    publicationLanguages: ["en"],
    audienceCountries: ["CA", "GB", "AU", "MX"],
    street: EN_STREETS,
    phone: (rng) => `+1212555${"01" + digits(rng, 2)}`,
    cities: [
      {
        name: "New York",
        region: "US-NY",
        postal: () => "10001",
        timezone: "America/New_York",
      },
      {
        name: "Los Angeles",
        region: "US-CA",
        postal: () => "90012",
        timezone: "America/Los_Angeles",
      },
      {
        name: "Austin",
        region: "US-TX",
        postal: () => "73301",
        timezone: "America/Chicago",
      },
      {
        name: "Miami",
        region: "US-FL",
        postal: () => "33101",
        timezone: "America/New_York",
      },
      {
        name: "Chicago",
        region: "US-IL",
        postal: () => "60601",
        timezone: "America/Chicago",
      },
      {
        name: "Seattle",
        region: "US-WA",
        postal: () => "98101",
        timezone: "America/Los_Angeles",
      },
      {
        name: "Denver",
        region: "US-CO",
        postal: () => "80202",
        timezone: "America/Denver",
      },
    ],
  },
  {
    weight: 5,
    country: "DE",
    language: "en",
    nameSet: "de",
    publicationLanguages: ["de", "en"],
    audienceCountries: ["AT", "CH", "NL"],
    street: EN_STREETS,
    phone: (rng) => `+49151${digits(rng, 8)}`,
    cities: [
      {
        name: "Berlin",
        region: null,
        postal: () => "10115",
        timezone: "Europe/Berlin",
      },
      {
        name: "Hamburg",
        region: null,
        postal: () => "20095",
        timezone: "Europe/Berlin",
      },
      {
        name: "Munich",
        region: null,
        postal: () => "80331",
        timezone: "Europe/Berlin",
      },
      {
        name: "Cologne",
        region: null,
        postal: () => "50667",
        timezone: "Europe/Berlin",
      },
    ],
  },
  {
    weight: 6,
    country: "ES",
    language: "en",
    nameSet: "es",
    publicationLanguages: ["es", "en"],
    audienceCountries: ["MX", "PT", "FR"],
    street: EN_STREETS,
    phone: (rng) => `+34612${digits(rng, 6)}`,
    cities: [
      {
        name: "Madrid",
        region: null,
        postal: () => "28001",
        timezone: "Europe/Madrid",
      },
      {
        name: "Barcelona",
        region: null,
        postal: () => "08001",
        timezone: "Europe/Madrid",
      },
      {
        name: "Valencia",
        region: null,
        postal: () => "46001",
        timezone: "Europe/Madrid",
      },
      {
        name: "Seville",
        region: null,
        postal: () => "41001",
        timezone: "Europe/Madrid",
      },
    ],
  },
  {
    weight: 5,
    country: "IT",
    language: "en",
    nameSet: "it",
    publicationLanguages: ["it", "en"],
    audienceCountries: ["CH", "FR", "DE"],
    street: EN_STREETS,
    phone: (rng) => `+39320${digits(rng, 7)}`,
    cities: [
      {
        name: "Milan",
        region: null,
        postal: () => "20121",
        timezone: "Europe/Rome",
      },
      {
        name: "Rome",
        region: null,
        postal: () => "00184",
        timezone: "Europe/Rome",
      },
      {
        name: "Turin",
        region: null,
        postal: () => "10121",
        timezone: "Europe/Rome",
      },
      {
        name: "Bologna",
        region: null,
        postal: () => "40121",
        timezone: "Europe/Rome",
      },
    ],
  },
  {
    weight: 3,
    country: "PT",
    language: "en",
    nameSet: "pt",
    publicationLanguages: ["pt", "en"],
    audienceCountries: ["BR", "ES", "FR"],
    street: EN_STREETS,
    phone: (rng) => `+351912${digits(rng, 6)}`,
    cities: [
      {
        name: "Lisbon",
        region: null,
        postal: () => "1100-148",
        timezone: "Europe/Lisbon",
      },
      {
        name: "Porto",
        region: null,
        postal: () => "4000-322",
        timezone: "Europe/Lisbon",
      },
    ],
  },
  {
    weight: 3,
    country: "BR",
    language: "en",
    nameSet: "br",
    publicationLanguages: ["pt", "en"],
    audienceCountries: ["PT", "US", "AR"],
    street: EN_STREETS,
    phone: (rng) => `+55119${digits(rng, 8)}`,
    cities: [
      {
        name: "São Paulo",
        region: null,
        postal: () => "01310-100",
        timezone: "America/Sao_Paulo",
      },
      {
        name: "Rio de Janeiro",
        region: null,
        postal: () => "20040-020",
        timezone: "America/Sao_Paulo",
      },
      {
        name: "Belo Horizonte",
        region: null,
        postal: () => "30130-010",
        timezone: "America/Sao_Paulo",
      },
    ],
  },
  {
    weight: 3,
    country: "NL",
    language: "en",
    nameSet: "nl",
    publicationLanguages: ["nl", "en"],
    audienceCountries: ["BE", "DE", "GB"],
    street: EN_STREETS,
    phone: (rng) => `+31612${digits(rng, 6)}`,
    cities: [
      {
        name: "Amsterdam",
        region: null,
        postal: () => "1012 AB",
        timezone: "Europe/Amsterdam",
      },
      {
        name: "Rotterdam",
        region: null,
        postal: () => "3011 AA",
        timezone: "Europe/Amsterdam",
      },
      {
        name: "Utrecht",
        region: null,
        postal: () => "3511 AA",
        timezone: "Europe/Amsterdam",
      },
    ],
  },
];

const NAMES: Record<
  Place["nameSet"],
  { first: readonly string[]; last: readonly string[] }
> = {
  fr: {
    first: [
      "Léa",
      "Chloé",
      "Camille",
      "Manon",
      "Inès",
      "Jade",
      "Louise",
      "Emma",
      "Sarah",
      "Clara",
      "Juliette",
      "Anaïs",
      "Margaux",
      "Lola",
      "Océane",
      "Pauline",
      "Mathilde",
      "Élise",
      "Nina",
      "Zoé",
      "Hugo",
      "Lucas",
      "Théo",
      "Maxime",
      "Antoine",
      "Julien",
      "Nathan",
      "Thomas",
      "Romain",
      "Baptiste",
      "Clément",
      "Alexandre",
      "Quentin",
      "Mehdi",
      "Yanis",
      "Adrien",
      "Paul",
      "Victor",
      "Enzo",
      "Kévin",
      "Sofiane",
      "Amine",
      "Samia",
      "Yasmine",
      "Lina",
      "Rayan",
    ],
    last: [
      "Martin",
      "Bernard",
      "Dubois",
      "Durand",
      "Leroy",
      "Moreau",
      "Simon",
      "Laurent",
      "Lefebvre",
      "Michel",
      "Garcia",
      "Bertrand",
      "Roux",
      "Vincent",
      "Fournier",
      "Morel",
      "Girard",
      "Mercier",
      "Dupont",
      "Lambert",
      "Bonnet",
      "Legrand",
      "Garnier",
      "Faure",
      "Rousseau",
      "Blanc",
      "Guérin",
      "Muller",
      "Henry",
      "Perrin",
      "Morin",
      "Mathieu",
      "Gauthier",
      "Dumont",
      "Fontaine",
      "Chevalier",
      "Robin",
      "Masson",
      "Boyer",
      "Lemaire",
      "Duval",
      "Joly",
      "Roche",
      "Noël",
      "Meyer",
      "Marchand",
      "Dufour",
      "Barbier",
      "Brun",
      "Dumas",
      "Colin",
      "Renard",
      "Caron",
      "Aubert",
      "Giraud",
      "Leclerc",
      "Vidal",
      "Lacroix",
      "Fabre",
      "Benali",
      "Haddad",
      "Diallo",
      "Nguyen",
      "Da Silva",
    ],
  },
  en: {
    first: [
      "Olivia",
      "Emily",
      "Charlotte",
      "Sophie",
      "Grace",
      "Hannah",
      "Ella",
      "Chloe",
      "Megan",
      "Lily",
      "Maya",
      "Ava",
      "Zoe",
      "Natalie",
      "Rachel",
      "Amelia",
      "Isla",
      "James",
      "Oliver",
      "Jack",
      "Harry",
      "Daniel",
      "Ryan",
      "Ethan",
      "Liam",
      "Noah",
      "Jordan",
      "Marcus",
      "Tyler",
      "Callum",
      "Owen",
      "Aaron",
      "Dylan",
      "Caleb",
      "Priya",
      "Aisha",
      "Omar",
      "Raj",
    ],
    last: [
      "Smith",
      "Johnson",
      "Williams",
      "Brown",
      "Taylor",
      "Davies",
      "Wilson",
      "Evans",
      "Roberts",
      "Walker",
      "Wright",
      "Robinson",
      "Thompson",
      "White",
      "Hughes",
      "Edwards",
      "Green",
      "Hall",
      "Wood",
      "Harris",
      "Clarke",
      "Jackson",
      "Lewis",
      "Turner",
      "Cooper",
      "Morgan",
      "Bailey",
      "Reid",
      "Murphy",
      "Campbell",
      "Foster",
      "Bennett",
      "Carter",
      "Mitchell",
      "Parker",
      "Patel",
      "Khan",
      "Nguyen",
    ],
  },
  de: {
    first: [
      "Anna",
      "Lena",
      "Marie",
      "Laura",
      "Julia",
      "Lea",
      "Jonas",
      "Lukas",
      "Felix",
      "Tim",
      "Jan",
      "Moritz",
    ],
    last: [
      "Müller",
      "Schmidt",
      "Schneider",
      "Fischer",
      "Weber",
      "Meyer",
      "Wagner",
      "Becker",
      "Hoffmann",
      "Koch",
      "Richter",
      "Klein",
    ],
  },
  es: {
    first: [
      "Lucía",
      "Carmen",
      "Marta",
      "Paula",
      "Elena",
      "Pablo",
      "Javier",
      "Álvaro",
      "Diego",
      "Sergio",
      "Irene",
      "Adrián",
    ],
    last: [
      "García",
      "Fernández",
      "López",
      "Martínez",
      "Sánchez",
      "Pérez",
      "Gómez",
      "Ruiz",
      "Hernández",
      "Díaz",
      "Moreno",
      "Navarro",
    ],
  },
  it: {
    first: [
      "Giulia",
      "Chiara",
      "Francesca",
      "Sofia",
      "Martina",
      "Matteo",
      "Luca",
      "Marco",
      "Andrea",
      "Davide",
      "Alessia",
      "Federico",
    ],
    last: [
      "Rossi",
      "Russo",
      "Ferrari",
      "Esposito",
      "Bianchi",
      "Romano",
      "Colombo",
      "Ricci",
      "Marino",
      "Greco",
      "Bruno",
      "Gallo",
    ],
  },
  pt: {
    first: [
      "Inês",
      "Beatriz",
      "Mariana",
      "Matilde",
      "João",
      "Tiago",
      "Rui",
      "Diogo",
      "Catarina",
      "Duarte",
    ],
    last: [
      "Silva",
      "Santos",
      "Ferreira",
      "Pereira",
      "Oliveira",
      "Costa",
      "Rodrigues",
      "Martins",
      "Sousa",
      "Fernandes",
    ],
  },
  br: {
    first: [
      "Camila",
      "Juliana",
      "Fernanda",
      "Larissa",
      "Gabriel",
      "Rafael",
      "Thiago",
      "Bruno",
      "Beatriz",
      "Mateus",
    ],
    last: [
      "Souza",
      "Lima",
      "Alves",
      "Ribeiro",
      "Carvalho",
      "Gomes",
      "Barbosa",
      "Araújo",
      "Cardoso",
      "Nascimento",
    ],
  },
  nl: {
    first: [
      "Sanne",
      "Lotte",
      "Fleur",
      "Eva",
      "Daan",
      "Bram",
      "Sem",
      "Thijs",
      "Lieke",
      "Joris",
    ],
    last: [
      "de Vries",
      "Jansen",
      "van Dijk",
      "Bakker",
      "Visser",
      "Smit",
      "Meijer",
      "de Boer",
      "Mulder",
      "Bos",
    ],
  },
};

type TopicProfile = {
  fr: { headlines: readonly string[]; contents: readonly string[] };
  en: { headlines: readonly string[]; contents: readonly string[] };
  networks: readonly (readonly [string, number])[];
  tones: readonly string[];
  words: readonly string[];
  femaleShare: readonly [number, number];
  ageBias: "young" | "mid" | "mature";
  adjacent: readonly string[];
};

const TOPICS: Record<string, TopicProfile> = {
  automotive: {
    fr: {
      headlines: [
        "Essais auto, mécanique accessible et road trips : la route racontée simplement",
        "Passionné de voitures anciennes et d'électrique : essais, entretien et conseils d'achat",
        "L'automobile sans jargon : essais, comparatifs et vie à bord au quotidien",
      ],
      contents: [
        "Je filme des essais complets, de la prise en main aux consommations réelles, sans langue de bois.",
        "J'explique l'entretien et l'achat d'occasion avec des exemples concrets et des chiffres vérifiés.",
        "Mes vidéos longues sur YouTube complètent des reels courts pour les premières impressions.",
      ],
    },
    en: {
      headlines: [
        "Car reviews, practical mechanics and road trips told without the jargon",
        "Classic cars and EVs: honest reviews, ownership costs and buying advice",
        "Everyday motoring made simple: test drives, comparisons and life behind the wheel",
      ],
      contents: [
        "I film complete test drives, from first impressions to real-world consumption, with no spin.",
        "I explain maintenance and used-car buying with concrete examples and checked figures.",
        "Long-form YouTube videos are backed by short reels for first impressions.",
      ],
    },
    networks: [
      ["youtube", 40],
      ["instagram", 30],
      ["tiktok", 25],
      ["facebook", 5],
    ],
    tones: ["expert", "straightforward"],
    words: ["auto", "drive", "garage", "roadtrip"],
    femaleShare: [8, 25],
    ageBias: "mid",
    adjacent: ["tech", "travel"],
  },
  beauty: {
    fr: {
      headlines: [
        "Routines peau et maquillage réalistes, sans filtre et pour tous les budgets",
        "Beauté clean, soin de la peau et astuces maquillage testés au quotidien",
        "Cheveux, peau, ongles : des routines simples et des avis honnêtes sur les produits",
      ],
      contents: [
        "Je teste chaque produit plusieurs semaines avant d'en parler, et je montre aussi ce qui ne marche pas.",
        "Mes tutoriels pas à pas sont pensés pour les peaux sensibles et les débutantes.",
        "J'aime les formats avant/après et les comparatifs de textures en gros plan.",
      ],
    },
    en: {
      headlines: [
        "Realistic skincare and makeup routines, unfiltered and for every budget",
        "Clean beauty, skincare and everyday makeup tips, tested for weeks before I post",
        "Hair, skin and nails: simple routines and honest product opinions",
      ],
      contents: [
        "I test each product for several weeks before talking about it, and I show what doesn't work too.",
        "My step-by-step tutorials are designed for sensitive skin and beginners.",
        "I love before/after formats and close-up texture comparisons.",
      ],
    },
    networks: [
      ["instagram", 45],
      ["tiktok", 35],
      ["youtube", 15],
      ["pinterest", 5],
    ],
    tones: ["inspiring", "premium"],
    words: ["beauty", "glow", "skin", "makeup"],
    femaleShare: [75, 92],
    ageBias: "young",
    adjacent: ["fashion", "wellness"],
  },
  business_finance: {
    fr: {
      headlines: [
        "Entrepreneuriat, finances personnelles et productivité expliqués pas à pas",
        "Je décrypte la finance perso et l'entrepreneuriat avec des exemples chiffrés",
        "Indépendants et PME : outils, organisation et retours d'expérience concrets",
      ],
      contents: [
        "Je publie des études de cas chiffrées et des comparatifs d'outils que j'utilise réellement.",
        "Mes carrousels LinkedIn résument une idée par publication, avec les sources en commentaire.",
        "Je tiens à rester pédagogue : aucun conseil d'investissement, uniquement de l'éducation financière.",
      ],
    },
    en: {
      headlines: [
        "Entrepreneurship, personal finance and productivity explained step by step",
        "Making sense of money and business with real numbers and real examples",
        "Freelancers and small teams: tools, workflows and lessons learned the hard way",
      ],
      contents: [
        "I publish numbered case studies and comparisons of tools I actually use.",
        "My LinkedIn carousels sum up one idea per post, with sources in the comments.",
        "I stay educational: no investment advice, only financial literacy.",
      ],
    },
    networks: [
      ["linkedin", 40],
      ["youtube", 25],
      ["instagram", 20],
      ["x", 10],
      ["threads", 5],
    ],
    tones: ["educational", "expert"],
    words: ["business", "money", "startup", "work"],
    femaleShare: [30, 55],
    ageBias: "mature",
    adjacent: ["tech", "education"],
  },
  culture: {
    fr: {
      headlines: [
        "Expos, livres et patrimoine : la culture racontée autrement, à hauteur de visiteur",
        "Guide culturel : musées, expositions et idées de sorties à petit prix",
        "Je rends l'art et l'histoire accessibles en quelques minutes de vidéo",
      ],
      contents: [
        "Je visite les expositions du moment et je raconte l'essentiel en moins d'une minute.",
        "Mes carrousels résument une œuvre ou un lieu avec un angle inattendu.",
        "Je travaille régulièrement avec des institutions culturelles et des librairies indépendantes.",
      ],
    },
    en: {
      headlines: [
        "Exhibitions, books and heritage: culture told from the visitor's side",
        "Cultural guide: museums, shows and affordable ideas for days out",
        "Making art and history accessible in a few minutes of video",
      ],
      contents: [
        "I visit current exhibitions and tell you the essentials in under a minute.",
        "My carousels sum up a work or a place from an unexpected angle.",
        "I regularly work with cultural institutions and independent bookshops.",
      ],
    },
    networks: [
      ["instagram", 45],
      ["youtube", 25],
      ["tiktok", 20],
      ["threads", 10],
    ],
    tones: ["educational", "inspiring"],
    words: ["culture", "art", "museum", "book"],
    femaleShare: [50, 70],
    ageBias: "mid",
    adjacent: ["education", "travel"],
  },
  education: {
    fr: {
      headlines: [
        "Méthodes de travail, orientation et astuces d'étude pour étudiants et lycéens",
        "Apprendre mieux : mémorisation, organisation et outils numériques pour réviser",
        "Sciences et langues vulgarisées en vidéos courtes, claires et sourcées",
      ],
      contents: [
        "Je partage des méthodes testées avec mes propres élèves et étudiants, avec des fiches téléchargeables.",
        "Mes vidéos expliquent un concept en moins de deux minutes, avec des exemples du quotidien.",
        "J'accompagne des plateformes de formation et des éditeurs scolaires de façon transparente.",
      ],
    },
    en: {
      headlines: [
        "Study methods, careers advice and learning tips for students",
        "Learn better: memory, organisation and digital tools for revision",
        "Science and languages simplified in short, clear, sourced videos",
      ],
      contents: [
        "I share methods tested with my own students, with downloadable cheat sheets.",
        "My videos explain a concept in under two minutes, using everyday examples.",
        "I work with learning platforms and publishers in a transparent way.",
      ],
    },
    networks: [
      ["youtube", 35],
      ["tiktok", 30],
      ["instagram", 25],
      ["linkedin", 10],
    ],
    tones: ["educational", "expert"],
    words: ["learn", "study", "prof", "edu"],
    femaleShare: [45, 65],
    ageBias: "young",
    adjacent: ["tech", "culture"],
  },
  entertainment: {
    fr: {
      headlines: [
        "Séries, cinéma et sorties : mes coups de cœur et mes déceptions, sans spoil",
        "Humour, pop culture et bons plans sorties : le divertissement en format court",
        "Critiques ciné, soirées jeux et concerts : je raconte ce qui vaut le déplacement",
      ],
      contents: [
        "Je publie des critiques sans spoiler et des classements thématiques très partagés.",
        "Mes reels humoristiques parodient les petits travers du quotidien et de la pop culture.",
        "Je couvre aussi des festivals et des avant-premières sur invitation, toujours signalés comme tels.",
      ],
    },
    en: {
      headlines: [
        "Series, cinema and nights out: my favourites and let-downs, spoiler-free",
        "Comedy, pop culture and ideas for nights out in short formats",
        "Film reviews, game nights and gigs: what's actually worth leaving the house for",
      ],
      contents: [
        "I publish spoiler-free reviews and themed rankings that get shared a lot.",
        "My comedy reels poke fun at everyday habits and pop culture.",
        "I also cover festivals and press screenings by invitation, always labelled as such.",
      ],
    },
    networks: [
      ["tiktok", 40],
      ["instagram", 30],
      ["youtube", 20],
      ["x", 10],
    ],
    tones: ["humorous", "straightforward"],
    words: ["fun", "ciné", "show", "pop"],
    femaleShare: [40, 60],
    ageBias: "young",
    adjacent: ["music", "gaming"],
  },
  family: {
    fr: {
      headlines: [
        "Vie de famille, activités avec les enfants et organisation du quotidien",
        "Parentalité réaliste : idées d'activités, repas et sorties en famille",
        "Famille nombreuse, système D et bons plans pour des journées plus simples",
      ],
      contents: [
        "Je montre le quotidien tel qu'il est, avec des idées d'activités faciles à reproduire à la maison.",
        "Mes tests de produits pour enfants se font toujours avec les principaux concernés.",
        "Je ne publie jamais le visage des enfants sans l'accord de toute la famille.",
      ],
    },
    en: {
      headlines: [
        "Family life, activities with kids and organising the daily routine",
        "Realistic parenting: activity ideas, meals and days out as a family",
        "Busy family, clever hacks and tips for simpler days",
      ],
      contents: [
        "I show everyday life as it is, with activity ideas that are easy to repeat at home.",
        "I always test children's products with the people they are made for.",
        "I never publish children's faces without the whole family's agreement.",
      ],
    },
    networks: [
      ["instagram", 50],
      ["facebook", 20],
      ["tiktok", 20],
      ["pinterest", 10],
    ],
    tones: ["family_friendly", "inspiring"],
    words: ["family", "mum", "kids", "home"],
    femaleShare: [70, 90],
    ageBias: "mature",
    adjacent: ["food", "home"],
  },
  fashion: {
    fr: {
      headlines: [
        "Mode accessible, seconde main et looks de saison pour tous les jours",
        "Style, tendances et bons plans : s'habiller bien sans se ruiner",
        "Mode responsable : pièces durables, friperies et associations de tenues",
      ],
      contents: [
        "Je propose des looks complets avec les prix et les alternatives de seconde main.",
        "Mes try-on hauls montrent la vraie coupe sur plusieurs morphologies.",
        "Je privilégie les marques transparentes sur leur fabrication et leurs matières.",
      ],
    },
    en: {
      headlines: [
        "Affordable fashion, second-hand finds and seasonal looks for every day",
        "Style, trends and deals: dressing well without breaking the bank",
        "Responsible fashion: durable pieces, thrifting and outfit mixing",
      ],
      contents: [
        "I put together complete looks with prices and second-hand alternatives.",
        "My try-on hauls show the real fit on different body types.",
        "I favour brands that are transparent about how and where their clothes are made.",
      ],
    },
    networks: [
      ["instagram", 45],
      ["tiktok", 30],
      ["pinterest", 15],
      ["youtube", 10],
    ],
    tones: ["premium", "inspiring"],
    words: ["style", "outfit", "mode", "look"],
    femaleShare: [75, 92],
    ageBias: "young",
    adjacent: ["beauty", "travel"],
  },
  food: {
    fr: {
      headlines: [
        "Recettes de saison, simples et gourmandes, testées dans ma cuisine à {city}",
        "Cuisine du quotidien : recettes rapides, produits locaux et bonnes adresses",
        "Pâtisserie maison et brunchs : des idées faciles à refaire chez soi",
      ],
      contents: [
        "Je publie des recettes pas à pas, filmées en lumière naturelle, avec des produits de saison.",
        "Mes formats préférés : le reel de 30 secondes et le carrousel de la recette complète.",
        "J'aime tester du matériel de cuisine, des épiceries fines et des box repas, toujours de façon transparente.",
      ],
    },
    en: {
      headlines: [
        "Seasonal recipes, simple and delicious, tested in my kitchen in {city}",
        "Everyday cooking: quick recipes, local produce and good places to eat",
        "Home baking and brunch ideas that are easy to recreate at home",
      ],
      contents: [
        "I post step-by-step recipes, shot in natural light, using seasonal ingredients.",
        "My favourite formats are the 30-second reel and the full-recipe carousel.",
        "I enjoy testing cookware, speciality grocers and meal boxes, always transparently.",
      ],
    },
    networks: [
      ["instagram", 45],
      ["tiktok", 30],
      ["youtube", 15],
      ["pinterest", 10],
    ],
    tones: ["inspiring", "family_friendly"],
    words: ["cuisine", "food", "recipe", "gourmand"],
    femaleShare: [60, 80],
    ageBias: "mid",
    adjacent: ["wellness", "family"],
  },
  gaming: {
    fr: {
      headlines: [
        "Streams, tests de jeux et culture gaming : on joue, on rit, on débat",
        "Jeux indés, e-sport et setups : le gaming sans prise de tête",
        "Lives quotidiens, découvertes indé et conseils matériel pour les joueurs",
      ],
      contents: [
        "Je streame plusieurs fois par semaine et je découpe les meilleurs moments en vidéos courtes.",
        "Je teste des jeux, des périphériques et des setups avec des avis détaillés.",
        "Ma communauté est très active en direct, ce qui rend les partenariats réellement interactifs.",
      ],
    },
    en: {
      headlines: [
        "Streams, game reviews and gaming culture: we play, laugh and debate",
        "Indie games, esports and setups: gaming without the fuss",
        "Daily lives, indie discoveries and hardware advice for players",
      ],
      contents: [
        "I stream several times a week and cut the best moments into short videos.",
        "I test games, peripherals and setups with detailed opinions.",
        "My community is very active live, which makes sponsorships genuinely interactive.",
      ],
    },
    networks: [
      ["twitch", 35],
      ["youtube", 30],
      ["tiktok", 25],
      ["x", 10],
    ],
    tones: ["humorous", "straightforward"],
    words: ["play", "gamer", "stream", "pixel"],
    femaleShare: [12, 35],
    ageBias: "young",
    adjacent: ["tech", "entertainment"],
  },
  home: {
    fr: {
      headlines: [
        "Déco, rénovation et DIY : transformer son intérieur sans gros budget",
        "Maison et jardin : idées déco, plantes d'intérieur et astuces rangement",
        "Rénovation d'un appartement ancien : avant/après, budgets et erreurs à éviter",
      ],
      contents: [
        "Je documente mes travaux de bout en bout, avec les budgets réels et les erreurs à ne pas reproduire.",
        "Mes tutoriels DIY se font avec du matériel accessible en magasin de bricolage.",
        "J'aime les formats avant/après et les visites guidées de pièces.",
      ],
    },
    en: {
      headlines: [
        "Decor, renovation and DIY: transforming your home on a small budget",
        "Home and garden: decor ideas, houseplants and storage tips",
        "Renovating an old flat: before/afters, real budgets and mistakes to avoid",
      ],
      contents: [
        "I document my renovations from start to finish, with real budgets and the mistakes to avoid.",
        "My DIY tutorials use materials available in any hardware store.",
        "I love before/after formats and guided room tours.",
      ],
    },
    networks: [
      ["instagram", 40],
      ["pinterest", 25],
      ["youtube", 20],
      ["tiktok", 15],
    ],
    tones: ["inspiring", "educational"],
    words: ["home", "deco", "diy", "maison"],
    femaleShare: [60, 80],
    ageBias: "mid",
    adjacent: ["family", "food"],
  },
  music: {
    fr: {
      headlines: [
        "Musicien, reprises et conseils de pratique : la musique à portée de tous",
        "Guitare, home studio et découvertes : je partage ma musique et mes bons plans",
        "Playlists, concerts et coulisses : la scène musicale vue de l'intérieur",
      ],
      contents: [
        "Je publie des reprises, des tutoriels de jeu et des tests de matériel d'enregistrement.",
        "Mes lives acoustiques réunissent une communauté fidèle, très engagée en commentaires.",
        "J'aime collaborer avec des marques d'instruments, de casques et de services de streaming.",
      ],
    },
    en: {
      headlines: [
        "Musician, covers and practice tips: making music accessible to everyone",
        "Guitar, home studio and discoveries: sharing my music and my best finds",
        "Playlists, gigs and behind the scenes: the music scene from the inside",
      ],
      contents: [
        "I post covers, playing tutorials and recording gear tests.",
        "My acoustic lives gather a loyal community that comments a lot.",
        "I love working with instrument, headphone and streaming brands.",
      ],
    },
    networks: [
      ["tiktok", 35],
      ["instagram", 30],
      ["youtube", 30],
      ["twitch", 5],
    ],
    tones: ["inspiring", "humorous"],
    words: ["music", "guitar", "sound", "live"],
    femaleShare: [30, 55],
    ageBias: "young",
    adjacent: ["entertainment", "culture"],
  },
  pets: {
    fr: {
      headlines: [
        "Chiens, chats et NAC : conseils d'éducation, santé et quotidien avec nos compagnons",
        "La vie avec mon chien et mes deux chats : éducation positive et bons produits",
        "Adoption, soins et accessoires : tout pour des animaux heureux au quotidien",
      ],
      contents: [
        "Je partage des conseils d'éducation positive validés avec un comportementaliste.",
        "Je teste croquettes, jouets et accessoires avec mes propres animaux, toujours avec transparence.",
        "Mes vidéos d'adoption ont aidé plusieurs refuges locaux à placer leurs pensionnaires.",
      ],
    },
    en: {
      headlines: [
        "Dogs, cats and small pets: training, health and daily life with our companions",
        "Life with my dog and two cats: positive training and products worth buying",
        "Adoption, care and accessories: everything for happy pets, every day",
      ],
      contents: [
        "I share positive-training advice checked with a certified behaviourist.",
        "I test food, toys and accessories with my own pets, always transparently.",
        "My adoption videos have helped several local shelters rehome their animals.",
      ],
    },
    networks: [
      ["instagram", 45],
      ["tiktok", 35],
      ["youtube", 15],
      ["facebook", 5],
    ],
    tones: ["family_friendly", "humorous"],
    words: ["pets", "paws", "dog", "chat"],
    femaleShare: [65, 85],
    ageBias: "mid",
    adjacent: ["family", "wellness"],
  },
  sport_fitness: {
    fr: {
      headlines: [
        "Running, musculation et récupération : s'entraîner mieux, à tout niveau",
        "Coach sportif : programmes accessibles, nutrition simple et motivation au quotidien",
        "Du canapé au premier semi-marathon : mon parcours et mes conseils d'entraînement",
      ],
      contents: [
        "Je publie des séances à faire chez soi ou en salle, avec des variantes pour chaque niveau.",
        "Je teste vêtements, montres et compléments avec un regard critique et des retours chiffrés.",
        "Mes défis communautaires mensuels fédèrent plusieurs milliers de participants.",
      ],
    },
    en: {
      headlines: [
        "Running, strength and recovery: training better, at every level",
        "Fitness coach: accessible programmes, simple nutrition and daily motivation",
        "From the sofa to a first half-marathon: my journey and training tips",
      ],
      contents: [
        "I post workouts to do at home or in the gym, with variations for each level.",
        "I test clothing, watches and supplements with a critical eye and measured feedback.",
        "My monthly community challenges bring together thousands of participants.",
      ],
    },
    networks: [
      ["instagram", 40],
      ["tiktok", 30],
      ["youtube", 25],
      ["x", 5],
    ],
    tones: ["inspiring", "educational"],
    words: ["fit", "run", "sport", "coach"],
    femaleShare: [40, 65],
    ageBias: "mid",
    adjacent: ["wellness", "food"],
  },
  tech: {
    fr: {
      headlines: [
        "Tests de smartphones, ordinateurs et objets connectés, sans jargon ni langue de bois",
        "High-tech au quotidien : tests, comparatifs et astuces pour mieux utiliser ses appareils",
        "Gadgets, logiciels et IA : je teste et je vous dis honnêtement ce qui vaut le coup",
      ],
      contents: [
        "Je teste chaque appareil au moins deux semaines avant de publier mon avis détaillé.",
        "Mes comparatifs incluent toujours une alternative moins chère et un point faible assumé.",
        "Je travaille avec des constructeurs et des boutiques en ligne, en précisant systématiquement les dotations.",
      ],
    },
    en: {
      headlines: [
        "Smartphone, laptop and smart-home reviews, with no jargon and no spin",
        "Everyday tech: reviews, comparisons and tips to get more from your devices",
        "Gadgets, software and AI: I test them and tell you honestly what's worth it",
      ],
      contents: [
        "I test every device for at least two weeks before publishing a detailed opinion.",
        "My comparisons always include a cheaper alternative and an honest weak point.",
        "I work with manufacturers and online shops, always disclosing what I was given.",
      ],
    },
    networks: [
      ["youtube", 40],
      ["tiktok", 25],
      ["instagram", 20],
      ["x", 10],
      ["threads", 5],
    ],
    tones: ["expert", "educational"],
    words: ["tech", "gadget", "digital", "geek"],
    femaleShare: [15, 40],
    ageBias: "mid",
    adjacent: ["gaming", "business_finance"],
  },
  travel: {
    fr: {
      headlines: [
        "Voyages, week-ends et bons plans : explorer le monde avec un budget raisonnable",
        "Carnets de voyage, itinéraires détaillés et adresses testées sur place",
        "Slow travel et road trips : partir autrement, à plusieurs ou en solo",
      ],
      contents: [
        "Je publie des itinéraires jour par jour, avec les budgets réels et les adresses que je recommande.",
        "Mes vidéos montrent aussi les galères et les imprévus, pour des voyages crédibles.",
        "Je collabore avec des offices de tourisme, des hébergements et des compagnies ferroviaires.",
      ],
    },
    en: {
      headlines: [
        "Travel, weekend breaks and deals: exploring the world on a sensible budget",
        "Travel diaries, detailed itineraries and places tested on the spot",
        "Slow travel and road trips: going away differently, with friends or solo",
      ],
      contents: [
        "I publish day-by-day itineraries with real budgets and the places I actually recommend.",
        "My videos show the mishaps and surprises too, for believable trips.",
        "I collaborate with tourist boards, accommodations and rail operators.",
      ],
    },
    networks: [
      ["instagram", 45],
      ["youtube", 25],
      ["tiktok", 25],
      ["pinterest", 5],
    ],
    tones: ["inspiring", "premium"],
    words: ["travel", "trip", "wander", "voyage"],
    femaleShare: [55, 75],
    ageBias: "mid",
    adjacent: ["food", "culture"],
  },
  wellness: {
    fr: {
      headlines: [
        "Bien-être, sommeil et équilibre : des habitudes simples pour aller mieux",
        "Yoga, méditation et alimentation douce : prendre soin de soi sans pression",
        "Santé mentale et routines du quotidien : un cocon de conseils bienveillants",
      ],
      contents: [
        "Je partage des routines de matin et de soir faciles à tenir, sans promesses miracle.",
        "Mes sessions de yoga et de respiration sont adaptées aux débutants.",
        "Je ne fais jamais d'allégation de santé : je renvoie vers les professionnels pour tout avis médical.",
      ],
    },
    en: {
      headlines: [
        "Wellbeing, sleep and balance: simple habits to feel better",
        "Yoga, meditation and gentle eating: looking after yourself without pressure",
        "Mental health and daily routines: a cosy corner of kind advice",
      ],
      contents: [
        "I share morning and evening routines that are easy to stick to, with no miracle promises.",
        "My yoga and breathing sessions are suitable for beginners.",
        "I never make health claims: I point to professionals for any medical advice.",
      ],
    },
    networks: [
      ["instagram", 50],
      ["tiktok", 25],
      ["youtube", 20],
      ["pinterest", 5],
    ],
    tones: ["inspiring", "educational"],
    words: ["zen", "wellness", "calm", "balance"],
    femaleShare: [70, 90],
    ageBias: "mid",
    adjacent: ["sport_fitness", "food"],
  },
};

const INTROS = {
  fr: [
    "J'habite à {city} et je crée du contenu depuis {years} ans.",
    "Depuis {years} ans, je partage mes découvertes depuis {city}.",
    "Créateur de contenu à {city}, je publie régulièrement depuis {years} ans.",
  ],
  en: [
    "I live in {city} and have been creating content for {years} years.",
    "For {years} years I have been sharing what I discover from {city}.",
    "I'm a content creator based in {city}, posting regularly for {years} years.",
  ],
} as const;
const CLOSERS = {
  fr: [
    "Je privilégie les collaborations où je peux rester sincère avec ma communauté.",
    "Je réponds aux propositions sous 48 h et je livre toujours dans les délais convenus.",
    "Les partenariats cohérents avec mon univers m'intéressent, en contenu organique comme en publicité.",
  ],
  en: [
    "I favour collaborations where I can stay honest with my community.",
    "I answer proposals within 48 hours and always deliver on the agreed dates.",
    "Partnerships that fit my world interest me, in organic content as well as ads.",
  ],
} as const;
const CAPTIONS = {
  fr: [
    "Shooting en lumière naturelle",
    "Un détail que j'aime beaucoup",
    "Dans les coulisses d'un tournage",
    "Mise en scène pour un reel",
    "Ambiance du week-end",
    "Une de mes photos préférées de la saison",
    "Préparation d'un contenu",
    "Test en conditions réelles",
    "Cadrage vertical pour les stories",
    "Inspiration du moment",
  ],
  en: [
    "Shot in natural light",
    "A detail I really like",
    "Behind the scenes of a shoot",
    "Set-up for a reel",
    "Weekend mood",
    "One of my favourite photos this season",
    "Preparing a piece of content",
    "Tested in real conditions",
    "Vertical framing for stories",
    "Inspiration of the moment",
  ],
} as const;

const NETWORK_URL: Record<string, (handle: string) => string> = {
  instagram: (h) => `https://www.instagram.com/${h}`,
  tiktok: (h) => `https://www.tiktok.com/@${h}`,
  youtube: (h) => `https://www.youtube.com/@${h}`,
  facebook: (h) => `https://www.facebook.com/${h}`,
  linkedin: (h) => `https://www.linkedin.com/in/${h}`,
  x: (h) => `https://x.com/${h}`,
  twitch: (h) => `https://www.twitch.tv/${h}`,
  pinterest: (h) => `https://www.pinterest.com/${h}`,
  threads: (h) => `https://www.threads.net/@${h}`,
  snapchat: (h) => `https://www.snapchat.com/add/${h}`,
};
const POSTS: Record<string, [number, number]> = {
  instagram: [8, 30],
  tiktok: [12, 45],
  youtube: [2, 10],
  twitch: [10, 40],
  linkedin: [4, 20],
  pinterest: [20, 90],
  facebook: [4, 20],
  x: [30, 120],
  threads: [10, 50],
  snapchat: [15, 60],
};
const FORMATS_BY_NETWORK: Record<string, readonly string[]> = {
  instagram: [
    "instagram_post",
    "instagram_reel",
    "instagram_story",
    "instagram_carousel",
    "instagram_live",
  ],
  tiktok: ["tiktok_video", "tiktok_carousel", "tiktok_live"],
  youtube: [
    "youtube_video",
    "youtube_short",
    "youtube_integration",
    "youtube_live",
  ],
  facebook: ["facebook_post", "facebook_reel", "facebook_story"],
  linkedin: ["linkedin_post"],
  twitch: ["twitch_live"],
  pinterest: ["pinterest_pin"],
  snapchat: ["snapchat_story", "snapchat_spotlight"],
  threads: ["threads_post"],
  x: ["x_post"],
};
const REFUSABLE_SECTORS = [
  "adult",
  "alcohol",
  "gambling",
  "cbd",
  "crypto",
  "finance",
  "real_estate",
  "health",
] as const;

type Tier = "nano" | "micro" | "mid" | "macro" | "mega";
const TIER_FOLLOWERS: Record<Tier, [number, number]> = {
  nano: [1_200, 9_800],
  micro: [10_500, 48_000],
  mid: [52_000, 480_000],
  macro: [520_000, 950_000],
  mega: [1_100_000, 5_500_000],
};
const TIER_COMMENT_RATE: Record<Tier, [number, number]> = {
  nano: [0.012, 0.03],
  micro: [0.006, 0.015],
  mid: [0.002, 0.008],
  macro: [0.0008, 0.003],
  mega: [0.0003, 0.0015],
};
const TIER_REACH: Record<Tier, [number, number]> = {
  nano: [35, 75],
  micro: [25, 60],
  mid: [15, 40],
  macro: [10, 30],
  mega: [6, 20],
};
const TIER_ENGAGEMENT_BP: Record<Tier, [number, number]> = {
  nano: [500, 1100],
  micro: [300, 800],
  mid: [150, 500],
  macro: [100, 300],
  mega: [50, 200],
};

/** n whole shares of at least `min`, never summing past `budget`. */
function otherShares(rng: Rng, budget: number, maxCount: number): number[] {
  const shares: number[] = [];
  let left = budget;
  while (shares.length < maxCount && left >= 10) {
    const share = int(rng, 10, Math.min(left, 25));
    shares.push(share);
    left -= share;
  }
  return shares;
}

function splitPercent(rng: Rng, weights: number[]): number[] {
  const raw = weights.map((weight) => weight * (0.7 + rng() * 0.6));
  const total = raw.reduce((sum, value) => sum + value, 0);
  const shares = raw.map((value) => Math.floor((value / total) * 100));
  shares[0] =
    (shares[0] ?? 0) + (100 - shares.reduce((sum, value) => sum + value, 0));
  return shares;
}

function buildLine(
  rng: Rng,
  input: {
    network: string;
    isPrimary: boolean;
    tier: Tier;
    followers: number;
    first: string;
    last: string;
    topic: string;
    topicProfile: TopicProfile;
    place: Place;
    usedHandles: Set<string>;
  },
): FakeLine {
  const { network, tier, followers, topicProfile, place } = input;
  const base = slug(input.first, "");
  const word = pick(rng, topicProfile.words);
  const patterns = [
    `${base}.${slug(word, "")}`,
    `${base}_${slug(word, "")}`,
    `${slug(word, "")}.by.${base}`,
    `${base}${slug(input.last, "")}`,
    `${base}.${slug(input.last, "")}.${slug(word, "")}`,
  ];
  let handle = pick(rng, patterns);
  for (
    let attempt = 0;
    input.usedHandles.has(`${network}:${handle}`);
    attempt += 1
  ) {
    handle = `${handle}${int(rng, 2, 99)}`;
    if (attempt > 20) {
      throw new Error("could not draw a free handle");
    }
  }
  input.usedHandles.add(`${network}:${handle}`);
  const [postMin, postMax] = POSTS[network] ?? [4, 20];
  const [rateMin, rateMax] = TIER_COMMENT_RATE[tier];
  const networkFactor =
    network === "youtube" ? 0.4 : network === "linkedin" ? 0.6 : 1;
  const avgComments = Math.max(
    3,
    Math.round(
      followers * (rateMin + rng() * (rateMax - rateMin)) * networkFactor,
    ),
  );
  const [reachMin, reachMax] = TIER_REACH[tier];
  const [engMin, engMax] = TIER_ENGAGEMENT_BP[tier];

  // audience: the main country first (slot 0), then up to three others of 10 % or more
  const main = weighted(rng, [
    [place.country, 80],
    [pick(rng, place.audienceCountries), 20],
  ] as const);
  const mainShare = int(rng, 52, 92);
  const others = otherShares(rng, 100 - mainShare, 3);
  const pool = place.audienceCountries.filter((code) => code !== main);
  const otherCodes = sample(
    rng,
    pool.length >= others.length
      ? pool
      : [...pool, "US", "GB", "FR"].filter((c) => c !== main),
    others.length,
  );
  const countries: FakeAudienceCountry[] = [
    { slot: 0, code: main, share: mainShare },
  ];
  others.forEach((share, offset) => {
    const code = otherCodes[offset];
    if (code !== undefined && !countries.some((entry) => entry.code === code)) {
      countries.push({ slot: countries.length, code, share });
    }
  });

  const ageWeights =
    topicProfile.ageBias === "young"
      ? [38, 36, 16, 10]
      : topicProfile.ageBias === "mature"
        ? [8, 30, 34, 28]
        : [20, 38, 26, 16];
  const ageShares = splitPercent(rng, ageWeights);
  const ages = ["18_24", "25_34", "35_44", "45_plus"].map((code, offset) => ({
    code,
    share: ageShares[offset] ?? 0,
  }));

  const [femaleMin, femaleMax] = topicProfile.femaleShare;
  const other = int(rng, 0, 3);
  const female = Math.min(100 - other, int(rng, femaleMin, femaleMax));
  const genders = [
    { code: "female", share: female },
    { code: "male", share: 100 - other - female },
    ...(other > 0 ? [{ code: "other", share: other }] : []),
  ];

  return {
    network,
    isPrimary: input.isPrimary,
    handle,
    pseudonym:
      rng() * 100 < 35
        ? `${input.first} ${pick(rng, topicProfile.words)}`.slice(0, 60)
        : null,
    profileUrl: (
      NETWORK_URL[network] ?? (NETWORK_URL.instagram as (h: string) => string)
    )(handle),
    followers,
    postsLast30Days: int(rng, postMin, postMax),
    avgComments,
    avgReach: Math.round(
      (followers * (reachMin + rng() * (reachMax - reachMin))) / 100,
    ),
    engagementBp: int(rng, engMin, engMax),
    countries,
    ages,
    genders,
  };
}

export function generateCreators(count: number, seed: number): FakeCreator[] {
  const rng = createRng(seed);
  const topics = Object.keys(TOPICS);
  const usedEmails = new Set<string>();
  const usedNames = new Set<string>();
  const usedHandles = new Set<string>();
  const creators: FakeCreator[] = [];

  for (let index = 0; index < count; index += 1) {
    const place = weighted(
      rng,
      PLACES.map((p) => [p, p.weight] as const),
    );
    const names = NAMES[place.nameSet];
    let first: string;
    let last: string;
    do {
      first = pick(rng, names.first);
      last = pick(rng, names.last);
    } while (usedNames.has(`${first} ${last}`));
    usedNames.add(`${first} ${last}`);
    let local = `${slug(first)}.${slug(last)}`;
    while (usedEmails.has(local)) {
      local = `${local}${int(rng, 2, 99)}`;
    }
    usedEmails.add(local);

    const city = pick(rng, place.cities);
    // TOPIC_COUNT topics, the most common first: food, travel, fashion, fitness sell the most
    const primaryTopic = pick(rng, [
      ...topics,
      "food",
      "travel",
      "fashion",
      "sport_fitness",
      "beauty",
      "tech",
    ]);
    const topicProfile = TOPICS[primaryTopic] as TopicProfile;
    const language = place.language;
    const years = int(rng, 2, 9);
    const text = topicProfile[language];
    const fill = (template: string) =>
      template
        .replaceAll("{city}", city.name)
        .replaceAll("{years}", String(years));
    const headline = fill(pick(rng, text.headlines));
    const contents = sample(rng, text.contents, 2);
    const bio = [
      fill(pick(rng, INTROS[language])),
      ...contents,
      pick(rng, CLOSERS[language]),
    ].join(" ");
    if (
      headline.length < 20 ||
      headline.length > 120 ||
      bio.length < 150 ||
      bio.length > 800
    ) {
      throw new Error(
        `creator ${index}: headline ${headline.length} / bio ${bio.length} out of bounds`,
      );
    }

    const tier = weighted<Tier>(rng, [
      ["nano", 33],
      ["micro", 36],
      ["mid", 20],
      ["macro", 7],
      ["mega", 4],
    ]);
    const [fMin, fMax] = TIER_FOLLOWERS[tier];
    const primaryNetwork = weighted(rng, topicProfile.networks);
    const lineCount = weighted(rng, [
      [1, 45],
      [2, 40],
      [3, 15],
    ] as const);
    const otherNetworks = sample(
      rng,
      Object.keys(NETWORK_URL).filter(
        (n) => n !== primaryNetwork && n !== "snapchat",
      ),
      lineCount - 1,
    );
    const lines: FakeLine[] = [primaryNetwork, ...otherNetworks].map(
      (network, offset) => {
        const followers =
          offset === 0
            ? logUniform(rng, fMin, fMax)
            : Math.max(
                900,
                Math.round(logUniform(rng, fMin, fMax) * (0.12 + rng() * 0.6)),
              );
        const lineTier: Tier =
          followers >= 1_000_000
            ? "mega"
            : followers >= 500_000
              ? "macro"
              : followers >= 50_000
                ? "mid"
                : followers >= 10_000
                  ? "micro"
                  : "nano";
        return buildLine(rng, {
          network,
          isPrimary: offset === 0,
          tier: lineTier,
          followers,
          first,
          last,
          topic: primaryTopic,
          topicProfile,
          place,
          usedHandles,
        });
      },
    );

    const formats = new Set<string>();
    for (const line of lines) {
      for (const format of sample(
        rng,
        FORMATS_BY_NETWORK[line.network] ?? [],
        int(rng, 1, 3),
      )) {
        formats.add(format);
      }
    }
    if (rng() < 0.3) {
      formats.add(pick(rng, ["ugc_photo", "ugc_video"]));
    }

    const secondaryTopics = sample(
      rng,
      [...topicProfile.adjacent, ...topics.filter((t) => t !== primaryTopic)],
      int(rng, 0, 2),
    );
    const portfolioCount = weighted(rng, [
      [3, 15],
      [4, 25],
      [5, 25],
      [6, 20],
      [7, 10],
      [8, 5],
    ] as const);
    const portfolioTopics = Array.from({ length: portfolioCount }, () =>
      rng() < 0.6
        ? primaryTopic
        : pick(rng, [
            ...secondaryTopics,
            ...topicProfile.adjacent,
            "travel",
            "food",
            "home",
            "tech",
          ]),
    );

    creators.push({
      index,
      email: `${local}@cadaero.ovh`,
      firstName: first,
      lastName: last,
      language,
      timezone: city.timezone,
      country: place.country,
      region: city.region,
      city: city.name,
      postalCode: city.postal(),
      addressLine: `${int(rng, 1, 148)} ${pick(rng, place.street)}`,
      phone: place.phone(rng),
      heardFrom: pick(rng, [
        "online_search",
        "social_media",
        "word_of_mouth",
        "event",
        "other",
      ] as const),
      headline,
      bio,
      primaryTopic,
      secondaryTopics,
      publicationLanguages: [...place.publicationLanguages],
      tones: sample(rng, topicProfile.tones, int(rng, 1, 2)),
      formats: [...formats],
      usageRights: [
        ...(rng() < 0.7
          ? [{ code: "organic_repost", inclusion: "included" as const }]
          : []),
        ...(rng() < 0.5
          ? [{ code: "paid_whitelisting", inclusion: "optional" as const }]
          : []),
        ...(rng() < 0.25
          ? [{ code: "media_buy", inclusion: "optional" as const }]
          : []),
      ],
      refusedSectors: sample(
        rng,
        REFUSABLE_SECTORS,
        weighted(rng, [
          [0, 40],
          [1, 30],
          [2, 20],
          [3, 10],
        ] as const),
      ),
      travelScope: weighted(rng, [
        ["none", 25],
        ["domestic", 45],
        ["international", 30],
      ] as const),
      collaborationExperienceBand: weighted(
        rng,
        tier === "nano"
          ? ([
              ["none", 35],
              ["1_5", 50],
              ["6_20", 15],
            ] as const)
          : ([
              ["1_5", 25],
              ["6_20", 45],
              ["gt_20", 30],
            ] as const),
      ),
      deliveryLeadBand: weighted(rng, [
        ["lt_7d", 20],
        ["7_14d", 45],
        ["15_30d", 28],
        ["gt_30d", 7],
      ] as const),
      maxExclusivityBand: weighted(rng, [
        ["none", 30],
        ["le_1m", 30],
        ["le_3m", 25],
        ["negotiable", 15],
      ] as const),
      acceptsNonMonetary:
        rng() < (tier === "nano" ? 0.6 : tier === "micro" ? 0.3 : 0.1),
      availabilityBand: weighted(rng, [
        ["full", 50],
        ["lt_1m", 30],
        ["lt_2w", 20],
      ] as const),
      lines,
      publishedDaysAgo: int(rng, 1, 60),
      portfolioCount,
      portfolioTopics,
      captions: portfolioTopics.map(() =>
        rng() < 0.5 ? pick(rng, CAPTIONS[language]) : null,
      ),
    });
  }
  return creators;
}
