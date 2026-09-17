import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { BrandLogosSection } from "@/components/landing/BrandLogosSection";
import { CaseStudiesSection } from "@/components/landing/CaseStudiesSection";
import { CreatorNetworkSection } from "@/components/landing/CreatorNetworkSection";
import { CreatorShowcaseSection } from "@/components/landing/CreatorShowcaseSection";
import { FaqSection } from "@/components/landing/FaqSection";
import { FeaturedResultSection } from "@/components/landing/FeaturedResultSection";
import { FinalCtaSection } from "@/components/landing/FinalCtaSection";
import { HeroSection } from "@/components/landing/HeroSection";
import { HowItWorksSection } from "@/components/landing/HowItWorksSection";
import { KeyFigureSection } from "@/components/landing/KeyFigureSection";
import { MethodSection } from "@/components/landing/MethodSection";
import { PricingSection } from "@/components/landing/PricingSection";
import { ProblemSection } from "@/components/landing/ProblemSection";
import { SiteFooter } from "@/components/landing/SiteFooter";
import { SiteHeader } from "@/components/landing/SiteHeader";
import { StartFormSection } from "@/components/landing/StartFormSection";
import { UseCasesSection } from "@/components/landing/UseCasesSection";
import { WhyInfluxSection } from "@/components/landing/WhyInfluxSection";
import { getPlaceholderContent } from "@/content/placeholders";
import { routing } from "@/i18n/routing";

/**
 * Landing page: assembles the blocks in the order of 00-cadrage.md and passes them their content.
 * DOM order (02 §2.1): the mockup banner and the cookie banner come first, from the layout, then
 * header, main (sections 1 to 16) and footer. A block whose fictitious content is missing is not rendered
 * (02 §2.8).
 */
export default async function LandingPage({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  setRequestLocale(locale);
  const content = getPlaceholderContent(locale);
  const cardsSourceNote = content.creatorCards.sourceNote;

  return (
    <>
      <SiteHeader />
      <main id="main">
        <HeroSection content={content.hero} />
        {content.keyFigure ? (
          <KeyFigureSection figure={content.keyFigure} />
        ) : null}
        {content.creatorShowcase.cards.length > 0 ? (
          <CreatorShowcaseSection
            cards={content.creatorShowcase.cards}
            sourceNote={cardsSourceNote}
          />
        ) : null}
        {content.featuredResult ? (
          <FeaturedResultSection result={content.featuredResult} />
        ) : null}
        {content.brandLogos && content.brandLogos.brands.length > 0 ? (
          <BrandLogosSection logos={content.brandLogos} />
        ) : null}
        {content.caseStudies && content.caseStudies.items.length > 0 ? (
          <CaseStudiesSection caseStudies={content.caseStudies} />
        ) : null}
        <ProblemSection content={content.problem} />
        <MethodSection image={content.method.image} />
        <CreatorNetworkSection
          network={content.creatorNetwork}
          cardsSourceNote={cardsSourceNote}
        />
        <UseCasesSection images={content.useCases.images} />
        <HowItWorksSection images={content.howItWorks.images} />
        <PricingSection />
        <WhyInfluxSection images={content.whyInflux.images} />
        <FaqSection contactEmail={content.contact.email} />
        <FinalCtaSection
          cards={content.finalCta.cards}
          cardsSourceNote={cardsSourceNote}
        />
        <StartFormSection
          image={content.startForm.image}
          mockupNotice={content.startForm.mockupNotice}
        />
      </main>
      <SiteFooter contactEmail={content.contact.email} />
    </>
  );
}
