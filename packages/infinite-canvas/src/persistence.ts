import { reconcileInfiniteCanvasGroups } from "./group-state";
import { reconcileInfiniteCanvasWorkspaces } from "./workspace";
import type {
  InfiniteCanvasGroup,
  InfiniteCanvasSerializedState,
  InfiniteCanvasState,
} from "./types";
import {
  EMPTY_INFINITE_CANVAS_SELECTION,
  getSelectionAnchorTarget,
  normalizeSelection,
} from "./selection";
import {
  parseInfiniteCanvasCamera,
  parseInfiniteCanvasGroup,
  parseInfiniteCanvasSelection,
  parseInfiniteCanvasWindow,
  parseInfiniteCanvasWorkspace,
} from "./validation";
import { getUniqueInfiniteCanvasWindows } from "./window-identity";

type InfiniteCanvasPersistenceEnvelope = Readonly<{
  activeWindowId: string | null;
  activeWorkspaceId: string | null;
  camera: unknown;
  groups: readonly unknown[];
  selection: unknown;
  windows: readonly unknown[];
  workspaces: readonly unknown[];
}>;

type InfiniteCanvasStorageKeyInput = Readonly<{
  documentKey?: string;
  storageKey?: string;
}>;

const INFINITE_CANVAS_DOCUMENT_STORAGE_SEPARATOR = "::document::";

/** Returns a string when `storageKey` exists. */
function getInfiniteCanvasScopedStorageKey(
  input: Readonly<{ documentKey?: string; storageKey: string }>,
): string;
function getInfiniteCanvasScopedStorageKey(
  input: InfiniteCanvasStorageKeyInput,
): string | undefined;
function getInfiniteCanvasScopedStorageKey({
  documentKey,
  storageKey,
}: InfiniteCanvasStorageKeyInput) {
  return storageKey === undefined || documentKey === undefined || documentKey.length === 0
    ? storageKey
    : `${storageKey}${INFINITE_CANVAS_DOCUMENT_STORAGE_SEPARATOR}${encodeURIComponent(documentKey)}`;
}

/** Lists every serialized document field for observers. */
const INFINITE_CANVAS_DOCUMENT_FIELDS = {
  activeWindowId: true,
  activeWorkspaceId: true,
  camera: true,
  groups: true,
  selection: true,
  windows: true,
  workspaces: true,
} as const satisfies Record<Exclude<keyof InfiniteCanvasSerializedState<string>, "version">, true>;

type InfiniteCanvasDocumentField = keyof typeof INFINITE_CANVAS_DOCUMENT_FIELDS;

function serializeInfiniteCanvasState<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
): InfiniteCanvasSerializedState<Kind> {
  return {
    activeWindowId: state.activeWindowId,
    activeWorkspaceId: state.activeWorkspaceId,
    camera: state.camera,
    groups: state.groups,
    selection: state.selection,
    version: 3,
    windows: state.windows,
    workspaces: state.workspaces,
  };
}

function stringifyInfiniteCanvasState<Kind extends string>(state: InfiniteCanvasState<Kind>) {
  return JSON.stringify(serializeInfiniteCanvasState(state));
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readInfiniteCanvasPersistenceEnvelope(
  value: unknown,
): InfiniteCanvasPersistenceEnvelope | null {
  // Versions 1 and 2 omit later fields and migrate to empty lists.
  if (
    !isRecord(value) ||
    (value.version !== 1 && value.version !== 2 && value.version !== 3) ||
    !Array.isArray(value.windows)
  ) {
    return null;
  }

  return {
    activeWindowId: typeof value.activeWindowId === "string" ? value.activeWindowId : null,
    camera: value.camera,
    activeWorkspaceId: typeof value.activeWorkspaceId === "string" ? value.activeWorkspaceId : null,
    groups: Array.isArray(value.groups) ? value.groups : [],
    selection: value.selection,
    windows: value.windows,
    workspaces: Array.isArray(value.workspaces) ? value.workspaces : [],
  };
}

function getHydratedActiveWindowId<Kind extends string>({
  activeWindowId,
  windows,
}: Pick<InfiniteCanvasSerializedState<Kind>, "activeWindowId" | "windows">) {
  if (windows.length === 0) {
    return null;
  }

  const windowIds = new Set(windows.map((window) => window.id));

  return activeWindowId !== null && windowIds.has(activeWindowId)
    ? activeWindowId
    : (windows.filter((window) => window.mode !== "minimized").at(-1)?.id ?? null);
}

function parseInfiniteCanvasState<Kind extends string>(
  value: unknown,
  baseState: InfiniteCanvasState<Kind>,
): InfiniteCanvasState<Kind> | null {
  const envelope = readInfiniteCanvasPersistenceEnvelope(value);

  if (envelope === null) {
    return null;
  }

  const parsedWindows = envelope.windows
    .map((window) => parseInfiniteCanvasWindow<Kind>(window))
    .filter((window) => window !== null);
  const windows = getUniqueInfiniteCanvasWindows(parsedWindows);

  if (envelope.windows.length > 0 && windows.length === 0) {
    return null;
  }

  const activeWindowId = getHydratedActiveWindowId({
    activeWindowId: envelope.activeWindowId,
    windows,
  });
  const persistedSelection = parseInfiniteCanvasSelection(envelope.selection);
  const initialSelection =
    persistedSelection ??
    (activeWindowId === null
      ? EMPTY_INFINITE_CANVAS_SELECTION
      : {
          anchorWindowId: activeWindowId,
          windowIds: [activeWindowId],
        });
  // Drop a malformed group without rejecting valid windows.
  const groups = envelope.groups
    .map((group) => parseInfiniteCanvasGroup(group))
    .filter((group): group is InfiniteCanvasGroup => group !== null);
  // Drop malformed workspaces. Reconcile their membership after parsing.
  const workspaces = envelope.workspaces
    .map((workspace) => parseInfiniteCanvasWorkspace(workspace))
    .filter((workspace) => workspace !== null);
  const unnormalizedState = {
    ...baseState,
    activeWindowId,
    activeWorkspaceId: workspaces.some((workspace) => workspace.id === envelope.activeWorkspaceId)
      ? envelope.activeWorkspaceId
      : null,
    camera: parseInfiniteCanvasCamera(envelope.camera) ?? baseState.camera,
    groups,
    workspaces,
    interaction: null,
    selection: initialSelection,
    snapPreview: null,
    windows,
  } satisfies InfiniteCanvasState<Kind>;
  const selection = normalizeSelection(unnormalizedState, initialSelection);

  // Reconcile groups before workspaces because membership reads group trees.
  return reconcileInfiniteCanvasWorkspaces(
    reconcileInfiniteCanvasGroups({
      ...unnormalizedState,
      // A non-window selection target excludes an active window.
      activeWindowId:
        selection.anchorWindowId ??
        (getSelectionAnchorTarget(selection) === null ? activeWindowId : null),
      selection,
    }),
  );
}

function parseInfiniteCanvasStateJson<Kind extends string>(
  value: string,
  baseState: InfiniteCanvasState<Kind>,
) {
  try {
    return parseInfiniteCanvasState(JSON.parse(value), baseState);
  } catch {
    return null;
  }
}

export {
  INFINITE_CANVAS_DOCUMENT_FIELDS,
  getInfiniteCanvasScopedStorageKey,
  parseInfiniteCanvasState,
  parseInfiniteCanvasStateJson,
  serializeInfiniteCanvasState,
  stringifyInfiniteCanvasState,
};

export type { InfiniteCanvasDocumentField, InfiniteCanvasStorageKeyInput };
