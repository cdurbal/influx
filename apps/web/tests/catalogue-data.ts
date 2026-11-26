// The data of the catalogue guards of the member components (RUB, D89; docs/mvp/jalons/rub/
// modele-archi.md §1, §2, §7): what the guards of tests/guards.test.ts decide nothing about. Each line
// of RUB edits it in its own commit: it adds the modules it creates, drops the name a rename retires,
// and removes the entry of a screen that it migrates (a stale entry fails the guard).
import type { TransitionalCopyRule } from "@influx/test-kit/guards";

/** The folder of the components, relative to the root of the front. */
export const CATALOGUE_DIRECTORY = "src/components/member/ui";

/**
 * Every `.tsx` module of the folder, and none other: the catalogue of RUB, the controls of C18 and
 * the dated exceptions (`VerifiedBadge`, `ScoreGauge`, RUB-A §1). An old name that comes back
 * (`MemberButton.tsx`, renamed by line 02) is outside the list.
 */
export const CATALOGUE_MODULES: readonly string[] = [
  "ActionLink.tsx",
  "Announcer.tsx",
  "Button.tsx",
  "Card.tsx",
  "CardActions.tsx",
  "ChipList.tsx",
  "CounterBadge.tsx",
  "DomainField.tsx",
  "FieldFrame.tsx",
  "InnerPanel.tsx",
  "LayerBadge.tsx",
  "LogoPlate.tsx",
  "MultiChoiceField.tsx",
  "Notice.tsx",
  "PageFrame.tsx",
  "PageHeader.tsx",
  "PickListField.tsx",
  "RoleBadge.tsx",
  "ScoreGauge.tsx",
  "Section.tsx",
  "SingleChoiceField.tsx",
  "StatusBadge.tsx",
  "TextAreaField.tsx",
  "TextField.tsx",
  "VerifiedBadge.tsx",
  "YesNoField.tsx",
];

/** The modules of RUB with no caller before RUE (RUB-A §7); the screen that wires one removes it. */
export const UNCALLED_MODULES: readonly string[] = [
  "ActionLink",
  "Announcer",
  "CardActions",
  "ChipList",
  "InnerPanel",
  "LogoPlate",
  "PageFrame",
  "Section",
];

const SCREENS = "src/components";

/**
 * The copies of screen in reprieve (RUB-A §2): the live regions, the save statuses, the notices of
 * error without an announcement, the folds and the dialog that a screen still writes itself, until
 * the commit that migrates it onto the component of RUB removes its entry.
 */
export const TRANSITIONAL_COPIES: readonly TransitionalCopyRule[] = [
  {
    name: 'a live region (role="status" or aria-live)',
    pattern: /role="status"|aria-live/,
    files: [
      "account/DetailsScreen",
      "account/EmailChange",
      "account/FreshCode",
      "account/PreferencesScreen",
      "account/SessionsScreen",
      "account/TermsGate",
      "auth/AuthFlow",
      "auth/CodeStep",
      "auth/SignupDetailsStep",
      "brand-profile/BrandHome",
      "brand-profile/BrandProfileScreen",
      "campaign/CampaignFeedScreen",
      "campaign/CampaignFormScreen",
      "campaign/CampaignListScreen",
      "campaign/CampaignPreviewScreen",
      "campaign/CampaignRecordScreen",
      "creator-profile/CreatorAudienceFields",
      "creator-profile/CreatorHomeCard",
      "creator-profile/CreatorNetworksFields",
      "creator-profile/CreatorPortfolioBlock",
      "creator-profile/CreatorPreviewScreen",
      "creator-profile/CreatorProfileScreen",
      "creator-profile/CreatorPublicationCard",
      "creator-profile/CreatorTrustBlock",
      "creator-search/AnonymousProfileScreen",
      "creator-search/CreatorSearchScreen",
      "creator-search/ShortlistScreen",
      "creator-search/ShortlistsScreen",
      "legal/LegalDocumentView",
      "member/MemberShell",
      "member/ui/Announcer",
      "member/ui/MultiChoiceField",
      "member/ui/PickListField",
      "verification/AppealScreen",
      "verification/AudienceScreen",
      "verification/BrandVerificationBlock",
      "verification/BrandVerificationScreen",
      "verification/CodeBox",
      "verification/OwnershipScreen",
      "verification/VerificationLineState",
    ].map((file) => `${SCREENS}/${file}.tsx`),
  },
  {
    name: "a copy of SaveStatus",
    pattern: /\bfunction SaveStatus\b/,
    files: [
      "brand-profile/BrandProfileScreen",
      "campaign/CampaignFormScreen",
      "creator-profile/CreatorProfileScreen",
    ].map((file) => `${SCREENS}/${file}.tsx`),
  },
  {
    name: "an ErrorNotice that is not announced",
    pattern: /<ErrorNotice\b[^>]*?\bannounce=\{false\}/,
    files: [
      "auth/SignupDetailsStep",
      "campaign/CampaignFormScreen",
      "campaign/CampaignSubmitPanel",
      "member/ui/FieldFrame",
      "verification/BrandRequestState",
      "verification/DisputeNotice",
      "verification/RequestState",
    ].map((file) => `${SCREENS}/${file}.tsx`),
  },
  {
    name: "a <details> fold",
    pattern: /<details\b/,
    files: [
      "campaign/CampaignFormScreen",
      "creator-profile/CreatorOfferFields",
      "creator-profile/CreatorProfileScreen",
      "creator-search/CreatorSearchScreen",
      "creator-search/SearchFiltersForm",
    ].map((file) => `${SCREENS}/${file}.tsx`),
  },
  {
    name: "a <dialog>",
    pattern: /<dialog\b/,
    files: [`${SCREENS}/auth/TermsDialog.tsx`],
  },
];
