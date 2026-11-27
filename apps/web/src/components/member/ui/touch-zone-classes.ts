// The touch zone of a control drawn smaller than 44 px (docs/mvp/22-refonte-ux-ui/02a §0, RUB-B §3):
// the drawing stays, a transparent `before` reaches `size-touch-target` around it, so that the ring
// stays on the drawn element and no zone overlaps another (a control close to its neighbour is
// spaced by its caller). One recipe, read by the buttons and the links of action. The zone needs a
// positioned element: the build writes `relative` after `absolute` and `fixed`, so a control that is
// already placed takes the `AREA` classes, never the ones that bring `relative` (RUB-09b).

/** Height only, on an element already positioned (`absolute`, `fixed`). */
export const TOUCH_ZONE_HEIGHT_AREA_CLASSES = [
  "before:absolute before:inset-x-0 before:top-1/2",
  "before:h-(--size-touch-target) before:-translate-y-1/2",
].join(" ");

/** Both axes, on an element already positioned (`absolute`, `fixed`). */
export const TOUCH_ZONE_AREA_CLASSES = [
  "before:absolute before:left-1/2 before:top-1/2 before:size-full",
  "before:min-h-(--size-touch-target) before:min-w-(--size-touch-target)",
  "before:-translate-x-1/2 before:-translate-y-1/2",
].join(" ");

/** Height only: a button of 36 or 40 px, whose width is already that of its label. */
export const TOUCH_ZONE_HEIGHT_CLASSES = `relative ${TOUCH_ZONE_HEIGHT_AREA_CLASSES}`;

/** Both axes: a link alone on its line, a small icon button. */
export const TOUCH_ZONE_CLASSES = `relative ${TOUCH_ZONE_AREA_CLASSES}`;
