import type { Metadata } from "next";
import {
  AuthMessages,
  memberPageLocale,
  memberPageMetadata,
} from "@/components/auth/AuthPage";
import { AccountPageView } from "@/components/account/AccountPageView";

// "Mes informations" (docs/mvp/17 §6; §2.6), English path, behind the session.
export async function generateMetadata({
  params,
}: PageProps<"/[locale]/account">): Promise<Metadata> {
  const { locale } = await params;
  return memberPageMetadata(locale, "accountDetails");
}

export default async function AccountDetailsPage({
  params,
}: PageProps<"/[locale]/account">) {
  const { locale } = await params;
  const pageLocale = memberPageLocale(locale, "accountDetails", "account");
  return (
    <AuthMessages locale={pageLocale} withAccount>
      <AccountPageView page="accountDetails" />
    </AuthMessages>
  );
}
