import type { Metadata } from "next";
import {
  memberPageLocale,
  memberPageMetadata,
} from "@/components/auth/AuthPage";
import { AccountPageView } from "@/components/account/AccountPageView";

// "Mes sessions" (docs/mvp/17 §6; §2.6), French path, behind the session.
export async function generateMetadata({
  params,
}: PageProps<"/[locale]/compte/sessions">): Promise<Metadata> {
  const { locale } = await params;
  return memberPageMetadata(locale, "accountSessions");
}

export default async function AccountSessionsPage({
  params,
}: PageProps<"/[locale]/compte/sessions">) {
  const { locale } = await params;
  memberPageLocale(locale, "accountSessions", "compte/sessions");
  return <AccountPageView page="accountSessions" />;
}
