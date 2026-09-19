import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { AuthHeader } from "@/components/auth/AuthHeader";
import { MemberAuthFlow } from "@/components/auth/OtpCodeInput";
import { LinkButton } from "@/components/ui/LinkButton";
import { routing } from "@/i18n/routing";

export default async function SignUpCreatorPage({
  params,
}: PageProps<"/[locale]/signup/creator">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  setRequestLocale(locale);

  return (
    <>
      <AuthHeader />
      <main id="main" className="bg-surface-page">
        <div className="mx-auto flex max-w-(--container-narrow) flex-col gap-8 px-page-gutter py-section-block">
          <MemberAuthFlow mode="signup" profile="creator" locale={locale} />
          <p className="flex flex-wrap items-center justify-center gap-2 text-md text-text-secondary">
            {locale === "en"
              ? "Already have an account?"
              : "Vous avez déjà un compte ?"}
            <LinkButton href="/login" variant="text">
              {locale === "en" ? "Log in" : "Se connecter"}
            </LinkButton>
          </p>
        </div>
      </main>
    </>
  );
}
