import type { Metadata } from "next";
import {
  memberPageLocale,
  memberPageMetadata,
} from "@/components/auth/AuthPage";
import { AppealScreen } from "@/components/verification/AppealScreen";
import { appealTargetOf } from "@/components/verification/appeal-page";

// "Contester une décision" (17 §5.3, C3; 08 RG77): the contest of ONE refusal or withdrawal of a creator,
// French path, behind the session; the decision is the query's. Any other role finds no such page.
export async function generateMetadata({
  params,
}: PageProps<"/[locale]/compte/profil/verification/contestation">): Promise<Metadata> {
  const { locale } = await params;
  return memberPageMetadata(locale, "accountVerificationAppeal");
}

export default async function AppealPage({
  params,
  searchParams,
}: PageProps<"/[locale]/compte/profil/verification/contestation">) {
  const { locale } = await params;
  memberPageLocale(
    locale,
    "accountVerificationAppeal",
    "compte/profil/verification/contestation",
  );
  return <AppealScreen target={appealTargetOf(await searchParams)} />;
}
