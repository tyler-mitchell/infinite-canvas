import {
  EMPTY_INFINITE_CANVAS_SELECTION,
  normalizeSelection,
} from "#/experiments/infinite-canvas/selection";
import type {
  InfiniteCanvasState,
  InfiniteCanvasWindow,
  InfiniteCanvasWindowRegistry,
} from "#/experiments/infinite-canvas/types";
import { getUniqueInfiniteCanvasWindows } from "#/experiments/infinite-canvas/window-identity";

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
    return {
      ...state,
      activeWindowId: null,
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
    windows,
  } satisfies InfiniteCanvasState<Kind>;
  const selection = normalizeSelection(unnormalizedState, state.selection);

  return {
    ...unnormalizedState,
    activeWindowId: selection.anchorWindowId ?? activeWindowId,
    selection,
  };
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
