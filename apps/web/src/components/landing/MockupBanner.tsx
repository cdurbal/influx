import { TriangleAlertIcon } from "@/components/ui/icons";

type MockupBannerProps = {
  regionLabel: string;
  label: string;
  detail: string;
};

/** "Mockup: fictitious content" notice, first element of the body (02 §3.1, CA14). */
export function MockupBanner({
  regionLabel,
  label,
  detail,
}: MockupBannerProps) {
  return (
    <aside
      aria-label={regionLabel}
      className="border-b-(length:--border-width-thick) border-mockup-banner-border bg-mockup-banner-bg px-page-gutter py-2 text-sm text-text-primary"
    >
      <p className="mx-auto flex max-w-(--container-max) flex-wrap items-center justify-center gap-x-2 gap-y-1 text-center">
        <TriangleAlertIcon
          aria-hidden="true"
          className="size-(--size-icon-sm) shrink-0"
        />
        <strong className="font-bold">{label}</strong>
        <span>{detail}</span>
      </p>
    </aside>
  );
}
