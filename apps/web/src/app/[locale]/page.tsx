import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { CreatorNetworkSection } from "@/components/landing/CreatorNetworkSection";
import { FaqSection } from "@/components/landing/FaqSection";
import { HeroSection } from "@/components/landing/HeroSection";
import { HowItWorksSection } from "@/components/landing/HowItWorksSection";
import { MethodSection } from "@/components/landing/MethodSection";
import { PricingSection } from "@/components/landing/PricingSection";
import { ProblemSection } from "@/components/landing/ProblemSection";
import { SignupDoorsSection } from "@/components/landing/SignupDoorsSection";
import { SiteFooter } from "@/components/landing/SiteFooter";
import { SiteHeader } from "@/components/landing/SiteHeader";
import { UseCasesSection } from "@/components/landing/UseCasesSection";
import { WhyInfluxSection } from "@/components/landing/WhyInfluxSection";
import { routing } from "@/i18n/routing";

/**
 * Landing page: assembles the blocks in the order of 00-cadrage.md. DOM order (02 §2.1): the
 * cookie banner comes first, from the layout, then header, main and footer. The fictitious module
 * is gone (J9 commit 5, 02 §13.3 point 2): the blocks that only showed invented content (sections
 * 2 to 6) are no longer rendered (02 §2.8), and every door leads to the real sign-up (EC-15).
 */
export default async function LandingPage({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  setRequestLocale(locale);

  return (
    <>
      <SiteHeader />
      <main id="main">
        <HeroSection />
        <ProblemSection />
        <MethodSection />
        <CreatorNetworkSection />
        <UseCasesSection />
        <HowItWorksSection />
        <PricingSection />
        <WhyInfluxSection />
        <FaqSection />
        <SignupDoorsSection />
      </main>
      <SiteFooter />
    </>
  );
}
