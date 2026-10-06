import {
  findInfiniteCanvasGroup,
  getWindowLayoutContext,
  getWindowLayoutMembership,
  getInfiniteCanvasWindowGroup,
  setInfiniteCanvasGroupRect,
  setInfiniteCanvasGroupWindowNodeLayoutsInState,
} from "./group-state";
import { getCanvasLayout } from "./layout";
import { findWindow, updateWindowRect } from "./stacking";
import { isInfiniteCanvasWindowCapable } from "./window-capabilities";
import type {
  InfiniteCanvasGroup,
  InfiniteCanvasMoveOriginRect,
  InfiniteCanvasPoint,
  InfiniteCanvasState,
  InfiniteCanvasWindow,
  TransformTarget,
} from "./types";

type MoveTarget<Kind extends string> =
  | Readonly<{ type: "window"; window: InfiniteCanvasWindow<Kind> }>
  | Readonly<{ type: "group"; group: InfiniteCanvasGroup }>;

export function resolveInfiniteCanvasMoveTarget<Kind extends string>({
  state,
  target,
}: Readonly<{
  state: InfiniteCanvasState<Kind>;
  target: TransformTarget;
}>): MoveTarget<Kind> | null {
  if (target.type === "group") {
    const group = findInfiniteCanvasGroup(state, target.id);
    return group === null ? null : { type: "group", group };
  }
  const window = findWindow(state, target.id);
  if (window === null || window.mode === "minimized") return null;
  const group = getInfiniteCanvasWindowGroup(state, window.id);
  if (
    group !== null &&
    getWindowLayoutMembership(state, window.id)?.operations?.move === undefined
  ) {
    return { type: "group", group };
  }
  return isInfiniteCanvasWindowCapable(window, "movable") ? { type: "window", window } : null;
}

export function getInfiniteCanvasMovableSelection<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
) {
  const geometry = getCanvasLayout(state);
  const targets = state.selection.targets
    .flatMap((target) =>
      target.type === "window" || target.type === "group"
        ? [resolveInfiniteCanvasMoveTarget({ state, target: { type: target.type, id: target.id } })]
        : [],
    )
    .filter((target): target is MoveTarget<Kind> => target !== null);
  const groups = targets.filter((target) => target.type === "group");
  return targets
    .filter((target, index) => {
      if (target.type === "group") {
        return (
          targets.findIndex(
            (candidate) => candidate.type === "group" && candidate.group.id === target.group.id,
          ) === index
        );
      }
      const group = getInfiniteCanvasWindowGroup(state, target.window.id);
      return group === null || !groups.some((target) => target.group.id === group.id);
    })
    .map((target): InfiniteCanvasMoveOriginRect => {
      if (target.type === "group") {
        return {
          bounds: geometry.groupRects.get(target.group.id)!,
          rect: target.group.rect,
          target: { type: "group", id: target.group.id },
        };
      }

      return {
        bounds: geometry.windowRects.get(target.window.id)!,
        rect: target.window.rect,
        target: { type: "window", id: target.window.id },
      };
    });
}

export function moveInfiniteCanvasTargets<Kind extends string>({
  state,
  origins,
  delta,
}: Readonly<{
  state: InfiniteCanvasState<Kind>;
  origins: readonly InfiniteCanvasMoveOriginRect[];
  delta: InfiniteCanvasPoint;
}>) {
  const ordered = [
    ...origins.filter(({ target }) => target.type === "group"),
    ...origins.filter(({ target }) => target.type === "window"),
  ];
  return ordered.reduce((current, origin) => {
    const resolved = resolveInfiniteCanvasMoveTarget({ state: current, target: origin.target });
    if (resolved === null || resolved.type !== origin.target.type) return current;

    if (origin.target.type === "group") {
      return setInfiniteCanvasGroupRect(current, {
        groupId: origin.target.id,
        rect: { ...origin.rect, x: origin.rect.x + delta.x, y: origin.rect.y + delta.y },
      });
    }

    const rect = {
      ...origin.bounds,
      x: origin.bounds.x + delta.x,
      y: origin.bounds.y + delta.y,
    };
    const layoutContext = getWindowLayoutContext(current, origin.target.id);

    if (layoutContext === null) {
      return updateWindowRect(current, origin.target.id, rect);
    }

    const layouts = layoutContext.operations.move?.({
      ...layoutContext,
      windowId: origin.target.id,
      windowRect: rect,
    });

    if (layouts === undefined || Object.keys(layouts).length === 0) {
      return current;
    }

    return setInfiniteCanvasGroupWindowNodeLayoutsInState(current, {
      groupId: layoutContext.group.id,
      layouts,
    });
  }, state);
}
