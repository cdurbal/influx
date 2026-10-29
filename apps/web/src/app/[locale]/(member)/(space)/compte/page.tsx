import type { Metadata } from "next";
import {
  memberPageLocale,
  memberPageMetadata,
} from "@/components/auth/AuthPage";
import { AccountPageView } from "@/components/account/AccountPageView";

// "Mes informations" (docs/mvp/17 §6; §2.6), French path, behind the session.
export async function generateMetadata({
  params,
}: PageProps<"/[locale]/compte">): Promise<Metadata> {
  const { locale } = await params;
  return memberPageMetadata(locale, "accountDetails");
}

export default async function AccountDetailsPage({
  params,
}: PageProps<"/[locale]/compte">) {
  const { locale } = await params;
  memberPageLocale(locale, "accountDetails", "compte");
  return <AccountPageView page="accountDetails" />;
}
