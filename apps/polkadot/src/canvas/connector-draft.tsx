import {
  getInfiniteCanvasRectConnectorPath,
  getInfiniteCanvasWindowData,
  resolveInfiniteCanvasSpatialTarget,
  screenPointToWorldPoint,
  useInfiniteCanvasState,
  worldPointToScreenPoint,
  worldRectToScreenRect,
  type InfiniteCanvasPoint,
  type InfiniteCanvasRect,
} from "@hyphened/infinite-canvas";
import { useObservable, useValue } from "@legendapp/state/react";
import { useEffect, useRef } from "react";
import { tv } from "ui/tv";

import { connectNotes, findRelation, relations$ } from "../notes/relations";
import { CANVAS_CHROME } from "./chrome";
import { NoteWindowData, type WindowKind } from "./window-registry";

/**
 * Authoring a connection by dragging one note onto another.
 *
 * Until this, an edge could only be made from the command palette with both notes open *and*
 * selected — so the rail could show you a graph you had no way to build, and connecting two things
 * you were already looking at cost a modal.
 *
 * Composed, not restated. `resolveInfiniteCanvasSpatialTarget` is the framework's single answer to
 * "what is under this pointer", including which window and which part of it, so nothing here walks
 * the window list or compares rects. `getInfiniteCanvasRectConnectorPath` routes the preview, and
 * routes it *the same way the committed edge is routed* — see `pointRect` for why that works with
 * a pointer that is not a window yet.
 *
 * Drawn above the windows rather than beneath them like `ConnectorLayer`: a settled connector
 * belongs to the scene and should pass under the note you are reading, but a line you are actively
 * dragging is the thing you are looking at, and hiding it behind a window you are dragging over is
 * the one moment it has to be visible.
 */

/** Screen pixels from the window's edge to the handle's centre. */
const HANDLE_OFFSET = 14;

const HANDLE_RADIUS = 7;

const draft = tv({
  slots: {
    /** Sits on the world, so it scales with nothing — a handle is chrome, not scenery. */
    handle:
      "pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2 cursor-crosshair rounded-full bg-[var(--surface-raised)] shadow-[var(--lift-1)] inset-ring-1 inset-ring-[var(--edge-light)] transition-colors duration-100 ease-[var(--ease-swift)] hover:bg-[var(--accent)]",
    handleCore: "absolute inset-[3px] rounded-full bg-[var(--accent)]",
    path: "fill-none stroke-[var(--accent)] stroke-[1.5]",
    root: "pointer-events-none absolute inset-0 h-full w-full overflow-visible",
    svg: "pointer-events-none absolute inset-0 h-full w-full overflow-visible",
  },
  variants: {
    landing: {
      // Dashed while the far end is only a pointer, solid once it is over a note it can join.
      // The line answers "will this commit?" without a second affordance.
      false: { path: "opacity-50 [stroke-dasharray:4_4]" },
      true: { path: "opacity-90" },
    },
  },
});

/**
 * A pointer, as a rect the connector geometry accepts.
 *
 * `getInfiniteCanvasRectConnectorPath` takes two rects, and a drag has one rect and one bare
 * point — but a zero-extent rect *is* that point to this geometry, exactly rather than
 * approximately: its centre is the point, and the edge anchor it computes for a zero half-size
 * scales to zero and lands back on the centre. So the preview is routed by the same function, with
 * the same elbow, as the edge it is about to become. No parallel path maths, and no framework
 * change to admit a point.
 */
function pointRect(point: InfiniteCanvasPoint): InfiniteCanvasRect {
  return { height: 0, width: 0, x: point.x, y: point.y };
}

type Draft = Readonly<{
  /** Viewport coordinates, which is what the spatial resolver reads. */
  pointer: InfiniteCanvasPoint;
  sourceNoteId: string;
  sourceWindowId: string;
}>;

export function ConnectorDraft({ projectId }: Readonly<{ projectId: string }>) {
  const state = useInfiniteCanvasState<WindowKind>();
  const relations = useValue(relations$);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const hovered$ = useObservable<string | null>(null);
  const draft$ = useObservable<Draft | null>(null);
  const hovered = useValue(hovered$);
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
    const toViewportPoint = (event: PointerEvent) => {
      const bounds = rootRef.current?.getBoundingClientRect();

      return bounds === undefined
        ? null
        : { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
    };

    const onPointerMove = (event: PointerEvent) => {
      const pointer = toViewportPoint(event);

      if (pointer === null) {
        return;
      }

      if (draft$.peek() !== null) {
        draft$.pointer.set(pointer);

        return;
      }

      const target = resolveInfiniteCanvasSpatialTarget<WindowKind>({
        chrome: CANVAS_CHROME,
        state,
        viewportPoint: pointer,
      });

      hovered$.set(target.type === "window" ? target.windowId : null);
    };

    window.addEventListener("pointermove", onPointerMove);

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
    };
  }, [draft$, hovered$, state]);

  /*
   * Release and abandon, on `window` for the same reason a drag is: the pointer will leave this
   * layer, the window, and often the viewport before it is let go.
   *
   * Bound to *whether* a drag is open rather than to the draft itself, and the draft is read with
   * `peek` inside the handler. The draft carries the live pointer, so depending on it would tear
   * these listeners down and rebuild them on every single pointermove — hundreds of add/remove
   * pairs across one gesture, to end up with the same two listeners.
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

      const landing = resolveInfiniteCanvasSpatialTarget<WindowKind>({
        chrome: CANVAS_CHROME,
        state,
        viewportPoint: { x: event.clientX - bounds.left, y: event.clientY - bounds.top },
      });
      const noteId =
        landing.type === "window"
          ? getInfiniteCanvasWindowData(landing.window, NoteWindowData.allows)?.noteId
          : undefined;

      if (
        noteId === undefined ||
        noteId === source.sourceNoteId ||
        findRelation(relations, source.sourceNoteId, noteId) !== undefined
      ) {
        return;
      }

      void connectNotes({ projectId, source: source.sourceNoteId, target: noteId });
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

  const sourceWindowId = dragging?.sourceWindowId ?? hovered;
  const sourceWindow = state.windows.find((candidate) => candidate.id === sourceWindowId);
  const sourceNoteId =
    sourceWindow === undefined
      ? undefined
      : getInfiniteCanvasWindowData(sourceWindow, NoteWindowData.allows)?.noteId;

  if (
    sourceWindow === undefined ||
    sourceNoteId === undefined ||
    sourceWindow.mode === "minimized"
  ) {
    return <div className={styles.root()} data-slot="connector-draft" ref={rootRef} />;
  }

  const screenRect = worldRectToScreenRect(state.camera, state.viewport, sourceWindow.rect);

  /*
   * What the far end is right now: a note the pointer is over, or the pointer itself.
   *
   * Resolved from the live pointer rather than tracked in the drag state, so the preview and the
   * commit read the same answer from the same function and cannot disagree about where the drag
   * would land.
   */
  const landing =
    dragging === null
      ? null
      : resolveInfiniteCanvasSpatialTarget<WindowKind>({
          chrome: CANVAS_CHROME,
          state,
          viewportPoint: dragging.pointer,
        });
  const landingNoteId =
    landing?.type === "window"
      ? getInfiniteCanvasWindowData(landing.window, NoteWindowData.allows)?.noteId
      : undefined;
  const isJoinable =
    landingNoteId !== undefined &&
    landingNoteId !== sourceNoteId &&
    findRelation(relations, sourceNoteId, landingNoteId) === undefined;
  const preview =
    dragging === null
      ? null
      : getInfiniteCanvasRectConnectorPath(
          sourceWindow.rect,
          isJoinable && landing?.type === "window"
            ? landing.window.rect
            : pointRect(screenPointToWorldPoint(state.camera, state.viewport, dragging.pointer)),
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
      <button
        aria-label="Drag to connect this note to another"
        className={styles.handle()}
        onPointerDown={(event) => {
          event.preventDefault();
          event.stopPropagation();

          const bounds = rootRef.current?.getBoundingClientRect();

          if (bounds === undefined) {
            return;
          }

          draft$.set({
            pointer: { x: event.clientX - bounds.left, y: event.clientY - bounds.top },
            sourceNoteId,
            sourceWindowId: sourceWindow.id,
          });
        }}
        style={{
          height: HANDLE_RADIUS * 2,
          left: screenRect.left + screenRect.width + HANDLE_OFFSET,
          top: screenRect.top + screenRect.height / 2,
          width: HANDLE_RADIUS * 2,
        }}
        type="button"
      >
        <span className={styles.handleCore()} />
      </button>
    </div>
  );
}
