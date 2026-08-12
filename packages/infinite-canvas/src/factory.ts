import { DEFAULT_INFINITE_CANVAS_CAMERA } from "./constants";
import { reconcileInfiniteCanvasGroups } from "./group-state";
import { EMPTY_INFINITE_CANVAS_HISTORY } from "./history";
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
    // Omitted rather than defaulted to an all-true object: absent already means permitted,
    // and writing the default out would put a redundant record on every window in state and
    // in every persisted document.
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
  groups = [],
  selection,
  viewport = DEFAULT_INFINITE_CANVAS_VIEWPORT,
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
    // Opt-in, exactly as `groups` is: no workspace means no membership filter, and a canvas
    // that never creates one behaves as it did before they existed.
    activeWorkspaceId: null,
    workspaces,
    camera: {
      center: {
        x: camera.center.x,
        y: camera.center.y,
      },
      zoom: camera.zoom,
    },
    groups,
    history: EMPTY_INFINITE_CANVAS_HISTORY,
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

/**
 * Define a window registry, optionally typing each kind's `data` payload.
 *
 * ```ts
 * type Kind = "chart" | "note";
 * type DataByKind = { chart: { series: number[] }; note: { text: string } };
 *
 * defineInfiniteCanvasWindowRegistry<Kind, DataByKind>({
 *   chart: { kind: "chart", renderBody: ({ window }) => plot(window.data?.series) },
 *   note: { kind: "note", renderBody: ({ window }) => <p>{window.data?.text}</p> },
 * });
 * ```
 *
 * `DataByKind` is used **while the literal is being written** and then erased. That
 * is the whole design, and it is deliberate:
 *
 * - `renderBody` *takes* a context, so `InfiniteCanvasWindowDefinition<K, Data>` is
 *   contravariant in `Data`. A registry typed per kind is therefore not assignable
 *   to the erased one, and threading `DataByKind` onward would force
 *   `InfiniteCanvasDesktop`, the viewport, the window layer, the frame, and every
 *   slot to carry a type parameter.
 * - It would buy nothing. `window.data` is genuinely `unknown` at runtime: it round
 *   trips through `JSON.parse` on hydration, and a tampered `localStorage` entry can
 *   put anything there. The framework cannot keep a promise about its shape.
 *
 * So `data` is typed where the author knows what they put in it, and stays `unknown`
 * where the framework hands it back. **For persisted canvases, validate on read** —
 * `getInfiniteCanvasWindowData(window, guard)` exists for exactly that, and a
 * `renderBody` that trusts `window.data` from `localStorage` is trusting a string a
 * user can edit.
 *
 * Calling it without `DataByKind` types every payload `unknown`, as before.
 */
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

  // The erasure. Every `renderBody` here was written against a `data` the author
  // declared; at runtime it receives whatever `data` the window actually carries.
  // That gap is the consumer's assertion, made explicit at one line rather than
  // spread across the framework's internals as a type parameter that lies.
  return registry as unknown as InfiniteCanvasWindowRegistry<Kind>;
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
