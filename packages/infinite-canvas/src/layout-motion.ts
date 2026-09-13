import { spring } from "motion";

const LAYOUT_SPRING = spring({ damping: 26, keyframes: [0, 1], stiffness: 220 }).toString();

const REDUCED_MOTION =
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/** The `transition` of a frame or shell at rest. */
const INFINITE_CANVAS_LAYOUT_TRANSITION = REDUCED_MOTION
  ? "none"
  : `var(--icx-layout-transition, ${["transform", "width", "height"].map((property) => `${property} ${LAYOUT_SPRING}`).join(", ")})`;

export { INFINITE_CANVAS_LAYOUT_TRANSITION };
