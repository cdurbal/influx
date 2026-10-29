import type { Metadata } from "next";
import {
  memberPageLocale,
  memberPageMetadata,
} from "@/components/auth/AuthPage";
import { AccountPageView } from "@/components/account/AccountPageView";

// "Mes sessions" (docs/mvp/17 §6; §2.6), English path, behind the session.
export async function generateMetadata({
  params,
}: PageProps<"/[locale]/account/sessions">): Promise<Metadata> {
  const { locale } = await params;
  return memberPageMetadata(locale, "accountSessions");
}

export default async function AccountSessionsPage({
  params,
}: PageProps<"/[locale]/account/sessions">) {
  const { locale } = await params;
  memberPageLocale(locale, "accountSessions", "account/sessions");
  return <AccountPageView page="accountSessions" />;
}
