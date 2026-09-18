import type { InfiniteCanvasState } from "./types";

/** Reports the current canvas activity for UI chrome. */

type InfiniteCanvasActivity = "idle" | "selected" | "marquee" | "panning" | "moving" | "resizing";

const ACTIVITY_BY_INTERACTION: Readonly<
  Record<NonNullable<InfiniteCanvasState["interaction"]>["kind"], InfiniteCanvasActivity>
> = {
  groupReorder: "moving",
  groupGutter: "resizing",
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

  return state.selection.targets.length > 0 ? "selected" : "idle";
}

/** Returns `true` while a pointer interaction is active. */
function isInfiniteCanvasActivityTransient(activity: InfiniteCanvasActivity): boolean {
  return activity !== "idle" && activity !== "selected";
}

export { getInfiniteCanvasActivity, isInfiniteCanvasActivityTransient };
export type { InfiniteCanvasActivity };
