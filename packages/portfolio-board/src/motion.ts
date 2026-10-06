import type { DOMSegmentWithTransition } from "motion";

export type TimedDOMSegment = [
  DOMSegmentWithTransition[0],
  DOMSegmentWithTransition[1],
  DOMSegmentWithTransition[2] & { at: number; duration: number },
];

/**
 * How the kit moves.
 *
 * Base UI hands a widget its own state as data attributes and CSS does the moving, so motion here
 * is a class recipe and not a runtime: nothing in this file renders, and a slot composes a preset
 * the way it composes any other class.
 *
 * Each preset is one whole string rather than dials a caller turns. That is the rule the kit
 * already holds every slot to — a transition names both the time and the curve it moves on — and a
 * property picked apart from its timing cannot satisfy it. It is also the point: four names that
 * cannot be recombined are what keeps two widgets from opening at slightly different speeds.
 *
 * The four overlays were already spelling the same gesture out by hand, and the dialog's copy
 * scaled from 0.98 where the other three scaled from 0.97.
 */
export const MOTION = {
  /** A menu, a popover, a tooltip, a dialog: anchored, and gone again. */
  overlay:
    "transition-[transform,opacity] duration-(--pk-duration-detail) ease-pk-swift data-starting-style:scale-[0.97] data-starting-style:opacity-0 data-ending-style:scale-[0.97] data-ending-style:opacity-0",
  /** The dark a dialog puts the page behind. */
  scrim:
    "transition-opacity duration-(--pk-duration-detail) ease-pk-swift data-starting-style:opacity-0 data-ending-style:opacity-0",
  /** A panel that opens to the height Base UI measured for it. */
  panel:
    "transition-[height] duration-(--pk-duration-detail) ease-pk-swift data-starting-style:h-0 data-ending-style:h-0",
} as const;
