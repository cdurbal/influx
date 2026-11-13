import { describe, expect, it } from "vitest";
import {
  CAMPAIGN_TEXT_WARNING_CODE,
  campaignTextKinds,
  detectCampaignText,
} from "../src/campaign/index.ts";

describe("L3B-T5 what a campaign text signals (09 RG21 to RG23, CA12 to CA14)", () => {
  it("CA12: signals an e-mail address as a direct contact", () => {
    const text =
      "Envoyez votre kit média à partenariats@marque.com avant lundi.";
    const [hit] = detectCampaignText(text);
    expect(detectCampaignText(text)).toHaveLength(1);
    expect(hit).toMatchObject({ kind: "contact", signal: "email" });
    expect(text.slice(hit?.start, hit?.end)).toBe("partenariats@marque.com");
  });

  it("signals a telephone number, a handle and a messenger as direct contacts (RG21)", () => {
    expect(campaignTextKinds("Appelez le 06 12 34 56 78")).toEqual(["contact"]);
    expect(campaignTextKinds("Écrivez-nous sur @marque_officiel")).toEqual([
      "contact",
    ]);
    expect(campaignTextKinds("Retrouvons-nous sur WhatsApp")).toEqual([
      "contact",
    ]);
  });

  it("CA13: signals a link as a link", () => {
    const text = "Le brief est ici https://marque.com/brief.pdf merci";
    const findings = detectCampaignText(text);
    expect(findings.map((hit) => hit.kind)).toContain("link");
    expect(findings.find((hit) => hit.kind === "link")?.signal).toBe("url");
    expect(campaignTextKinds(text)).toContain("link");
  });

  it("signals www and a bare domain, the first as a link, the second as a contact (RG21, RG22)", () => {
    expect(campaignTextKinds("voir www.marque.com")).toContain("link");
    expect(campaignTextKinds("voir marque.fr")).toEqual(["contact"]);
  });

  it("CA14: signals an amount with a symbol after, before, or with a thousands separator", () => {
    const text = "budget 500 € net pour vous";
    const [hit] = detectCampaignText(text);
    expect(detectCampaignText(text)).toHaveLength(1);
    expect(hit).toMatchObject({ kind: "amount", signal: "amount" });
    expect(text.slice(hit?.start, hit?.end)).toBe("500 €");
    expect(campaignTextKinds("€500 par contenu")).toEqual(["amount"]);
    expect(campaignTextKinds("$1,500 en tout")).toEqual(["amount"]);
    expect(campaignTextKinds("2k€ par reel")).toEqual(["amount"]);
    expect(campaignTextKinds("1 500£ HT")).toEqual(["amount"]);
  });

  it("signals an amount with an ISO 4217 code, either side (RG23)", () => {
    expect(campaignTextKinds("Cachet de 300 EUR")).toEqual(["amount"]);
    expect(campaignTextKinds("USD 250 le post")).toEqual(["amount"]);
    expect(campaignTextKinds("800CHF")).toEqual(["amount"]);
  });

  it("reads full-width digits and symbols, and reports positions in the typed text", () => {
    const text = "Offre ５０＄ ici";
    const [hit] = detectCampaignText(text);
    expect(hit).toMatchObject({ kind: "amount" });
    expect(text.slice(hit?.start, hit?.end)).toBe("５０＄");
  });

  it("does not signal a year, an age range, a quantity or a percentage", () => {
    expect(detectCampaignText("Campagne de l'été 2026")).toEqual([]);
    expect(detectCampaignText("Audience de 18-24 ans")).toEqual([]);
    expect(detectCampaignText("Trois formats : 3 reels et 2 stories")).toEqual(
      [],
    );
    expect(detectCampaignText("Taux d'engagement de 5 %")).toEqual([]);
    expect(detectCampaignText("TOP 10 des produits, CUP 2026")).toEqual([]);
  });

  it("does not signal a symbol or a code without a number beside it", () => {
    expect(detectCampaignText("Paiement en € ou en USD, à voir")).toEqual([]);
    expect(detectCampaignText("Les EUR et les contenus 2026")).toEqual([]);
  });

  it("returns every finding in the order of the text, kinds apart", () => {
    const text = "Ecrire à a@b.fr pour 300 € ou voir www.b.fr";
    expect(detectCampaignText(text).map((hit) => hit.kind)).toEqual([
      "contact",
      "amount",
      "link",
    ]);
    expect(campaignTextKinds(text)).toEqual(["contact", "link", "amount"]);
  });

  it("returns nothing for an empty or absent text, and never the matched text", () => {
    expect(detectCampaignText(null)).toEqual([]);
    expect(detectCampaignText(undefined)).toEqual([]);
    expect(detectCampaignText("  ")).toEqual([]);
    const [hit] = detectCampaignText("500 €");
    expect(Object.keys(hit ?? {}).sort()).toEqual([
      "end",
      "kind",
      "signal",
      "start",
    ]);
  });

  it("names the warning of each kind after 17 §4.3", () => {
    expect(CAMPAIGN_TEXT_WARNING_CODE).toEqual({
      contact: "contactInText",
      link: "linkInText",
      amount: "amountInText",
    });
  });
});
