import { unionRects } from "./geometry";
import type {
  InfiniteCanvasRect,
  InfiniteCanvasSelection,
  InfiniteCanvasSelectionTarget,
  InfiniteCanvasState,
  InfiniteCanvasWindow,
} from "./types";

const EMPTY_INFINITE_CANVAS_SELECTION: InfiniteCanvasSelection = {
  anchorWindowId: null,
  windowIds: [],
};

function isSelectableWindow(window: Pick<InfiniteCanvasWindow, "mode">) {
  return window.mode !== "minimized";
}

function getSelectableWindowIds<Kind extends string>(state: InfiniteCanvasState<Kind>) {
  return state.windows.filter(isSelectableWindow).map((window) => window.id);
}

function normalizeSelectionWindowIds<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  windowIds: readonly string[],
) {
  const selectableWindowIds = getSelectableWindowIds(state);

  return windowIds.filter(
    (windowId, index) =>
      windowIds.indexOf(windowId) === index && selectableWindowIds.includes(windowId),
  );
}

function getSelectionTargetKey(target: Pick<InfiniteCanvasSelectionTarget, "id" | "type">) {
  return `${target.type}:${target.id}`;
}

function areSelectionTargetsEqual(
  left: InfiniteCanvasSelectionTarget,
  right: InfiniteCanvasSelectionTarget,
) {
  return getSelectionTargetKey(left) === getSelectionTargetKey(right);
}

function getSelectionTargets(selection: InfiniteCanvasSelection) {
  return selection.targets ?? [];
}

function getSelectionAnchorTarget(selection: InfiniteCanvasSelection) {
  return selection.anchorTarget ?? null;
}

function normalizeSelectionTargets(targets: readonly InfiniteCanvasSelectionTarget[]) {
  return targets.filter(
    (target, index) =>
      targets.findIndex((candidate) => areSelectionTargetsEqual(candidate, target)) === index,
  );
}

function withOptionalSelectionTargets(
  selection: Pick<InfiniteCanvasSelection, "anchorWindowId" | "windowIds"> &
    Readonly<{
      anchorTarget?: InfiniteCanvasSelectionTarget | null;
      targets?: readonly InfiniteCanvasSelectionTarget[];
    }>,
): InfiniteCanvasSelection {
  const targets = normalizeSelectionTargets(selection.targets ?? []);
  const anchorTarget =
    targets.find((target) =>
      selection.anchorTarget === undefined || selection.anchorTarget === null
        ? false
        : areSelectionTargetsEqual(target, selection.anchorTarget),
    ) ??
    targets.at(-1) ??
    null;

  return {
    anchorWindowId: selection.anchorWindowId,
    ...(targets.length === 0
      ? {}
      : {
          anchorTarget,
          targets,
        }),
    windowIds: selection.windowIds,
  };
}

function createSelection(windowIds: readonly string[]): InfiniteCanvasSelection {
  return {
    anchorWindowId: windowIds.at(-1) ?? null,
    windowIds,
  };
}

function normalizeSelection<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  selection: InfiniteCanvasSelection,
) {
  const windowIds = normalizeSelectionWindowIds(state, selection.windowIds);
  const anchorWindowId =
    selection.anchorWindowId !== null && windowIds.includes(selection.anchorWindowId)
      ? selection.anchorWindowId
      : (windowIds.at(-1) ?? null);

  return withOptionalSelectionTargets({
    anchorTarget: getSelectionAnchorTarget(selection),
    anchorWindowId,
    targets: getSelectionTargets(selection),
    windowIds,
  });
}

function applySelection<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  selection: InfiniteCanvasSelection,
) {
  const normalizedSelection = normalizeSelection(state, selection);

  return {
    ...state,
    activeWindowId: normalizedSelection.anchorWindowId,
    selection: normalizedSelection,
  };
}

function replaceSelection<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  windowIds: readonly string[],
) {
  return applySelection(state, createSelection(normalizeSelectionWindowIds(state, windowIds)));
}

function addSelection<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  windowIds: readonly string[],
) {
  const addedWindowIds = normalizeSelectionWindowIds(state, windowIds);
  const nextWindowIds = normalizeSelectionWindowIds(state, [
    ...state.selection.windowIds,
    ...addedWindowIds,
  ]);

  return applySelection(state, {
    anchorWindowId: addedWindowIds.at(-1) ?? state.selection.anchorWindowId,
    anchorTarget: getSelectionAnchorTarget(state.selection),
    targets: getSelectionTargets(state.selection),
    windowIds: nextWindowIds,
  });
}

function removeSelection<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  windowIds: readonly string[],
) {
  const removedWindowIds = normalizeSelectionWindowIds(state, windowIds);
  const nextWindowIds = state.selection.windowIds.filter(
    (windowId) => !removedWindowIds.includes(windowId),
  );

  return applySelection(state, {
    ...createSelection(nextWindowIds),
    anchorTarget: getSelectionAnchorTarget(state.selection),
    targets: getSelectionTargets(state.selection),
  });
}

function toggleSelection<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  windowIds: readonly string[],
) {
  const toggledWindowIds = normalizeSelectionWindowIds(state, windowIds);
  const nextWindowIds = toggledWindowIds.reduce(
    (selectedWindowIds, windowId) =>
      selectedWindowIds.includes(windowId)
        ? selectedWindowIds.filter((selectedWindowId) => selectedWindowId !== windowId)
        : [...selectedWindowIds, windowId],
    state.selection.windowIds,
  );
  const lastToggledOnWindowId =
    toggledWindowIds.filter((windowId) => !state.selection.windowIds.includes(windowId)).at(-1) ??
    null;

  return applySelection(state, {
    anchorWindowId: lastToggledOnWindowId ?? nextWindowIds.at(-1) ?? null,
    anchorTarget: getSelectionAnchorTarget(state.selection),
    targets: getSelectionTargets(state.selection),
    windowIds: nextWindowIds,
  });
}

function replaceTargetSelection<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  targets: readonly InfiniteCanvasSelectionTarget[],
) {
  const nextTargets = normalizeSelectionTargets(targets);

  return applySelection(
    state,
    withOptionalSelectionTargets({
      anchorTarget: nextTargets.at(-1) ?? null,
      anchorWindowId: null,
      targets: nextTargets,
      windowIds: [],
    }),
  );
}

function addTargetSelection<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  targets: readonly InfiniteCanvasSelectionTarget[],
) {
  const addedTargets = normalizeSelectionTargets(targets);
  const nextTargets = normalizeSelectionTargets([
    ...getSelectionTargets(state.selection),
    ...addedTargets,
  ]);

  return applySelection(
    state,
    withOptionalSelectionTargets({
      anchorTarget: addedTargets.at(-1) ?? getSelectionAnchorTarget(state.selection),
      anchorWindowId: state.selection.anchorWindowId,
      targets: nextTargets,
      windowIds: state.selection.windowIds,
    }),
  );
}

function removeTargetSelection<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  targets: readonly InfiniteCanvasSelectionTarget[],
) {
  const removedKeys = normalizeSelectionTargets(targets).map(getSelectionTargetKey);
  const nextTargets = getSelectionTargets(state.selection).filter(
    (target) => !removedKeys.includes(getSelectionTargetKey(target)),
  );

  return applySelection(
    state,
    withOptionalSelectionTargets({
      anchorTarget: nextTargets.at(-1) ?? null,
      anchorWindowId: state.selection.anchorWindowId,
      targets: nextTargets,
      windowIds: state.selection.windowIds,
    }),
  );
}

function toggleTargetSelection<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  targets: readonly InfiniteCanvasSelectionTarget[],
) {
  const toggledTargets = normalizeSelectionTargets(targets);
  const selectedTargets = getSelectionTargets(state.selection);
  const nextTargets = toggledTargets.reduce(
    (selectionTargets, target) =>
      selectionTargets.some((selectedTarget) => areSelectionTargetsEqual(selectedTarget, target))
        ? selectionTargets.filter(
            (selectedTarget) => !areSelectionTargetsEqual(selectedTarget, target),
          )
        : [...selectionTargets, target],
    selectedTargets,
  );
  const lastToggledOnTarget =
    toggledTargets
      .filter(
        (target) =>
          !selectedTargets.some((selectedTarget) =>
            areSelectionTargetsEqual(selectedTarget, target),
          ),
      )
      .at(-1) ?? null;

  return applySelection(
    state,
    withOptionalSelectionTargets({
      anchorTarget: lastToggledOnTarget ?? nextTargets.at(-1) ?? null,
      anchorWindowId: state.selection.anchorWindowId,
      targets: nextTargets,
      windowIds: state.selection.windowIds,
    }),
  );
}

function clearSelection<Kind extends string>(state: InfiniteCanvasState<Kind>) {
  return {
    ...state,
    activeWindowId: null,
    selection: EMPTY_INFINITE_CANVAS_SELECTION,
  };
}

function selectAllVisibleWindows<Kind extends string>(state: InfiniteCanvasState<Kind>) {
  return replaceSelection(state, getSelectableWindowIds(state));
}

function getWindowBounds<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  windowIds: readonly string[],
): InfiniteCanvasRect | null {
  return unionRects(
    state.windows
      .filter((window) => windowIds.includes(window.id) && isSelectableWindow(window))
      .map((window) => window.rect),
  );
}

function getSelectedWindowBounds<Kind extends string>(state: InfiniteCanvasState<Kind>) {
  return getWindowBounds(state, state.selection.windowIds);
}

function getVisibleWindowBounds<Kind extends string>(state: InfiniteCanvasState<Kind>) {
  return getWindowBounds(state, getSelectableWindowIds(state));
}

function cleanSelection<Kind extends string>(state: InfiniteCanvasState<Kind>) {
  return applySelection(state, state.selection);
}

function isWindowSelected<Kind extends string>(state: InfiniteCanvasState<Kind>, windowId: string) {
  return state.selection.windowIds.includes(windowId);
}

function isSelectionTargetSelected<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  target: Pick<InfiniteCanvasSelectionTarget, "id" | "type">,
) {
  return getSelectionTargets(state.selection).some(
    (selectedTarget) => getSelectionTargetKey(selectedTarget) === getSelectionTargetKey(target),
  );
}

function hasInfiniteCanvasSelection(selection: InfiniteCanvasSelection) {
  return selection.windowIds.length > 0 || getSelectionTargets(selection).length > 0;
}

export {
  EMPTY_INFINITE_CANVAS_SELECTION,
  addSelection,
  addTargetSelection,
  cleanSelection,
  clearSelection,
  getSelectableWindowIds,
  getSelectionAnchorTarget,
  getSelectionTargetKey,
  getSelectionTargets,
  getSelectedWindowBounds,
  getVisibleWindowBounds,
  getWindowBounds,
  hasInfiniteCanvasSelection,
  isSelectionTargetSelected,
  isSelectableWindow,
  isWindowSelected,
  normalizeSelection,
  normalizeSelectionTargets,
  normalizeSelectionWindowIds,
  removeSelection,
  removeTargetSelection,
  replaceSelection,
  replaceTargetSelection,
  selectAllVisibleWindows,
  toggleSelection,
  toggleTargetSelection,
};
