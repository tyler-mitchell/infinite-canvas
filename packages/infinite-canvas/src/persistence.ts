import type { InfiniteCanvasSerializedState, InfiniteCanvasState } from "./types";
import { EMPTY_INFINITE_CANVAS_SELECTION, normalizeSelection } from "./selection";
import {
  parseInfiniteCanvasCamera,
  parseInfiniteCanvasSelection,
  parseInfiniteCanvasWindow,
} from "./validation";
import { getUniqueInfiniteCanvasWindows } from "./window-identity";

type InfiniteCanvasPersistenceEnvelope = Readonly<{
  activeWindowId: string | null;
  camera: unknown;
  selection: unknown;
  windows: readonly unknown[];
}>;

type InfiniteCanvasStorageKeyInput = Readonly<{
  documentKey?: string;
  storageKey?: string;
}>;

const INFINITE_CANVAS_DOCUMENT_STORAGE_SEPARATOR = "::document::";

function getInfiniteCanvasScopedStorageKey({
  documentKey,
  storageKey,
}: InfiniteCanvasStorageKeyInput) {
  return storageKey === undefined || documentKey === undefined || documentKey.length === 0
    ? storageKey
    : `${storageKey}${INFINITE_CANVAS_DOCUMENT_STORAGE_SEPARATOR}${encodeURIComponent(documentKey)}`;
}

function serializeInfiniteCanvasState<Kind extends string>(
  state: InfiniteCanvasState<Kind>,
): InfiniteCanvasSerializedState<Kind> {
  return {
    activeWindowId: state.activeWindowId,
    camera: state.camera,
    selection: state.selection,
    version: 1,
    windows: state.windows,
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
  if (!isRecord(value) || value.version !== 1 || !Array.isArray(value.windows)) {
    return null;
  }

  return {
    activeWindowId: typeof value.activeWindowId === "string" ? value.activeWindowId : null,
    camera: value.camera,
    selection: value.selection,
    windows: value.windows,
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
  const unnormalizedState = {
    ...baseState,
    activeWindowId,
    camera: parseInfiniteCanvasCamera(envelope.camera) ?? baseState.camera,
    interaction: null,
    selection: initialSelection,
    snapPreview: null,
    windows,
  } satisfies InfiniteCanvasState<Kind>;
  const selection = normalizeSelection(unnormalizedState, initialSelection);

  return {
    ...unnormalizedState,
    activeWindowId: selection.anchorWindowId,
    selection,
  };
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
  getInfiniteCanvasScopedStorageKey,
  parseInfiniteCanvasState,
  parseInfiniteCanvasStateJson,
  serializeInfiniteCanvasState,
  stringifyInfiniteCanvasState,
};

export type { InfiniteCanvasStorageKeyInput };
