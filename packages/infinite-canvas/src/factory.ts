import { DEFAULT_INFINITE_CANVAS_CAMERA } from "./constants";
import { reconcileInfiniteCanvasGroups } from "./group-state";
import { normalizeSelection } from "./selection";
import { getUniqueInfiniteCanvasWindows } from "./window-identity";
import type {
  InfiniteCanvasCamera,
  InfiniteCanvasGroup,
  InfiniteCanvasRect,
  InfiniteCanvasSelection,
  InfiniteCanvasSize,
  InfiniteCanvasState,
  InfiniteCanvasViewport,
  InfiniteCanvasWindow,
  InfiniteCanvasWindowMode,
  InfiniteCanvasWindowRegistry,
} from "./types";

type InfiniteCanvasWindowInput<Kind extends string, Data = unknown> = Readonly<{
  data?: Data;
  id: string;
  isPinned?: boolean;
  kind: Kind;
  minSize?: InfiniteCanvasSize;
  mode?: InfiniteCanvasWindowMode;
  rect: InfiniteCanvasRect;
  restoreRect?: InfiniteCanvasRect;
  title?: string;
  zIndex?: number;
}>;

type InfiniteCanvasStateInput<Kind extends string> = Readonly<{
  activeWindowId?: string | null;
  camera?: InfiniteCanvasCamera;
  groups?: readonly InfiniteCanvasGroup[];
  selection?: InfiniteCanvasSelection | readonly string[];
  viewport?: InfiniteCanvasViewport;
  windows: readonly InfiniteCanvasWindow<Kind>[];
}>;

const EMPTY_INFINITE_CANVAS_STATE_SELECTION: InfiniteCanvasSelection = {
  anchorWindowId: null,
  windowIds: [],
};

const DEFAULT_INFINITE_CANVAS_VIEWPORT: InfiniteCanvasViewport = {
  height: 0,
  width: 0,
};

function cloneSize(size: InfiniteCanvasSize): InfiniteCanvasSize {
  return {
    height: size.height,
    width: size.width,
  };
}

function cloneRect(rect: InfiniteCanvasRect): InfiniteCanvasRect {
  return {
    ...cloneSize(rect),
    x: rect.x,
    y: rect.y,
  };
}

function createDefaultWindowMinSize(rect: InfiniteCanvasRect): InfiniteCanvasSize {
  return {
    height: Math.min(rect.height, 160),
    width: Math.min(rect.width, 240),
  };
}

function createInfiniteCanvasWindow<Kind extends string, Data = unknown>({
  data,
  id,
  isPinned = false,
  kind,
  minSize,
  mode = "normal",
  rect,
  restoreRect,
  title = id,
  zIndex = 0,
}: InfiniteCanvasWindowInput<Kind, Data>): InfiniteCanvasWindow<Kind, Data> {
  return {
    ...(data === undefined ? {} : { data }),
    id,
    isPinned,
    kind,
    minSize: cloneSize(minSize ?? createDefaultWindowMinSize(rect)),
    mode,
    rect: cloneRect(rect),
    restoreRect: restoreRect === undefined ? undefined : cloneRect(restoreRect),
    title,
    zIndex,
  };
}

function getFirstSelectableWindowId<Kind extends string>(
  windows: readonly InfiniteCanvasWindow<Kind>[],
) {
  return windows.find((window) => window.mode !== "minimized")?.id ?? null;
}

function isSelectionWindowIdInput(
  selection: InfiniteCanvasSelection | readonly string[] | undefined,
): selection is readonly string[] {
  return Array.isArray(selection);
}

function readSelectionInput(
  selection: InfiniteCanvasSelection | readonly string[] | undefined,
  activeWindowId: string | null,
): InfiniteCanvasSelection {
  if (selection === undefined) {
    return activeWindowId === null
      ? EMPTY_INFINITE_CANVAS_STATE_SELECTION
      : {
          anchorWindowId: activeWindowId,
          windowIds: [activeWindowId],
        };
  }

  return isSelectionWindowIdInput(selection)
    ? {
        anchorWindowId: selection.at(-1) ?? null,
        windowIds: selection,
      }
    : selection;
}

function createInfiniteCanvasState<Kind extends string>({
  activeWindowId,
  camera = DEFAULT_INFINITE_CANVAS_CAMERA,
  groups = [],
  selection,
  viewport = DEFAULT_INFINITE_CANVAS_VIEWPORT,
  windows,
}: InfiniteCanvasStateInput<Kind>): InfiniteCanvasState<Kind> {
  const uniqueWindows = getUniqueInfiniteCanvasWindows(windows);
  const windowIds = uniqueWindows.map((window) => window.id);
  const resolvedActiveWindowId =
    activeWindowId !== undefined && (activeWindowId === null || windowIds.includes(activeWindowId))
      ? activeWindowId
      : getFirstSelectableWindowId(uniqueWindows);
  const unnormalizedState = {
    activeWindowId: resolvedActiveWindowId,
    camera: {
      center: {
        x: camera.center.x,
        y: camera.center.y,
      },
      zoom: camera.zoom,
    },
    groups,
    interaction: null,
    selection: readSelectionInput(selection, resolvedActiveWindowId),
    snapPreview: null,
    viewport: cloneSize(viewport),
    windows: uniqueWindows.map((window) =>
      createInfiniteCanvasWindow({
        ...window,
        minSize: window.minSize,
        rect: window.rect,
        restoreRect: window.restoreRect,
      }),
    ),
  } satisfies InfiniteCanvasState<Kind>;
  const normalizedSelection = normalizeSelection(unnormalizedState, unnormalizedState.selection);

  // Groups supplied by a consumer are untrusted the same way persisted ones are:
  // reconcile drops members that name no live window, and projects the rest onto
  // their windows' rects.
  return reconcileInfiniteCanvasGroups({
    ...unnormalizedState,
    activeWindowId: normalizedSelection.anchorWindowId ?? resolvedActiveWindowId,
    selection: normalizedSelection,
  });
}

function defineInfiniteCanvasWindowRegistry<Kind extends string>(
  registry: InfiniteCanvasWindowRegistry<Kind>,
) {
  const registryEntries = Object.entries(registry) as readonly [
    string,
    InfiniteCanvasWindowRegistry<Kind>[Kind],
  ][];
  const mismatchedKinds = registryEntries
    .filter(([kind, definition]) => definition.kind !== kind)
    .map(([kind, definition]) => `${kind} declares ${definition.kind}`);

  if (mismatchedKinds.length > 0) {
    throw new Error(
      `InfiniteCanvas window registry keys must match definition.kind: ${mismatchedKinds.join(", ")}.`,
    );
  }

  return registry;
}

/**
 * Read a window's consumer-owned `data` payload through a type guard,
 * replacing the `typeof window.data === "object" && "field" in window.data`
 * boilerplate every renderBody otherwise repeats. Returns null when the
 * payload is absent or fails the guard.
 */
function getInfiniteCanvasWindowData<Data>(
  window: Readonly<{ data?: unknown }>,
  guard: (candidate: unknown) => candidate is Data,
): Data | null {
  return guard(window.data) ? window.data : null;
}

export {
  createInfiniteCanvasState,
  createInfiniteCanvasWindow,
  defineInfiniteCanvasWindowRegistry,
  getInfiniteCanvasWindowData,
};

export type { InfiniteCanvasStateInput, InfiniteCanvasWindowInput };
