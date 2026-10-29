import type { Metadata } from "next";
import {
  memberPageLocale,
  memberPageMetadata,
} from "@/components/auth/AuthPage";
import { AccountPageView } from "@/components/account/AccountPageView";

// "Mes données" (docs/mvp/17 §6; §2.6), French path, behind the session.
export async function generateMetadata({
  params,
}: PageProps<"/[locale]/compte/donnees">): Promise<Metadata> {
  const { locale } = await params;
  return memberPageMetadata(locale, "accountData");
}

export default async function AccountDataPage({
  params,
}: PageProps<"/[locale]/compte/donnees">) {
  const { locale } = await params;
  memberPageLocale(locale, "accountData", "compte/donnees");
  return <AccountPageView page="accountData" />;
}
