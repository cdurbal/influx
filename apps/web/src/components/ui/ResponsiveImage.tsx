import { getImageProps } from "next/image";
import type { ImageFocus, LandingImage } from "@/content/landing-content";
import { IMAGE_SIZES, type ImageSizesKey } from "@/styles/image-sizes";
import { cn } from "./class-names";

const FOCUS_CLASSES: Record<ImageFocus, string> = {
  center: cn("object-center"),
  "center 35%": cn("object-(--image-focus-center-35)"),
  "center 40%": cn("object-(--image-focus-center-40)"),
  "center 60%": cn("object-(--image-focus-center-60)"),
  "center 70%": cn("object-(--image-focus-center-70)"),
  "35% center": cn("object-(--image-focus-35-center)"),
  "45% center": cn("object-(--image-focus-45-center)"),
  "55% center": cn("object-(--image-focus-55-center)"),
  "60% center": cn("object-(--image-focus-60-center)"),
  "65% center": cn("object-(--image-focus-65-center)"),
  "70% center": cn("object-(--image-focus-70-center)"),
};

type ResponsiveImageProps = {
  image: LandingImage;
  sizes: ImageSizesKey;
  /**
   * Width, aspect ratio and radius classes of the frame, e.g. "aspect-4/3 w-full rounded-lg".
   * The frame sets no width itself: `cn` does not resolve conflicts, so the caller owns it (10 #1).
   */
  className?: string;
  /** Only IMG-HERO-01 loads eagerly (02 §2.6). */
  eager?: boolean;
};

/**
 * The only wrapper of next/image (01 §11 rule 6). The frame reserves the final ratio (no layout
 * shift) and shows the muted surface while loading or if the image fails (02 §2.8).
 * The `style` attribute next/image writes for `fill` is dropped and replaced by the same rules as
 * classes: the CSP refuses inline style attributes (03 §6.5, no 'unsafe-inline', 18 T10.3).
 */
export function ResponsiveImage({
  image,
  sizes,
  className,
  eager = false,
}: ResponsiveImageProps) {
  const { props } = getImageProps({
    src: image.src,
    alt: image.alt,
    fill: true,
    sizes: IMAGE_SIZES[sizes],
    loading: eager ? "eager" : "lazy",
    fetchPriority: eager ? "high" : "auto",
  });
  const imageProps = { ...props, style: undefined };
  return (
    <div className={cn("relative overflow-hidden bg-surface-muted", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element -- next/image props, without its inline style */}
      <img
        {...imageProps}
        alt={image.alt}
        className={cn(
          "absolute inset-0 size-full object-cover text-transparent",
          FOCUS_CLASSES[image.focus],
        )}
      />
    </div>
  );
}
