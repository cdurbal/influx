import type { Metadata } from "next";
import {
  AuthMessages,
  memberPageLocale,
  memberPageMetadata,
} from "@/components/auth/AuthPage";
import { AccountPageView } from "@/components/account/AccountPageView";

// "Mes données" (docs/mvp/17 §6; §2.6), English path, behind the session.
export async function generateMetadata({
  params,
}: PageProps<"/[locale]/account/data">): Promise<Metadata> {
  const { locale } = await params;
  return memberPageMetadata(locale, "accountData");
}

export default async function AccountDataPage({
  params,
}: PageProps<"/[locale]/account/data">) {
  const { locale } = await params;
  const pageLocale = memberPageLocale(locale, "accountData", "account/data");
  return (
    <AuthMessages locale={pageLocale} withAccount>
      <AccountPageView page="accountData" />
    </AuthMessages>
  );
}
