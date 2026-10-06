import { getInfiniteCanvasGroupWindowIds } from "./group-tree";
import { isInfiniteCanvasWindowInActiveWorkspace } from "./workspace-membership";
import type {
  InfiniteCanvasSelection,
  InfiniteCanvasSelectionTarget,
  InfiniteCanvasState,
} from "./types";

export const EMPTY_INFINITE_CANVAS_SELECTION: InfiniteCanvasSelection = {
  anchorTarget: null,
  targets: [],
};

export function getSelectableWindowIds<Kind extends string>(state: InfiniteCanvasState<Kind>) {
  return state.windows
    .filter(
      (window) =>
        window.mode !== "minimized" && isInfiniteCanvasWindowInActiveWorkspace(state, window.id),
    )
    .map((window) => window.id);
}

export function getSelectedWindowIds(selection: InfiniteCanvasSelection) {
  return selection.targets.flatMap((target) => (target.type === "window" ? [target.id] : []));
}

export function getSelectionTargetKey(target: Pick<InfiniteCanvasSelectionTarget, "id" | "type">) {
  return target.type + ":" + target.id;
}

export function normalizeSelection<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  selection: InfiniteCanvasSelection,
): InfiniteCanvasSelection {
  const selectable = new Set(getSelectableWindowIds(state));
  const targets = [
    ...new Map(selection.targets.map((target) => [getSelectionTargetKey(target), target])).values(),
  ].filter((target) => {
    if (target.type === "window") return selectable.has(target.id);
    if (target.type === "group")
      return state.groups.some(
        (group) =>
          group.id === target.id &&
          getInfiniteCanvasGroupWindowIds(group.tree).some((id) => selectable.has(id)),
      );
    return true;
  });
  const anchorTarget =
    targets.find(
      (target) =>
        selection.anchorTarget !== null &&
        getSelectionTargetKey(target) === getSelectionTargetKey(selection.anchorTarget),
    ) ??
    targets.at(-1) ??
    null;
  return targets.length === selection.targets.length &&
    targets.every((target, index) => target === selection.targets[index]) &&
    anchorTarget === selection.anchorTarget
    ? selection
    : { anchorTarget, targets };
}

export function updateSelection<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  input: Readonly<{
    mode: "replace" | "add" | "remove" | "toggle";
    targets: readonly InfiniteCanvasSelectionTarget[];
    anchorTarget?: InfiniteCanvasSelectionTarget | null;
  }>,
) {
  const keys = new Set(input.targets.map(getSelectionTargetKey));
  const selected = new Set(state.selection.targets.map(getSelectionTargetKey));
  const added = input.targets.filter((target) => !selected.has(getSelectionTargetKey(target)));
  const retained = state.selection.targets.filter(
    (target) => !keys.has(getSelectionTargetKey(target)),
  );
  const changes = {
    replace: () => ({ targets: input.targets, anchorTarget: input.targets.at(-1) ?? null }),
    add: () => ({
      targets: [...state.selection.targets, ...input.targets],
      anchorTarget: input.targets.at(-1) ?? state.selection.anchorTarget,
    }),
    remove: () => ({ targets: retained, anchorTarget: state.selection.anchorTarget }),
    toggle: () => ({
      targets: [...retained, ...added],
      anchorTarget: added.at(-1) ?? state.selection.anchorTarget,
    }),
  }[input.mode]();
  const selection = normalizeSelection(
    state,
    input.anchorTarget === undefined ? changes : { ...changes, anchorTarget: input.anchorTarget },
  );
  const activeWindowId =
    selection.anchorTarget?.type === "window"
      ? selection.anchorTarget.id
      : (getSelectedWindowIds(selection).at(-1) ?? null);
  return { ...state, activeWindowId, selection };
}

export function isSelectionTargetSelected(
  selection: InfiniteCanvasSelection,
  target: Pick<InfiniteCanvasSelectionTarget, "id" | "type">,
) {
  return selection.targets.some(
    (selected) => getSelectionTargetKey(selected) === getSelectionTargetKey(target),
  );
}
