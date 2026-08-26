import {
  getInfiniteCanvasConnectionAffordanceWindowId,
  getInfiniteCanvasConnectionHandles,
  getInfiniteCanvasConnectionPreviewPath,
  getInfiniteCanvasWindowData,
  resolveInfiniteCanvasSpatialTarget,
  screenPointToWorldPoint,
  useInfiniteCanvasState,
  worldPointToScreenPoint,
  type InfiniteCanvasPoint,
  type InfiniteCanvasState,
  type InfiniteCanvasWindow,
} from "@hyphened/infinite-canvas";
import { useObservable, useValue } from "@legendapp/state/react";
import { useEffect, useRef } from "react";
import { tv } from "ui/tv";

import { connectItems, findRelation, relations$ } from "../relations/relation-store";
import { CANVAS_CHROME } from "./chrome";
import { ContentWindowData, type WindowKind } from "./window-registry";

/**
 * Authoring a connection by dragging one note onto another.
 *
 * Everything about *the gesture* now lives in the framework — where the handles are, when they
 * appear, when they must not disappear, and what the far end is at this instant — because none of
 * it is a Polkadot idea. What is left here is the only part that is: which windows are showing
 * notes, whether two notes may be joined, and what to write when they are.
 *
 * The first version of this hand-rolled the gesture and shipped a handle that vanished the moment
 * you reached for it, because visibility asked "is the pointer over the window" while the handle
 * sat outside it. `getInfiniteCanvasConnectionAffordanceWindowId` is that fix, generically: it
 * holds a window's affordance while the pointer is anywhere in the ring the handles occupy, and
 * hands it over only when the pointer is properly inside a different window.
 */

const draft = tv({
  slots: {
    handle:
      "pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2 cursor-crosshair rounded-full bg-[var(--surface-raised)] shadow-[var(--lift-1)] inset-ring-1 inset-ring-[var(--edge-light)] transition-colors duration-100 ease-[var(--ease-swift)] hover:bg-[var(--accent)]",
    handleCore: "absolute inset-[3px] rounded-full bg-[var(--accent)]",
    path: "fill-none stroke-[var(--accent)] stroke-[1.5]",
    root: "pointer-events-none absolute inset-0 h-full w-full overflow-visible",
    svg: "pointer-events-none absolute inset-0 h-full w-full overflow-visible",
  },
  variants: {
    landing: {
      // Dashed while the far end is only a pointer, solid once it is over a note it can join. The
      // line answers "will this commit?" without a second affordance.
      false: { path: "opacity-50 [stroke-dasharray:4_4]" },
      true: { path: "opacity-90" },
    },
  },
});

type Draft = Readonly<{
  /** Viewport coordinates, which is what the framework's resolvers read. */
  pointer: InfiniteCanvasPoint;
  sourceItemId: string;
  sourceWindowId: string;
}>;

/** Whatever content item a window is bound to, whichever kind of window it is. */
function getItemId(window: InfiniteCanvasWindow<WindowKind> | undefined) {
  return window === undefined
    ? undefined
    : getInfiniteCanvasWindowData(window, ContentWindowData.allows)?.itemId;
}

/** Whatever window a drag is currently over, through the framework's one answer for that. */
function getLandingWindow(
  state: InfiniteCanvasState<WindowKind>,
  viewportPoint: InfiniteCanvasPoint,
) {
  const target = resolveInfiniteCanvasSpatialTarget<WindowKind>({
    chrome: CANVAS_CHROME,
    state,
    viewportPoint,
  });

  return target.type === "window" ? target.window : undefined;
}

export function ConnectorDraft({ projectId }: Readonly<{ projectId: string }>) {
  const state = useInfiniteCanvasState<WindowKind>();
  const relations = useValue(relations$);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const affordance$ = useObservable<string | null>(null);
  const draft$ = useObservable<Draft | null>(null);
  const affordanceWindowId = useValue(affordance$);
  const dragging = useValue(draft$);
  const isDragging = dragging !== null;
  const styles = draft();

  /*
   * Hover is tracked on `window` rather than on this layer.
   *
   * The layer has to be `pointer-events-none` or it would eat every canvas gesture, and an element
   * that does not receive pointer events does not receive pointermove either. Listening globally
   * and converting through this element's own rect costs one listener and leaves the canvas
   * untouched.
   */
  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      const bounds = rootRef.current?.getBoundingClientRect();

      if (bounds === undefined) {
        return;
      }

      const pointer = { x: event.clientX - bounds.left, y: event.clientY - bounds.top };

      if (draft$.peek() !== null) {
        draft$.pointer.set(pointer);

        return;
      }

      // The previous window is passed back in, which is what makes the affordance survive the
      // journey to a handle instead of unmounting under the cursor.
      affordance$.set(
        getInfiniteCanvasConnectionAffordanceWindowId(state, pointer, affordance$.peek()),
      );
    };

    window.addEventListener("pointermove", onPointerMove);

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
    };
  }, [affordance$, draft$, state]);

  /*
   * Release and abandon, on `window` for the same reason a drag is: the pointer will leave this
   * layer, the window, and often the viewport before it is let go.
   *
   * Bound to *whether* a drag is open rather than to the draft itself, and the draft is read with
   * `peek` inside the handler. The draft carries the live pointer, so depending on it would rebuild
   * these listeners on every pointermove to end up with the same two.
   */
  useEffect(() => {
    if (!isDragging) {
      return;
    }

    const onPointerUp = (event: PointerEvent) => {
      const bounds = rootRef.current?.getBoundingClientRect();
      const source = draft$.peek();

      draft$.set(null);

      if (bounds === undefined || source === null) {
        return;
      }

      const itemId = getItemId(
        getLandingWindow(state, {
          x: event.clientX - bounds.left,
          y: event.clientY - bounds.top,
        }),
      );

      if (
        itemId === undefined ||
        itemId === source.sourceItemId ||
        findRelation(relations, source.sourceItemId, itemId) !== undefined
      ) {
        return;
      }

      void connectItems({ projectId, source: source.sourceItemId, target: itemId });
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        draft$.set(null);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("pointerup", onPointerUp);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [draft$, isDragging, projectId, relations, state]);

  const sourceWindowId = dragging?.sourceWindowId ?? affordanceWindowId;
  const sourceWindow = state.windows.find((candidate) => candidate.id === sourceWindowId);
  const sourceItemId = getItemId(sourceWindow);

  if (sourceWindow === undefined || sourceItemId === undefined) {
    return <div className={styles.root()} data-slot="connector-draft" ref={rootRef} />;
  }

  /*
   * What the far end is right now: whatever the pointer is over, or the pointer itself.
   *
   * Resolved from the live pointer rather than remembered in the drag state, so the preview and the
   * commit read the same answer and cannot disagree about where the drag would land.
   */
  const landing = dragging === null ? undefined : getLandingWindow(state, dragging.pointer);
  const landingItemId = getItemId(landing);
  const isJoinable =
    landingItemId !== undefined &&
    landingItemId !== sourceItemId &&
    findRelation(relations, sourceItemId, landingItemId) === undefined;
  const preview =
    dragging === null
      ? null
      : getInfiniteCanvasConnectionPreviewPath(
          sourceWindow.rect,
          isJoinable && landing !== undefined
            ? landing.rect
            : screenPointToWorldPoint(state.camera, state.viewport, dragging.pointer),
          { route: "orthogonal" },
        ).points.map((point) => worldPointToScreenPoint(state.camera, state.viewport, point));

  return (
    <div className={styles.root()} data-slot="connector-draft" ref={rootRef}>
      {preview === null ? null : (
        <svg className={styles.svg()}>
          <polyline
            className={styles.path({ landing: isJoinable })}
            points={preview.map((point) => `${String(point.x)},${String(point.y)}`).join(" ")}
          />
        </svg>
      )}
      {/*
        One handle per edge, so a connection starts on the side facing where it is going rather
        than on whichever side the framework happened to pick. Hidden mid-drag: the line already
        says what is happening, and four dots orbiting the source is noise.
      */}
      {isDragging
        ? null
        : getInfiniteCanvasConnectionHandles(sourceWindow, state.camera, state.viewport).map(
            (handle) => (
              <button
                aria-label={`Drag to connect this note from its ${handle.edge} edge`}
                className={styles.handle()}
                key={handle.edge}
                onPointerDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();

                  const bounds = rootRef.current?.getBoundingClientRect();

                  if (bounds === undefined) {
                    return;
                  }

                  draft$.set({
                    pointer: { x: event.clientX - bounds.left, y: event.clientY - bounds.top },
                    sourceItemId,
                    sourceWindowId: sourceWindow.id,
                  });
                }}
                style={{
                  height: handle.radiusPx * 2,
                  left: handle.point.x,
                  top: handle.point.y,
                  width: handle.radiusPx * 2,
                }}
                type="button"
              >
                <span className={styles.handleCore()} />
              </button>
            ),
          )}
    </div>
  );
}
