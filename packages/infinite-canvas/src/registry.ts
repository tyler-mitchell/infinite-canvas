import { EMPTY_INFINITE_CANVAS_HISTORY } from "./history";
import { reconcileInfiniteCanvasGroups } from "./group-state";
import { EMPTY_INFINITE_CANVAS_SELECTION, normalizeSelection } from "./selection";
import type {
  InfiniteCanvasState,
  InfiniteCanvasWindow,
  InfiniteCanvasWindowRegistry,
} from "./types";
import { getUniqueInfiniteCanvasWindows } from "./window-identity";

function getRegisteredInfiniteCanvasWindowKinds<Kind extends string>(
  registry: InfiniteCanvasWindowRegistry<Kind>,
) {
  return Object.keys(registry) as Kind[];
}

function isRegisteredInfiniteCanvasWindowKind<Kind extends string>(
  registry: InfiniteCanvasWindowRegistry<Kind>,
  kind: string,
): kind is Kind {
  return Object.prototype.hasOwnProperty.call(registry, kind);
}

function isRegisteredInfiniteCanvasWindow<Kind extends string>(
  registry: InfiniteCanvasWindowRegistry<Kind>,
  window: Pick<InfiniteCanvasWindow, "kind">,
): window is InfiniteCanvasWindow<Kind> {
  return isRegisteredInfiniteCanvasWindowKind(registry, window.kind);
}

function getUnknownInfiniteCanvasWindowKinds<Kind extends string>(
  state: InfiniteCanvasState<string>,
  registry: InfiniteCanvasWindowRegistry<Kind>,
) {
  return [
    ...new Set(
      state.windows
        .filter((window) => !isRegisteredInfiniteCanvasWindowKind(registry, window.kind))
        .map((window) => window.kind),
    ),
  ];
}

function getFallbackActiveWindowId<Kind extends string>(
  windows: readonly InfiniteCanvasWindow<Kind>[],
) {
  return windows.filter((window) => window.mode !== "minimized").at(-1)?.id ?? null;
}

function normalizeInfiniteCanvasStateForWindowRegistry<Kind extends string>(
  state: InfiniteCanvasState<string>,
  registry: InfiniteCanvasWindowRegistry<Kind>,
): InfiniteCanvasState<Kind> | null {
  if (state.windows.length === 0) {
    // No windows means no group can hold one. Dropping the shells here is what
    // stops a stale tree from laying out ghosts.
    return {
      ...state,
      activeWindowId: null,
      groups: [],
      history: EMPTY_INFINITE_CANVAS_HISTORY,
      selection: EMPTY_INFINITE_CANVAS_SELECTION,
      windows: [],
    };
  }

  const windows = getUniqueInfiniteCanvasWindows(
    state.windows.filter((window) => isRegisteredInfiniteCanvasWindow(registry, window)),
  );

  if (windows.length === 0) {
    return null;
  }

  const windowIds = windows.map((window) => window.id);
  const activeWindowId =
    state.activeWindowId !== null && windowIds.includes(state.activeWindowId)
      ? state.activeWindowId
      : getFallbackActiveWindowId(windows);
  const unnormalizedState = {
    ...state,
    activeWindowId,
    // Normalization runs at document boundaries -- mount and hydrate -- and it
    // drops windows whose kind left the registry. Every document in the stack
    // refers to windows from before that pass, so the stack is stale by
    // definition. It also re-types the canvas from `string` to `Kind`.
    history: EMPTY_INFINITE_CANVAS_HISTORY,
    windows,
  } satisfies InfiniteCanvasState<Kind>;
  const selection = normalizeSelection(unnormalizedState, state.selection);

  // A persisted group can name a window whose `kind` has since left the registry,
  // or one a duplicate-id pass dropped. Reconciling removes those members, and
  // any shell they emptied, then re-projects the survivors onto their rects.
  return reconcileInfiniteCanvasGroups({
    ...unnormalizedState,
    activeWindowId: selection.anchorWindowId ?? activeWindowId,
    selection,
  });
}

function assertInfiniteCanvasStateMatchesWindowRegistry<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
  registry: InfiniteCanvasWindowRegistry<Kind>,
): InfiniteCanvasState<Kind> {
  const unknownKinds = getUnknownInfiniteCanvasWindowKinds(state, registry);

  if (unknownKinds.length > 0) {
    const registeredKinds = getRegisteredInfiniteCanvasWindowKinds(registry);

    throw new Error(
      [
        `InfiniteCanvas initialState includes unregistered window kind(s): ${unknownKinds.join(", ")}.`,
        `Registered kind(s): ${registeredKinds.length === 0 ? "(none)" : registeredKinds.join(", ")}.`,
      ].join(" "),
    );
  }

  const normalized = normalizeInfiniteCanvasStateForWindowRegistry(state, registry);

  if (normalized === null) {
    throw new Error("InfiniteCanvas initialState windows must use registered window kinds.");
  }

  return normalized;
}

function recoverInfiniteCanvasStateForWindowRegistry<Kind extends string>(
  state: InfiniteCanvasState<string>,
  registry: InfiniteCanvasWindowRegistry<Kind>,
): InfiniteCanvasState<Kind> {
  return (
    normalizeInfiniteCanvasStateForWindowRegistry(state, registry) ?? {
      ...state,
      activeWindowId: null,
      // Every window was unregistered, so every group is empty by definition.
      groups: [],
      history: EMPTY_INFINITE_CANVAS_HISTORY,
      interaction: null,
      selection: EMPTY_INFINITE_CANVAS_SELECTION,
      snapPreview: null,
      windows: [],
    }
  );
}

export {
  assertInfiniteCanvasStateMatchesWindowRegistry,
  getRegisteredInfiniteCanvasWindowKinds,
  getUnknownInfiniteCanvasWindowKinds,
  isRegisteredInfiniteCanvasWindow,
  isRegisteredInfiniteCanvasWindowKind,
  normalizeInfiniteCanvasStateForWindowRegistry,
  recoverInfiniteCanvasStateForWindowRegistry,
};
