import enLanding from "@/locales/en/landing.json";
import frLanding from "@/locales/fr/landing.json";
import type { AppLocale } from "./routing";

type FrLanding = typeof frLanding;
type EnLanding = typeof enLanding;

// Compile-time parity check (CA23): each file must be assignable to the type of the other one.
// A key missing or added on either side makes `pnpm typecheck` fail.
const enMatchesFr: FrLanding = enLanding;
const frMatchesEn: EnLanding = frLanding;

export type Messages = { landing: FrLanding };

export const MESSAGES: Record<AppLocale, Messages> = {
  fr: { landing: frMatchesEn },
  en: { landing: enMatchesFr },
};
