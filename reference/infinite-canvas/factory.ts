import { DEFAULT_INFINITE_CANVAS_CAMERA } from "#/experiments/infinite-canvas/constants";
import { normalizeSelection } from "#/experiments/infinite-canvas/selection";
import { getUniqueInfiniteCanvasWindows } from "#/experiments/infinite-canvas/window-identity";
import type {
  InfiniteCanvasCamera,
  InfiniteCanvasRect,
  InfiniteCanvasSelection,
  InfiniteCanvasSize,
  InfiniteCanvasState,
  InfiniteCanvasViewport,
  InfiniteCanvasWindow,
  InfiniteCanvasWindowMode,
  InfiniteCanvasWindowRegistry,
} from "#/experiments/infinite-canvas/types";

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

  return {
    ...unnormalizedState,
    activeWindowId: normalizedSelection.anchorWindowId ?? resolvedActiveWindowId,
    selection: normalizedSelection,
  };
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

export {
  createInfiniteCanvasState,
  createInfiniteCanvasWindow,
  defineInfiniteCanvasWindowRegistry,
};

export type { InfiniteCanvasStateInput, InfiniteCanvasWindowInput };
