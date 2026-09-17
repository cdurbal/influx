import {
  CaptionsIcon,
  EyeIcon,
  Maximize2Icon,
  MoreVerticalIcon,
  PauseIcon,
  UserRoundIcon,
  Volume2Icon,
} from "@/components/ui/icons";
import cameraBadge from "./camera.png";
import { ResponsiveImage } from "./ResponsiveImage";

const TOP_LEFT_ICONS = [PauseIcon, Volume2Icon];
const TOP_RIGHT_ICONS = [CaptionsIcon, MoreVerticalIcon, Maximize2Icon];

// Fixed mock view count: purely illustrative, never a real product number.
const VIEW_COUNT = "1,2M";

function ControlButton({ Icon }: { Icon: typeof PauseIcon }) {
  return (
    <span className="flex size-8 shrink-0 items-center justify-center rounded-round bg-overlay-scrim text-text-inverse">
      <Icon className="size-(--size-icon-sm)" />
    </span>
  );
}

/**
 * Decorative short-form-video chrome: a generic player control bar, view count and creator
 * avatar over the screen content, plus a full-width progress bar. No handle, caption or
 * third-party logo by construction (D16, CA17) — the top-left app badge is a generic camera
 * glyph, not the real YouTube mark.
 */
export function ShortVideoOverlay() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 flex flex-col justify-between p-3"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ResponsiveImage
            image={{ src: cameraBadge, alt: "", focus: "center" }}
            sizes="badgeIcon"
            className="size-6 shrink-0 rounded-sm"
          />
          {TOP_LEFT_ICONS.map((Icon, index) => (
            <ControlButton key={index} Icon={Icon} />
          ))}
        </div>
        <div className="flex items-center gap-2">
          {TOP_RIGHT_ICONS.map((Icon, index) => (
            <ControlButton key={index} Icon={Icon} />
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2 pb-2">
        <span className="flex w-fit items-center gap-2 rounded-pill bg-surface-raised px-3 py-1 text-md font-medium text-text-primary shadow-md">
          <EyeIcon className="size-(--size-icon-md)" />
          {VIEW_COUNT}
        </span>
        <span className="flex size-5 shrink-0 items-center justify-center rounded-round border-(length:--border-width-thin) border-border-default bg-surface-muted text-text-primary shadow-md">
          <UserRoundIcon className="size-(--size-icon-sm)" />
        </span>
      </div>

      <div className="absolute inset-x-0 bottom-0 h-1 bg-border-default">
        {/* Fixed mock playback position: this overlay is a static illustration, not a real player. */}
        <div className="h-full w-3/5 bg-decorative-progress" />
      </div>
    </div>
  );
}
