import type { Metadata } from "next";
import {
  memberPageLocale,
  memberPageMetadata,
} from "@/components/auth/AuthPage";
import { AppealScreen } from "@/components/verification/AppealScreen";
import { appealTargetOf } from "@/components/verification/appeal-page";

// "Appeal a decision" (17 §5.3, C3; 08 RG77): the contest of ONE refusal or withdrawal of a creator,
// English path, behind the session; the decision is the query's. Any other role finds no such page.
export async function generateMetadata({
  params,
}: PageProps<"/[locale]/account/profile/verification/appeal">): Promise<Metadata> {
  const { locale } = await params;
  return memberPageMetadata(locale, "accountVerificationAppeal");
}

export default async function AppealPage({
  params,
  searchParams,
}: PageProps<"/[locale]/account/profile/verification/appeal">) {
  const { locale } = await params;
  memberPageLocale(
    locale,
    "accountVerificationAppeal",
    "account/profile/verification/appeal",
  );
  return <AppealScreen target={appealTargetOf(await searchParams)} />;
}
