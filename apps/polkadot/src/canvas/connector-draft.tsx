import {
  getCanvasLayout,
  getInfiniteCanvasConnectionAffordanceWindowId,
  getInfiniteCanvasConnectionHandles,
  getInfiniteCanvasConnectionPreviewPath,
  resolveInfiniteCanvasSpatialTarget,
  screenPointToWorldPoint,
  useInfiniteCanvasState$,
  worldPointToScreenPoint,
  type InfiniteCanvasPoint,
  type InfiniteCanvasState,
} from "@hyphened/infinite-canvas/legacy";
import { useObservable, useValue } from "@legendapp/state/react";
import { useEffect, useRef } from "react";
import { tv } from "ui/tv";

import { connectItems, findRelation, relations$ } from "../relations/relation-store";
import { CANVAS_CHROME } from "./chrome";
import { getContentWindowItemId, type WindowKind } from "./window-registry";

const draft = tv({
  slots: {
    handle:
      "pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2 cursor-crosshair rounded-full bg-[var(--surface-raised)] shadow-[var(--lift-1)] inset-ring-1 inset-ring-[var(--line)] transition-colors duration-100 ease-[var(--ease-swift)] hover:bg-[var(--accent)]",
    handleCore: "absolute inset-[3px] rounded-full bg-[var(--accent)]",
    path: "fill-none stroke-[var(--accent)] stroke-[1.5]",
    root: "pointer-events-none absolute inset-0 h-full w-full overflow-visible",
    svg: "pointer-events-none absolute inset-0 h-full w-full overflow-visible",
  },
  variants: {
    landing: {
      false: { path: "opacity-50 [stroke-dasharray:4_4]" },
      true: { path: "opacity-90" },
    },
  },
});

type Draft = Readonly<{
  pointer: InfiniteCanvasPoint;
  sourceItemId: string;
  sourceWindowId: string;
}>;

function getLandingTarget(
  state: InfiniteCanvasState<WindowKind>,
  viewportPoint: InfiniteCanvasPoint,
) {
  const target = resolveInfiniteCanvasSpatialTarget<WindowKind>({
    chrome: CANVAS_CHROME,
    state,
    viewportPoint,
  });

  return target.type === "window" ? target : null;
}

export function ConnectorDraft({ projectId }: Readonly<{ projectId: string }>) {
  const state$ = useInfiniteCanvasState$<WindowKind>();
  const state = useValue(state$) as InfiniteCanvasState<WindowKind>;
  const peekState = () => state$.peek() as InfiniteCanvasState<WindowKind>;
  const relations = useValue(relations$[projectId]) ?? [];
  const rootRef = useRef<HTMLDivElement | null>(null);
  const affordance$ = useObservable<string | null>(null);
  const draft$ = useObservable<Draft | null>(null);
  const affordanceWindowId = useValue(affordance$);
  const dragging = useValue(draft$);
  const isDragging = dragging !== null;
  const styles = draft();

  // This layer ignores pointer events, so the window owns pointer tracking.
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

      affordance$.set(
        getInfiniteCanvasConnectionAffordanceWindowId(peekState(), pointer, affordance$.peek()),
      );
    };

    window.addEventListener("pointermove", onPointerMove);

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
    };
  }, [affordance$, draft$, state$]);

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

      const landing = getLandingTarget(peekState(), {
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
      });
      const itemId = getContentWindowItemId(landing?.window ?? null);

      if (
        itemId === null ||
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
  }, [draft$, isDragging, projectId, relations, state$]);

  const sourceWindowId = dragging?.sourceWindowId ?? affordanceWindowId;
  const canvasLayout = getCanvasLayout(state);
  const sourceWindow =
    sourceWindowId === null
      ? null
      : (state.windows.find((window) => window.id === sourceWindowId) ?? null);
  const sourceRect =
    sourceWindow === null ? null : (canvasLayout.windowRects.get(sourceWindow.id) ?? null);
  const sourceItemId = getContentWindowItemId(sourceWindow);

  if (sourceWindow === null || sourceRect === null || sourceItemId === null) {
    return <div className={styles.root()} data-slot="connector-draft" ref={rootRef} />;
  }

  const landing = dragging === null ? null : getLandingTarget(state, dragging.pointer);
  const landingRect = landing?.rect ?? null;
  const landingItemId = getContentWindowItemId(landing?.window ?? null);
  const isJoinable =
    landingItemId !== null &&
    landingItemId !== sourceItemId &&
    findRelation(relations, sourceItemId, landingItemId) === undefined;
  const preview =
    dragging === null
      ? null
      : getInfiniteCanvasConnectionPreviewPath(
          sourceRect,
          isJoinable && landingRect !== null
            ? landingRect
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
      {isDragging
        ? null
        : getInfiniteCanvasConnectionHandles(
            { rect: sourceRect, windowId: sourceWindow.id },
            state.camera,
            state.viewport,
          ).map((handle) => (
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
          ))}
    </div>
  );
}
