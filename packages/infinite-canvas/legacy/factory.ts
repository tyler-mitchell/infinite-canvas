import { DEFAULT_INFINITE_CANVAS_CAMERA, resolveInfiniteCanvasViewportInsets } from "./constants";
import { resolveInfiniteCanvasGroupMetrics } from "./layout";
import { reconcileInfiniteCanvasGroups } from "./group-state";
import {
  EMPTY_INFINITE_CANVAS_SELECTION,
  getSelectableWindowIds,
  getSelectedWindowIds,
  normalizeSelection,
} from "./selection";
import { getNextVisibleWindowId } from "./stacking";
import { reconcileInfiniteCanvasWorkspaces } from "./workspace";
import { getUniqueInfiniteCanvasWindows } from "./window-identity";
import type {
  InfiniteCanvasCamera,
  InfiniteCanvasConnection,
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
  InfiniteCanvasWorkspace,
  InfiniteCanvasWindowRegistry,
  InfiniteCanvasWindowRegistryInput,
} from "./types";

type InfiniteCanvasWindowInput<Kind extends string, Data = unknown> = Readonly<
  Pick<InfiniteCanvasWindow<Kind, Data>, "id" | "kind" | "rect"> &
    Partial<Omit<InfiniteCanvasWindow<Kind, Data>, "id" | "kind" | "rect">>
>;

type InfiniteCanvasStateInput<Kind extends string> = Readonly<{
  activeWorkspaceId?: string | null;
  workspaces?: readonly InfiniteCanvasWorkspace[];
  activeWindowId?: string | null;
  camera?: InfiniteCanvasCamera;
  connections?: readonly InfiniteCanvasConnection[];
  groupMetrics?: InfiniteCanvasGroupMetricsInput;
  groups?: readonly InfiniteCanvasGroup[];
  selection?: InfiniteCanvasSelection | readonly string[];
  viewport?: InfiniteCanvasViewport;
  viewportInsets?: InfiniteCanvasViewportInsetsInput;
  viewportOccluders?: readonly InfiniteCanvasViewportOccluder[];
  windows: readonly InfiniteCanvasWindowInput<Kind>[];
}>;

const DEFAULT_INFINITE_CANVAS_VIEWPORT: InfiniteCanvasViewport = {
  height: 0,
  width: 0,
};

function createDefaultWindowMinSize(rect: InfiniteCanvasRect): InfiniteCanvasSize {
  return {
    height: Math.min(rect.height, 160),
    width: Math.min(rect.width, 240),
  };
}

function createInfiniteCanvasWindow<Kind extends string, Data = unknown>({
  aspectRatio,
  capabilities,
  contentSize,
  data,
  id,
  isPinned = false,
  kind,
  minSize,
  mode = "normal",
  heightMode,
  rect,
  restoreRect,
  title = id,
  zIndex = 0,
}: InfiniteCanvasWindowInput<Kind, Data>): InfiniteCanvasWindow<Kind, Data> {
  return {
    ...(aspectRatio === undefined ? {} : { aspectRatio }),
    // Omit default capabilities to keep persisted windows small.
    ...(capabilities === undefined ? {} : { capabilities }),
    ...(contentSize === undefined ? {} : { contentSize }),
    ...(data === undefined ? {} : { data }),
    id,
    isPinned,
    kind,
    minSize: { ...(minSize ?? createDefaultWindowMinSize(rect)) },
    mode,
    ...(heightMode === undefined ? {} : { heightMode }),
    rect: { ...rect },
    ...(restoreRect === undefined ? {} : { restoreRect: { ...restoreRect } }),
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
      ? EMPTY_INFINITE_CANVAS_SELECTION
      : {
          anchorTarget: { type: "window", id: activeWindowId },
          targets: [{ type: "window", id: activeWindowId }],
        };
  }

  if (!isSelectionWindowIdInput(selection)) return selection;
  const targets = selection.map((id) => ({ type: "window" as const, id }));
  return { anchorTarget: targets.at(-1) ?? null, targets };
}

function createInfiniteCanvasState<Kind extends string>({
  activeWindowId,
  activeWorkspaceId = null,
  camera = DEFAULT_INFINITE_CANVAS_CAMERA,
  connections = [],
  groupMetrics,
  groups = [],
  selection,
  viewport = DEFAULT_INFINITE_CANVAS_VIEWPORT,
  viewportInsets,
  viewportOccluders = [],
  windows,
  workspaces = [],
}: InfiniteCanvasStateInput<Kind>): InfiniteCanvasState<Kind> {
  const uniqueWindows = getUniqueInfiniteCanvasWindows(
    windows.map((window) => createInfiniteCanvasWindow(window)),
  );
  const windowIds = uniqueWindows
    .filter((window) => window.mode !== "minimized")
    .map((window) => window.id);
  const resolvedActiveWindowId =
    activeWindowId !== undefined && (activeWindowId === null || windowIds.includes(activeWindowId))
      ? activeWindowId
      : getFirstSelectableWindowId(uniqueWindows);
  const unnormalizedState = {
    activeWindowId: resolvedActiveWindowId,
    activeWorkspaceId,
    workspaces,
    camera: {
      center: {
        x: camera.center.x,
        y: camera.center.y,
      },
      zoom: camera.zoom,
    },
    connections,
    groupMetrics: resolveInfiniteCanvasGroupMetrics(groupMetrics),
    groups,
    interaction: null,
    selection: readSelectionInput(selection, resolvedActiveWindowId),
    snapPreview: null,
    viewport: { ...viewport },
    viewportInsets: resolveInfiniteCanvasViewportInsets(viewportInsets),
    viewportOccluders,
    windows: uniqueWindows,
  } satisfies InfiniteCanvasState<Kind>;
  return reconcileInfiniteCanvasState({ state: unnormalizedState });
}

export function reconcileInfiniteCanvasState<Kind extends string>({
  state,
  previousState,
}: Readonly<{
  state: InfiniteCanvasState<Kind>;
  previousState?: InfiniteCanvasState<Kind>;
}>): InfiniteCanvasState<Kind> {
  if (
    previousState !== undefined &&
    state.windows === previousState.windows &&
    state.groups === previousState.groups &&
    state.workspaces === previousState.workspaces &&
    state.activeWorkspaceId === previousState.activeWorkspaceId &&
    state.connections === previousState.connections
  )
    return state;

  const grouped = reconcileInfiniteCanvasGroups(state);
  const normalized = reconcileInfiniteCanvasWorkspaces(grouped);
  const windowIds = new Set(normalized.windows.map((window) => window.id));
  const removedWindowIds = new Set(
    previousState?.windows.filter((window) => !windowIds.has(window.id)).map((window) => window.id),
  );
  const connections = normalized.connections.filter(
    (connection) => !removedWindowIds.has(connection.from) && !removedWindowIds.has(connection.to),
  );
  const normalizedSelection = normalizeSelection(normalized, normalized.selection);
  const selectableWindowIds = new Set(getSelectableWindowIds(normalized));
  const removedActive =
    previousState?.activeWindowId !== undefined &&
    previousState.activeWindowId !== null &&
    !selectableWindowIds.has(previousState.activeWindowId);
  const needsFallback = removedActive && normalizedSelection.targets.length === 0;
  const fallbackWindowId = needsFallback
    ? getNextVisibleWindowId(
        normalized.windows.filter((window) => selectableWindowIds.has(window.id)),
      )
    : null;
  const selection =
    fallbackWindowId === null
      ? normalizedSelection
      : {
          anchorTarget: { type: "window" as const, id: fallbackWindowId },
          targets: [{ type: "window" as const, id: fallbackWindowId }],
        };
  const selectedWindowId =
    selection.anchorTarget?.type === "window"
      ? selection.anchorTarget.id
      : getSelectedWindowIds(selection).at(-1);
  const activeWindowId =
    selectedWindowId ??
    (selection.anchorTarget === null &&
    normalized.activeWindowId !== null &&
    selectableWindowIds.has(normalized.activeWindowId)
      ? normalized.activeWindowId
      : null);
  return {
    ...normalized,
    activeWindowId,
    connections:
      connections.length === normalized.connections.length ? normalized.connections : connections,
    selection,
  };
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
  window: Readonly<{ data?: unknown }> | null | undefined,
  guard: (candidate: unknown) => candidate is Data,
): Data | null {
  const data = window?.data;

  return guard(data) ? data : null;
}

export {
  createInfiniteCanvasState,
  createInfiniteCanvasWindow,
  defineInfiniteCanvasWindowRegistry,
  getInfiniteCanvasWindowData,
};

export type { InfiniteCanvasStateInput, InfiniteCanvasWindowInput };
