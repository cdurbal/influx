import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { AccountSignupPage } from "@/components/account/AccountSignupPage";
import { routing } from "@/i18n/routing";

export default async function SignUpCreatorPage({
  params,
}: PageProps<"/[locale]/signup/creator">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  setRequestLocale(locale);

  return <AccountSignupPage profile="creator" />;
}
