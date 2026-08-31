import { hasInfiniteCanvasSelection } from "./selection";
import type { InfiniteCanvasState } from "./types";

/** Reports the current canvas activity for UI chrome. */

type InfiniteCanvasActivity = "idle" | "selected" | "marquee" | "panning" | "moving" | "resizing";

const ACTIVITY_BY_INTERACTION: Readonly<
  Record<NonNullable<InfiniteCanvasState["interaction"]>["kind"], InfiniteCanvasActivity>
> = {
  groupGutter: "resizing",
  groupMove: "moving",
  groupResize: "resizing",
  marquee: "marquee",
  move: "moving",
  pan: "panning",
  resize: "resizing",
};

function getInfiniteCanvasActivity<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
): InfiniteCanvasActivity {
  if (state.interaction !== null) {
    return ACTIVITY_BY_INTERACTION[state.interaction.kind];
  }

  return hasInfiniteCanvasSelection(state.selection) ? "selected" : "idle";
}

/** Returns `true` while a pointer interaction is active. */
function isInfiniteCanvasActivityTransient(activity: InfiniteCanvasActivity): boolean {
  return activity !== "idle" && activity !== "selected";
}

export { getInfiniteCanvasActivity, isInfiniteCanvasActivityTransient };
export type { InfiniteCanvasActivity };
