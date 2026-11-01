import type { Metadata } from "next";
import {
  memberPageLocale,
  memberPageMetadata,
} from "@/components/auth/AuthPage";
import { AccountHub } from "@/components/account/AccountHub";

// The page-menu of "mon compte" (docs/mvp/17 §6.0; D74), English path, behind the session.
export async function generateMetadata({
  params,
}: PageProps<"/[locale]/account">): Promise<Metadata> {
  const { locale } = await params;
  return memberPageMetadata(locale, "accountHub");
}

export default async function AccountHubPage({
  params,
}: PageProps<"/[locale]/account">) {
  const { locale } = await params;
  memberPageLocale(locale, "accountHub", "account");
  return <AccountHub />;
}
