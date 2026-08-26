import {
  getInfiniteCanvasContentViewport,
  getRectCenter,
  isUsableViewport,
  isWorldRectWithinViewport,
  worldPointToScreenPoint,
} from "./geometry";
import { getInfiniteCanvasGroupProjection } from "./group-state";
import { getInfiniteCanvasGroupWindowIds } from "./group-tree";
import type { InfiniteCanvasPoint, InfiniteCanvasRect, InfiniteCanvasState } from "./types";

/**
 * Edge indicators for what has fallen off the viewport, as geometry rather than as a widget.
 *
 * `getInfiniteCanvasMinimapLayout` answers *"where am I?"* — you look at it. This answers
 * *"where did my window go?"* — you don't. It is the peripheral half of the same problem, and
 * on an infinite canvas both halves are load-bearing: a bounded document can only scroll, so a
 * lost window is always one `Home` away. Here it can be anywhere, and fit-all is a blunt
 * instrument that moves the camera off everything else to find one thing.
 *
 * Pure, like `minimap.ts`, and for the same reason: the projection is the part a consumer
 * cannot easily get right, and the arrowhead is the part they can.
 *
 * ### What counts as one thing
 *
 * A group is **one** indicator, not one per pane. Four panes docked together are at the same
 * bearing and the same distance; four arrows stacked on the same pixel is not information. So
 * grouped windows are folded into their group's rect, and only floating windows stand alone.
 * That is the same rule the rest of the framework follows — the group is the source of truth,
 * a member's rect is its projection.
 *
 * Minimized windows have no rect and are omitted. Windows hidden behind an inactive tab or a
 * collapsed fold are omitted *individually* but still counted through their group, which is
 * the thing you would navigate to.
 *
 * Two targets that merely *look* like one are folded the same way, by where they land rather than
 * by what they are: see `mergeWithinPx`. Drawing this in a browser is what turned that up — the
 * rule had been written for groups and stopped there, so two unrelated windows on the same bearing
 * still stacked.
 *
 * @experimental Landed 2026-07-08. First drawn in a browser by Polkadot, which found the shape
 * sufficient: `angle` needs no sign correction to rotate a right-pointing glyph, `point` lands
 * where a chip should sit, and `rect` feeds `view.navigate` unchanged.
 */

type InfiniteCanvasOffscreenTargetKind = "group" | "window";

type InfiniteCanvasOffscreenIndicator = Readonly<{
  /**
   * Bearing from the viewport centre to the target, in radians, as `Math.atan2` gives it.
   *
   * `0` points right (`+x`), and the angle grows **clockwise**, because screen `y` grows
   * downward. Rotate an arrow that points right by this and it points at the target.
   */
  angle: number;
  /**
   * Screen pixels from the viewport centre to the target's centre — the sort key, nearest
   * first.
   *
   * Screen pixels, not world units, so it shrinks as you zoom out. That is the honest ordering:
   * it ranks by how far the target is from the user's eye, not from their camera's origin.
   */
  distancePx: number;
  /** The window id or the group id, per `kind`. */
  id: string;
  /** The active window, or the group holding it. At most one indicator carries `true`. */
  isActive: boolean;
  kind: InfiniteCanvasOffscreenTargetKind;
  /** Where to draw, in screen pixels: on the inset viewport edge, along `angle`. */
  point: InfiniteCanvasPoint;
  /** The target's world rect. Hand it to `navigateToRect`, or its centre to `navigateToPoint`. */
  rect: InfiniteCanvasRect;
  /**
   * How many offscreen targets this indicator stands for, including itself — `1` unless others
   * landed on the same pixel and were folded into it.
   *
   * Given so a consumer can say "and two more behind this one" rather than draw one arrow and
   * imply it is the only thing out there. The folded ones are not returned: their bearing and
   * distance are, to a viewer, this one's.
   */
  targetCount: number;
}>;

type InfiniteCanvasOffscreenOptions = Readonly<{
  /**
   * Screen pixels to pull the indicator ring in from the viewport edge, so an arrow is drawn
   * inside the canvas rather than half-clipped by it.
   */
  insetPx?: number;
  /**
   * Cap on how many indicators are returned, nearest first. Unbounded by default.
   *
   * A hundred and sixty windows means a hundred and forty arrows, which is a border, not a
   * hint. The cap belongs to the consumer because only they know how big their canvas is —
   * and a consumer who caps should say so in their UI, because a silent cap reads as "that's
   * everything" when it isn't.
   */
  limit?: number;
  /**
   * Screen pixels of slack before a target counts as offscreen, matching
   * `isWorldRectWithinViewport`. A non-finite margin means nothing is ever offscreen, and this
   * returns an empty array.
   */
  marginPx?: number;
  /**
   * Fold indicators landing within this many screen pixels of a nearer one, in pixels.
   *
   * Two targets at the same bearing project to nearly the same point, and two arrows on the same
   * pixel is not information — it is one arrow with a smudge. Groups are already folded for
   * exactly this reason; this is the same rule applied to targets that merely *look* like one.
   *
   * Pixels rather than degrees, because the ring is a rectangle: the same angular separation is
   * tens of pixels along an edge and almost nothing near a corner, and it is pixels that decide
   * whether two chips overlap.
   *
   * The nearer target survives and carries the count. `0` disables folding.
   */
  mergeWithinPx?: number;
}>;

const DEFAULT_OFFSCREEN_INSET_PX = 24;

/** Roughly a chip, which is what a consumer draws at each point. */
const DEFAULT_OFFSCREEN_MERGE_WITHIN_PX = 28;

/**
 * Project a ray from the viewport centre onto the inset viewport edge.
 *
 * `t` is how far along `delta` the ray leaves the box: the smaller of the two axis crossings,
 * because the ray exits through whichever edge it reaches first. `t > 1` would mean the
 * target's centre lies strictly inside the inset box — which cannot happen for a target we
 * have already established does not intersect the viewport, so this never pushes an indicator
 * outward.
 *
 * A zero `delta` has no bearing at all, and would leave both crossings infinite and multiply
 * out to `NaN`. It should be unreachable — a rect centred on the viewport centre overlaps the
 * viewport — but `NaN` in a `transform` is a silently blank arrow, so it is answered rather
 * than assumed away.
 */
const projectOntoEdge = (
  center: InfiniteCanvasPoint,
  delta: InfiniteCanvasPoint,
  halfWidth: number,
  halfHeight: number,
): InfiniteCanvasPoint => {
  const horizontal = delta.x === 0 ? Number.POSITIVE_INFINITY : halfWidth / Math.abs(delta.x);
  const vertical = delta.y === 0 ? Number.POSITIVE_INFINITY : halfHeight / Math.abs(delta.y);
  const t = Math.min(horizontal, vertical);

  if (!Number.isFinite(t)) {
    return center;
  }

  return {
    x: center.x + delta.x * t,
    y: center.y + delta.y * t,
  };
};

/**
 * Every drawn thing that does not overlap the viewport, nearest first.
 *
 * Returns an empty array for an unmeasured (`0 × 0`) viewport — nothing is offscreen when there
 * is no screen — and for an `insetPx` that eats the viewport whole, where the ring has no
 * radius to sit on. Both are "draw nothing", which is what a caller of this function wants on
 * uncertainty: a phantom arrow pointing at a window the user can plainly see is worse than no
 * arrow at all.
 */
function getInfiniteCanvasOffscreenIndicators<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  options: InfiniteCanvasOffscreenOptions = {},
): readonly InfiniteCanvasOffscreenIndicator[] {
  const {
    insetPx = DEFAULT_OFFSCREEN_INSET_PX,
    limit = Number.POSITIVE_INFINITY,
    marginPx = 0,
    mergeWithinPx = DEFAULT_OFFSCREEN_MERGE_WITHIN_PX,
  } = options;
  const { camera, viewport } = state;
  /*
   * The ring sits inside what the user can see, not inside the element.
   *
   * `insetPx` is how far the indicators sit in from the edge, which is a different question from
   * where the edge *is*. With chrome on one side the two disagree, and a ring placed on the
   * element would put half its arrows behind the panel — indicators for windows you cannot see,
   * rendered somewhere you cannot see them.
   */
  const content = getInfiniteCanvasContentViewport(viewport, state.viewportInsets);
  const halfWidth = content.width / 2 - insetPx;
  const halfHeight = content.height / 2 - insetPx;

  if (!isUsableViewport(viewport) || halfWidth <= 0 || halfHeight <= 0 || limit <= 0) {
    return [];
  }

  const { windowRects } = getInfiniteCanvasGroupProjection(state.groups);
  const { activeWindowId } = state;
  const activeGroupId =
    activeWindowId === null
      ? null
      : (state.groups.find((group) =>
          getInfiniteCanvasGroupWindowIds(group.tree).includes(activeWindowId),
        )?.id ?? null);

  const targets = [
    ...state.groups.map((group) => ({
      id: group.id,
      isActive: group.id === activeGroupId,
      kind: "group" as const,
      rect: group.rect,
    })),
    // `windowRects` holds every window a group has placed — including the ones hidden behind a
    // tab, which carry the rect they would occupy if revealed. So `has` is the membership test,
    // the same one the window layer uses to decide a member has no resize handles of its own.
    ...state.windows
      .filter((window) => window.mode !== "minimized" && !windowRects.has(window.id))
      .map((window) => ({
        id: window.id,
        isActive: window.id === activeWindowId,
        kind: "window" as const,
        rect: window.rect,
      })),
  ];

  const screenCenter = {
    x: content.x + content.width / 2,
    y: content.y + content.height / 2,
  };

  const projected = targets
    .filter((target) => !isWorldRectWithinViewport(camera, viewport, target.rect, marginPx))
    .map((target) => {
      const targetCenter = worldPointToScreenPoint(camera, viewport, getRectCenter(target.rect));
      const delta = { x: targetCenter.x - screenCenter.x, y: targetCenter.y - screenCenter.y };

      return {
        ...target,
        angle: Math.atan2(delta.y, delta.x),
        distancePx: Math.hypot(delta.x, delta.y),
        point: projectOntoEdge(screenCenter, delta, halfWidth, halfHeight),
        targetCount: 1,
      };
    })
    .sort((left, right) => left.distancePx - right.distancePx);

  /*
   * Fold what lands on the same pixel, nearest kept.
   *
   * Before the `limit` rather than after, or a cap of five spent on five arrows in one place
   * would hide everything in every other direction — the opposite of what a cap is for.
   *
   * Linear in the number folded into, which is the count a consumer is willing to draw. The
   * quadratic worst case needs every target at a distinct bearing, and that is the case where no
   * folding happens at all.
   */
  const folded =
    mergeWithinPx <= 0
      ? projected
      : projected.reduce<(typeof projected)[number][]>((kept, candidate) => {
          const nearer = kept.find(
            (indicator) =>
              Math.hypot(
                indicator.point.x - candidate.point.x,
                indicator.point.y - candidate.point.y,
              ) <= mergeWithinPx,
          );

          if (nearer === undefined) {
            return [...kept, candidate];
          }

          nearer.targetCount += 1;

          return kept;
        }, []);

  return folded.slice(0, limit);
}

export { getInfiniteCanvasOffscreenIndicators };
export type {
  InfiniteCanvasOffscreenIndicator,
  InfiniteCanvasOffscreenOptions,
  InfiniteCanvasOffscreenTargetKind,
};
