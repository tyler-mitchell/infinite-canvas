import { DEFAULT_INFINITE_CANVAS_CAMERA, resolveInfiniteCanvasViewportInsets } from "./constants";
import { resolveInfiniteCanvasGroupMetrics } from "./group-layout";
import { reconcileInfiniteCanvasGroups } from "./group-state";
import { EMPTY_INFINITE_CANVAS_HISTORY } from "./history";
import { normalizeSelection } from "./selection";
import { getUniqueInfiniteCanvasWindows } from "./window-identity";
import type {
  InfiniteCanvasCamera,
  InfiniteCanvasGroup,
  InfiniteCanvasGroupMetricsInput,
  InfiniteCanvasRect,
  InfiniteCanvasSelection,
  InfiniteCanvasSize,
  InfiniteCanvasState,
  InfiniteCanvasViewport,
  InfiniteCanvasViewportInsetsInput,
  InfiniteCanvasViewportOccluder,
  InfiniteCanvasWindow,
  InfiniteCanvasWindowDefinition,
  InfiniteCanvasWindowCapabilities,
  InfiniteCanvasWorkspace,
  InfiniteCanvasWindowMode,
  InfiniteCanvasWindowRegistry,
  InfiniteCanvasWindowRegistryInput,
} from "./types";

type InfiniteCanvasWindowInput<Kind extends string, Data = unknown> = Readonly<{
  capabilities?: InfiniteCanvasWindowCapabilities;
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
  workspaces?: readonly InfiniteCanvasWorkspace[];
  activeWindowId?: string | null;
  camera?: InfiniteCanvasCamera;
  groupMetrics?: InfiniteCanvasGroupMetricsInput;
  groups?: readonly InfiniteCanvasGroup[];
  selection?: InfiniteCanvasSelection | readonly string[];
  viewport?: InfiniteCanvasViewport;
  viewportInsets?: InfiniteCanvasViewportInsetsInput;
  viewportOccluders?: readonly InfiniteCanvasViewportOccluder[];
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
  capabilities,
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
    // Omit default capabilities to keep persisted windows small.
    ...(capabilities === undefined ? {} : { capabilities }),
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
  groupMetrics,
  groups = [],
  selection,
  viewport = DEFAULT_INFINITE_CANVAS_VIEWPORT,
  viewportInsets,
  viewportOccluders = [],
  windows,
  workspaces = [],
}: InfiniteCanvasStateInput<Kind>): InfiniteCanvasState<Kind> {
  const uniqueWindows = getUniqueInfiniteCanvasWindows(windows);
  const windowIds = uniqueWindows.map((window) => window.id);
  const resolvedActiveWindowId =
    activeWindowId !== undefined && (activeWindowId === null || windowIds.includes(activeWindowId))
      ? activeWindowId
      : getFirstSelectableWindowId(uniqueWindows);
  const unnormalizedState = {
    activeWindowId: resolvedActiveWindowId,
    activeWorkspaceId: null,
    workspaces,
    camera: {
      center: {
        x: camera.center.x,
        y: camera.center.y,
      },
      zoom: camera.zoom,
    },
    groupMetrics: resolveInfiniteCanvasGroupMetrics(groupMetrics),
    groups,
    history: EMPTY_INFINITE_CANVAS_HISTORY,
    interaction: null,
    selection: readSelectionInput(selection, resolvedActiveWindowId),
    snapPreview: null,
    viewport: cloneSize(viewport),
    viewportInsets: resolveInfiniteCanvasViewportInsets(viewportInsets),
    viewportOccluders,
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

  // Reconcile consumer groups before projecting their window rectangles.
  return reconcileInfiniteCanvasGroups({
    ...unnormalizedState,
    activeWindowId: normalizedSelection.anchorWindowId ?? resolvedActiveWindowId,
    selection: normalizedSelection,
  });
}

/** Defines a registry with per-kind authoring types. Persisted `data` remains unknown. */
function defineInfiniteCanvasWindowRegistry<
  Kind extends string,
  DataByKind extends Readonly<Record<Kind, unknown>> = Readonly<Record<Kind, unknown>>,
>(
  registry: InfiniteCanvasWindowRegistryInput<Kind, DataByKind>,
): InfiniteCanvasWindowRegistry<Kind> {
  const registryEntries = Object.entries(registry) as readonly [
    string,
    InfiniteCanvasWindowDefinition<Kind>,
  ][];
  const mismatchedKinds = registryEntries
    .filter(([kind, definition]) => definition.kind !== kind)
    .map(([kind, definition]) => `${kind} declares ${definition.kind}`);

  if (mismatchedKinds.length > 0) {
    throw new Error(
      `InfiniteCanvas window registry keys must match definition.kind: ${mismatchedKinds.join(", ")}.`,
    );
  }

  // This cast erases authoring types because runtime data remains unknown.
  return registry as unknown as InfiniteCanvasWindowRegistry<Kind>;
}

/** Reads `data` through a guard and returns `null` when it is invalid. */
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
