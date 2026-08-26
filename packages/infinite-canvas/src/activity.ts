import { hasInfiniteCanvasSelection } from "./selection";
import type { InfiniteCanvasState } from "./types";

/**
 * What the canvas is doing right now, for chrome that needs to respond to it.
 *
 * Distinct from `getInfiniteCanvasPointerMode`, which answers a different question: that is the
 * *tool the user chose* — pan or marquee — and it does not change when a drag begins or a
 * selection appears. This answers what is happening, which is what chrome actually keys off.
 *
 * Chrome built without it ends up reading `state.interaction?.kind` inline and re-deriving the
 * same seven-way branch at every call site, and then disagreeing about the edges: whether a
 * gutter drag counts as resizing, whether a marquee that has selected nothing is still
 * "selecting". Those are one decision, made here.
 *
 * The distinction that earns its keep is **transient versus resting**. `marquee`, `panning`,
 * `moving`, and `resizing` last only while a pointer is down, and are the states during which
 * chrome should get out of the way — a toolbar hovering over a window the user is dragging is
 * the single most common way canvas chrome ruins a canvas. `idle` and `selected` are resting
 * states where chrome should be present and settled. `isInfiniteCanvasActivityTransient` names
 * that split so a consumer does not have to enumerate it.
 */

type InfiniteCanvasActivity =
  /** Nothing selected, nothing in flight. */
  | "idle"
  /** A selection exists and no pointer is down. */
  | "selected"
  /** A marquee is being dragged. */
  | "marquee"
  /** The camera is being panned. */
  | "panning"
  /** A window or group is being moved. */
  | "moving"
  /** A window, group, or the seam between two panes is being resized. */
  | "resizing";

/** Interaction kind to activity. Exhaustive, so a new interaction fails the typecheck here. */
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

/**
 * Whether this activity lasts only while a pointer is down.
 *
 * The reason to ask: transient activities are when chrome should recede, and resting ones are
 * when it should be present. Deriving that from the activity rather than from the interaction
 * keeps the rule in one place.
 */
function isInfiniteCanvasActivityTransient(activity: InfiniteCanvasActivity): boolean {
  return activity !== "idle" && activity !== "selected";
}

export { getInfiniteCanvasActivity, isInfiniteCanvasActivityTransient };
export type { InfiniteCanvasActivity };
