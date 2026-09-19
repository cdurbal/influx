import {
  type Account,
  type TermsAcceptance,
  type ConsentEvent,
} from "@influx/contracts";
import { type MockStoreSnapshot } from "./mock-store";

export const SEED_IDS = {
  ADVERTISER_1: "11111111-1111-4111-8111-111111111111",
  ADVERTISER_2: "22222222-2222-4222-8222-222222222222",
  CREATOR_1: "33333333-3333-4333-8333-333333333333",
  CREATOR_2: "44444444-4444-4444-8444-444444444444",
  CREATOR_3: "55555555-5555-4555-8555-555555555555",
  AGENT_1: "88888888-8888-4888-8888-888888888888",
  ADMIN_1: "99999999-9999-4999-8999-999999999999",
  CAMPAIGN_1: "c1111111-1111-4111-8111-111111111111",
  CAMPAIGN_2: "c2222222-2222-4222-8222-222222222222",
} as const;

const now = new Date().toISOString();
const in90Days = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();

export const SEED_ACCOUNTS: Account[] = [
  {
    id: SEED_IDS.ADVERTISER_1,
    email: "contact@maisonsolene.fr",
    role: "advertiser",
    status: "active",
    preferredLanguage: "fr",
    countryCode: "FR",
    declaredStatus: "company",
    emailStatus: "verified",
    ownerAgentId: SEED_IDS.AGENT_1,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: SEED_IDS.ADVERTISER_2,
    email: "partenariats@techgear.fr",
    role: "advertiser",
    status: "active",
    preferredLanguage: "fr",
    countryCode: "FR",
    declaredStatus: "company",
    emailStatus: "verified",
    ownerAgentId: SEED_IDS.AGENT_1,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: SEED_IDS.CREATOR_1,
    email: "lucas@lucastech.fr",
    role: "creator",
    status: "active",
    preferredLanguage: "fr",
    countryCode: "FR",
    declaredStatus: "freelancer",
    emailStatus: "verified",
    ownerAgentId: SEED_IDS.AGENT_1,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: SEED_IDS.CREATOR_2,
    email: "sophie@lifestyle-mode.com",
    role: "creator",
    status: "active",
    preferredLanguage: "fr",
    countryCode: "FR",
    declaredStatus: "individual",
    emailStatus: "verified",
    createdAt: now,
    updatedAt: now,
  },
  {
    id: SEED_IDS.CREATOR_3,
    email: "maxime@outdoor-travel.com",
    role: "creator",
    status: "active",
    preferredLanguage: "fr",
    countryCode: "FR",
    declaredStatus: "freelancer",
    emailStatus: "verified",
    createdAt: now,
    updatedAt: now,
  },
  {
    id: SEED_IDS.AGENT_1,
    email: "alexandre@influx.io",
    role: "agent",
    status: "active",
    preferredLanguage: "fr",
    countryCode: "FR",
    declaredStatus: "internal",
    emailStatus: "verified",
    createdAt: now,
    updatedAt: now,
  },
  {
    id: SEED_IDS.ADMIN_1,
    email: "sarah.admin@influx.io",
    role: "admin",
    status: "active",
    preferredLanguage: "fr",
    countryCode: "FR",
    declaredStatus: "internal",
    emailStatus: "verified",
    createdAt: now,
    updatedAt: now,
  },
];

export const SEED_TERMS: TermsAcceptance[] = SEED_ACCOUNTS.map(
  (acc, index) => ({
    id: `terms-${index + 1}`,
    accountId: acc.id,
    termsVersion: "2026-09-18",
    acceptedAt: now,
    hasNonCircumventionAcknowledged: true,
  }),
);

export const SEED_CONSENTS: ConsentEvent[] = SEED_ACCOUNTS.map(
  (acc, index) => ({
    id: `consent-${index + 1}`,
    accountId: acc.id,
    marketingConsent: true,
    recordedAt: now,
  }),
);

export const SEED_BRAND_PROFILES = [
  {
    accountId: SEED_IDS.ADVERTISER_1,
    companyName: "Maison Solène",
    sector: "Cosmétiques & Beauté Bio",
    websiteUrl: "https://maisonsolene.fr",
    indicativeBudgetMinor: 500000,
    currency: "EUR",
    contactPerson: "Solène Dupont",
    contactEmail: "contact@maisonsolene.fr",
    contactPhone: "+33140203040",
    completenessPercent: 100,
  },
  {
    accountId: SEED_IDS.ADVERTISER_2,
    companyName: "TechGear France",
    sector: "High-Tech & Accessoires",
    websiteUrl: "https://techgear.fr",
    indicativeBudgetMinor: 1000000,
    currency: "EUR",
    contactPerson: "Thomas Bernard",
    contactEmail: "partenariats@techgear.fr",
    contactPhone: "+33478901234",
    completenessPercent: 90,
  },
];

export const SEED_CREATOR_PROFILES = [
  {
    accountId: SEED_IDS.CREATOR_1,
    anonymousTitle: "Créateur High-Tech & Hardware",
    topics: ["tech", "gaming"],
    networks: ["youtube", "instagram"],
    audienceBand: "50k-100k",
    engagementBand: "3-5%",
    primaryCountry: "FR",
    formats: ["video_dedicated", "short_video"],
    priceBand: "500-1000",
    badge: {
      level: 1,
      name: "Audience vérifiée",
      expiresAt: in90Days,
      verifiedAt: now,
    },
    // Identified fields (revealed only after approval)
    legalName: "Lucas Martinez",
    publicHandle: "@lucastech",
    channelUrl: "https://youtube.com/@lucastech",
    phone: "+33612345678",
  },
  {
    accountId: SEED_IDS.CREATOR_2,
    anonymousTitle: "Créatrice Mode Éthique & Lifestyle",
    topics: ["fashion", "lifestyle"],
    networks: ["instagram", "tiktok"],
    audienceBand: "10k-50k",
    engagementBand: "5-8%",
    primaryCountry: "FR",
    formats: ["story", "post"],
    priceBand: "200-500",
    badge: null,
    // Identified fields
    legalName: "Sophie Leroy",
    publicHandle: "@sophie_eco_chic",
    channelUrl: "https://instagram.com/sophie_eco_chic",
    phone: "+33698765432",
  },
  {
    accountId: SEED_IDS.CREATOR_3,
    anonymousTitle: "Créateur Voyage & Aventure",
    topics: ["travel", "photography"],
    networks: ["instagram", "youtube"],
    audienceBand: "100k-250k",
    engagementBand: "2-4%",
    primaryCountry: "FR",
    formats: ["video_dedicated", "short_video"],
    priceBand: "1000-2500",
    badge: {
      level: 2,
      name: "Audience vérifiée - Certifié",
      expiresAt: in90Days,
      verifiedAt: now,
    },
    // Identified fields
    legalName: "Maxime Dubois",
    publicHandle: "@maxime_outdoors",
    channelUrl: "https://instagram.com/maxime_outdoors",
    phone: "+33655443322",
  },
];

export const SEED_CAMPAIGNS = [
  {
    id: SEED_IDS.CAMPAIGN_1,
    advertiserAccountId: SEED_IDS.ADVERTISER_1,
    title: "Lancement Sérum Éco-Bio Printemps",
    description:
      "Campagne de mise en avant de notre nouveau sérum visage certifié bio. Formats dynamiques axés sur la routine matinale.",
    deliverables: ["2 Reels Instagram", "3 Stories avec lien swipe-up"],
    budgetBand: "1k-3k",
    budgetMinor: 200000,
    currency: "EUR",
    targetAudience: "Femmes 20-35 ans, France, affinité cosmétique bio",
    status: "published",
    createdAt: now,
  },
  {
    id: SEED_IDS.CAMPAIGN_2,
    advertiserAccountId: SEED_IDS.ADVERTISER_2,
    title: "Test Comparatif Chargeur GaN Ultra-Rapide",
    description:
      "Vidéo dédiée ou intégration détaillée testant la vitesse de charge et l encombrement réduit.",
    deliverables: ["1 Vidéo dédiée YouTube (8-12 min)"],
    budgetBand: "2k-5k",
    budgetMinor: 350000,
    currency: "EUR",
    targetAudience: "Passionnés tech, nomades digitaux, 18-40 ans",
    status: "published",
    createdAt: now,
  },
];

export const SEED_VERIFICATION_REQUESTS = [
  {
    id: "req-verif-1",
    creatorAccountId: SEED_IDS.CREATOR_2,
    submittedAt: now,
    network: "instagram",
    evidenceFileUrl:
      "https://placehold.co/800x600/png?text=Preuve+Statistiques+Instagram+Sophie",
    status: "pending_review",
  },
];

export function createInitialSnapshot(): MockStoreSnapshot {
  return {
    accounts: SEED_ACCOUNTS,
    termsAcceptances: SEED_TERMS,
    consentEvents: SEED_CONSENTS,
    brandProfiles: SEED_BRAND_PROFILES,
    creatorProfiles: SEED_CREATOR_PROFILES,
    campaigns: SEED_CAMPAIGNS,
    introductions: [],
    conversations: [],
    messages: [],
    deals: [],
    verificationRequests: SEED_VERIFICATION_REQUESTS,
    auditEvents: [],
    outboxEvents: [],
  };
}
