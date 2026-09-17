import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { AuthHeader } from "@/components/auth/AuthHeader";
import { LoginForm, type LoginFormLabels } from "@/components/auth/LoginForm";
import { LinkButton } from "@/components/ui/LinkButton";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { routing } from "@/i18n/routing";

/** Mocked login page (docs/landing-page/00-cadrage.md §6): see components/auth/LoginForm.tsx. */
export default async function LoginPage({
  params,
}: PageProps<"/[locale]/login">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  setRequestLocale(locale);
  const t = await getTranslations("landing");

  const labels: LoginFormLabels = {
    requiredMark: t("startForm.requiredMark"),
    email: {
      label: t("auth.login.email.label"),
      errorRequired: t("auth.login.email.errors.required"),
      errorFormat: t("auth.login.email.errors.format"),
    },
    password: {
      label: t("auth.login.password.label"),
      hint: t("auth.login.password.hint"),
      errorRequired: t("auth.login.password.errors.required"),
    },
    submit: t("auth.login.submit"),
  };

  return (
    <>
      <AuthHeader />
      <main id="main" className="bg-surface-page">
        <div className="mx-auto flex max-w-(--container-narrow) flex-col gap-8 px-page-gutter py-section-block">
          <SectionHeader
            titleId="login-title"
            overline={t("auth.login.overline")}
            title={t("auth.login.title")}
            lead={t("auth.login.lead")}
          />
          <LoginForm labels={labels} />
          <p className="flex flex-wrap items-center gap-2 text-md text-text-secondary">
            {t("auth.login.signupPrompt")}
            <LinkButton href="/signup" variant="text">
              {t("auth.login.signupCta")}
            </LinkButton>
          </p>
        </div>
      </main>
    </>
  );
}
