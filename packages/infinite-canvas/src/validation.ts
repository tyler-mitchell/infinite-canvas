import type { InfiniteCanvasGroupLayoutMode, InfiniteCanvasGroupNode } from "./group-tree";
import type {
  InfiniteCanvasCamera,
  InfiniteCanvasConnection,
  InfiniteCanvasGroup,
  InfiniteCanvasRecipe,
  InfiniteCanvasRecipeGroup,
  InfiniteCanvasRecipeWindow,
  InfiniteCanvasPoint,
  InfiniteCanvasRect,
  InfiniteCanvasSelection,
  InfiniteCanvasSelectionTarget,
  InfiniteCanvasSerializedState,
  InfiniteCanvasSize,
  InfiniteCanvasWindow,
  InfiniteCanvasWindowCapabilities,
  InfiniteCanvasWindowMode,
  InfiniteCanvasWorkspace,
} from "./types";

/** Parses untrusted persisted data and removes unknown keys. */
/** Accepts finite numbers within safe-integer magnitude. */
function isSafeNumber(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    Math.abs(value) <= Number.MAX_SAFE_INTEGER
  );
}

/** Accepts positive safe numbers. */
function isPositiveSafeNumber(value: unknown): value is number {
  return isSafeNumber(value) && value > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

function isAbsent(value: unknown): value is undefined {
  return value === undefined;
}

function isWindowMode(value: unknown): value is InfiniteCanvasWindowMode {
  return value === "normal" || value === "minimized" || value === "maximized";
}

function parseInfiniteCanvasPoint(value: unknown): InfiniteCanvasPoint | null {
  if (!isRecord(value) || !isSafeNumber(value.x) || !isSafeNumber(value.y)) {
    return null;
  }

  return { x: value.x, y: value.y };
}

function parseInfiniteCanvasSize(value: unknown): InfiniteCanvasSize | null {
  if (
    !isRecord(value) ||
    !isPositiveSafeNumber(value.height) ||
    !isPositiveSafeNumber(value.width)
  ) {
    return null;
  }

  return { height: value.height, width: value.width };
}

function parseInfiniteCanvasRect(value: unknown): InfiniteCanvasRect | null {
  if (
    !isRecord(value) ||
    !isPositiveSafeNumber(value.height) ||
    !isPositiveSafeNumber(value.width) ||
    !isSafeNumber(value.x) ||
    !isSafeNumber(value.y)
  ) {
    return null;
  }

  return { height: value.height, width: value.width, x: value.x, y: value.y };
}

function parseInfiniteCanvasCamera(value: unknown): InfiniteCanvasCamera | null {
  if (!isRecord(value) || !isPositiveSafeNumber(value.zoom)) {
    return null;
  }

  const center = parseInfiniteCanvasPoint(value.center);

  return center === null ? null : { center, zoom: value.zoom };
}

function parseInfiniteCanvasSelectionTarget(value: unknown): InfiniteCanvasSelectionTarget | null {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.kind !== "string") {
    return null;
  }

  if (value.type !== "edge" && value.type !== "scene-object") {
    return null;
  }

  return {
    ...("data" in value ? { data: value.data } : {}),
    id: value.id,
    kind: value.kind,
    type: value.type,
  };
}

function parseInfiniteCanvasSelectionTargets(
  value: unknown,
): readonly InfiniteCanvasSelectionTarget[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const targets: InfiniteCanvasSelectionTarget[] = [];

  for (const entry of value) {
    const target = parseInfiniteCanvasSelectionTarget(entry);

    if (target === null) {
      return null;
    }

    targets.push(target);
  }

  return targets;
}

function parseInfiniteCanvasSelection(value: unknown): InfiniteCanvasSelection | null {
  if (!isRecord(value) || !isStringArray(value.windowIds)) {
    return null;
  }

  const { anchorWindowId } = value;

  if (!isAbsent(anchorWindowId) && anchorWindowId !== null && typeof anchorWindowId !== "string") {
    return null;
  }

  let targets: readonly InfiniteCanvasSelectionTarget[] | undefined;

  if (!isAbsent(value.targets)) {
    const parsedTargets = parseInfiniteCanvasSelectionTargets(value.targets);

    if (parsedTargets === null) {
      return null;
    }

    targets = parsedTargets;
  }

  return {
    anchorWindowId: anchorWindowId ?? null,
    ...(targets === undefined ? {} : { targets }),
    windowIds: [...value.windowIds],
  };
}

const INFINITE_CANVAS_WINDOW_CAPABILITIES = [
  "closable",
  "maximizable",
  "minimizable",
  "resizable",
] as const;

/** Returns undefined when absent and null when malformed. Stores only false flags. */
function parseInfiniteCanvasWindowCapabilities(
  value: unknown,
): InfiniteCanvasWindowCapabilities | null | undefined {
  if (isAbsent(value)) {
    return undefined;
  }

  if (!isRecord(value)) {
    return null;
  }

  const entries = INFINITE_CANVAS_WINDOW_CAPABILITIES.flatMap((capability) => {
    const flag = value[capability];

    if (isAbsent(flag)) {
      return [];
    }

    return typeof flag === "boolean" ? [[capability, flag] as const] : [null];
  });

  if (entries.some((entry) => entry === null)) {
    return null;
  }

  const withheld = entries.filter(
    (entry): entry is readonly [(typeof INFINITE_CANVAS_WINDOW_CAPABILITIES)[number], boolean] =>
      entry !== null && entry[1] === false,
  );

  return withheld.length === 0 ? undefined : Object.fromEntries(withheld);
}

function parseInfiniteCanvasWindow<Kind extends string>(
  value: unknown,
): InfiniteCanvasWindow<Kind> | null {
  if (!isRecord(value)) {
    return null;
  }

  const { id, isPinned, kind, mode, restoreRect, title, zIndex } = value;

  if (
    typeof id !== "string" ||
    typeof kind !== "string" ||
    typeof title !== "string" ||
    typeof isPinned !== "boolean" ||
    !isSafeNumber(zIndex)
  ) {
    return null;
  }

  if (!isAbsent(mode) && !isWindowMode(mode)) {
    return null;
  }

  const minSize = parseInfiniteCanvasSize(value.minSize);
  const rect = parseInfiniteCanvasRect(value.rect);

  if (minSize === null || rect === null) {
    return null;
  }

  let parsedRestoreRect: InfiniteCanvasRect | undefined;

  if (!isAbsent(restoreRect)) {
    const candidate = parseInfiniteCanvasRect(restoreRect);

    if (candidate === null) {
      return null;
    }

    parsedRestoreRect = candidate;
  }

  const capabilities = parseInfiniteCanvasWindowCapabilities(value.capabilities);

  if (capabilities === null) {
    return null;
  }

  return {
    ...(capabilities === undefined ? {} : { capabilities }),
    ...("data" in value ? { data: value.data } : {}),
    id,
    isPinned,
    kind: kind as Kind,
    minSize,
    mode: mode ?? "normal",
    rect,
    ...(parsedRestoreRect === undefined ? {} : { restoreRect: parsedRestoreRect }),
    title,
    zIndex,
  };
}

const INFINITE_CANVAS_GROUP_AXES = ["horizontal", "vertical"] as const;
const INFINITE_CANVAS_GROUP_LAYOUT_MODES = ["accordion", "split", "tabs"] as const;

function isGroupLayoutMode(value: unknown): value is InfiniteCanvasGroupLayoutMode {
  return INFINITE_CANVAS_GROUP_LAYOUT_MODES.includes(value as InfiniteCanvasGroupLayoutMode);
}

/** Rejects persisted group trees deeper than 256 nodes. */
const MAX_INFINITE_CANVAS_GROUP_TREE_DEPTH = 256;

/** Parses a persisted group tree. A malformed branch rejects the full tree. */
function parseInfiniteCanvasGroupNode(value: unknown, depth = 0): InfiniteCanvasGroupNode | null {
  if (depth > MAX_INFINITE_CANVAS_GROUP_TREE_DEPTH) {
    return null;
  }

  if (!isRecord(value) || typeof value.id !== "string" || !isPositiveSafeNumber(value.weight)) {
    return null;
  }

  if (value.kind === "window") {
    return { id: value.id, kind: "window", weight: value.weight };
  }

  if (
    value.kind !== "container" ||
    !isGroupLayoutMode(value.layout) ||
    !INFINITE_CANVAS_GROUP_AXES.includes(
      value.axis as (typeof INFINITE_CANVAS_GROUP_AXES)[number],
    ) ||
    !Array.isArray(value.children) ||
    value.children.length === 0 ||
    (value.activeChildId !== null && typeof value.activeChildId !== "string")
  ) {
    return null;
  }

  const children: InfiniteCanvasGroupNode[] = [];

  for (const entry of value.children) {
    const child = parseInfiniteCanvasGroupNode(entry, depth + 1);

    if (child === null) {
      return null;
    }

    children.push(child);
  }

  return {
    activeChildId: value.activeChildId,
    axis: value.axis as (typeof INFINITE_CANVAS_GROUP_AXES)[number],
    children,
    id: value.id,
    kind: "container",
    layout: value.layout,
    weight: value.weight,
  };
}

/** Parses workspace data. Reconciliation validates live membership later. */
function parseInfiniteCanvasWorkspace(value: unknown): InfiniteCanvasWorkspace | null {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.title !== "string") {
    return null;
  }

  const camera = parseInfiniteCanvasCamera(value.camera);
  const selection = parseInfiniteCanvasSelection(value.selection);

  if (camera === null || selection === null || !Array.isArray(value.windowIds)) {
    return null;
  }

  const windowIds = value.windowIds.filter((windowId) => typeof windowId === "string");

  if (windowIds.length !== value.windowIds.length) {
    return null;
  }

  return { camera, id: value.id, selection, title: value.title, windowIds };
}

/** Parses one edge. `data` is the consumer's, so it passes through unread. */
function parseInfiniteCanvasConnection(value: unknown): InfiniteCanvasConnection | null {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    typeof value.from !== "string" ||
    typeof value.to !== "string" ||
    typeof value.kind !== "string"
  ) {
    return null;
  }

  return {
    ...(isAbsent(value.data) ? {} : { data: value.data }),
    from: value.from,
    id: value.id,
    kind: value.kind,
    to: value.to,
  };
}

function parseInfiniteCanvasGroup(value: unknown): InfiniteCanvasGroup | null {
  if (!isRecord(value) || typeof value.id !== "string") {
    return null;
  }

  // A null or missing title derives from members.
  const title = value.title ?? null;

  if (title !== null && typeof title !== "string") {
    return null;
  }

  const rect = parseInfiniteCanvasRect(value.rect);
  const tree = parseInfiniteCanvasGroupNode(value.tree);

  if (rect === null || tree === null || !isSafeNumber(value.zIndex)) {
    return null;
  }

  return { id: value.id, rect, title, tree, zIndex: value.zIndex };
}

/** Parses a recipe window from untrusted storage data. */
function parseInfiniteCanvasRecipeWindow(value: unknown): InfiniteCanvasRecipeWindow | null {
  if (
    !isRecord(value) ||
    typeof value.windowId !== "string" ||
    typeof value.isPinned !== "boolean" ||
    !isSafeNumber(value.zIndex)
  ) {
    return null;
  }

  const rect = parseInfiniteCanvasRect(value.rect);

  return rect === null || !isWindowMode(value.mode)
    ? null
    : {
        isPinned: value.isPinned,
        mode: value.mode,
        rect,
        windowId: value.windowId,
        zIndex: value.zIndex,
      };
}

function parseInfiniteCanvasRecipeGroup(value: unknown): InfiniteCanvasRecipeGroup | null {
  // A null or missing title derives from members.
  const title = value !== null && isRecord(value) ? (value.title ?? null) : null;

  if (!isRecord(value) || typeof value.groupId !== "string") {
    return null;
  }

  if (title !== null && typeof title !== "string") {
    return null;
  }

  const rect = parseInfiniteCanvasRect(value.rect);
  const tree = parseInfiniteCanvasGroupNode(value.tree);

  return rect === null || tree === null || !isSafeNumber(value.zIndex)
    ? null
    : { groupId: value.groupId, rect, title, tree, zIndex: value.zIndex };
}

function parseInfiniteCanvasRecipe(value: unknown): InfiniteCanvasRecipe | null {
  if (
    !isRecord(value) ||
    value.version !== 1 ||
    typeof value.id !== "string" ||
    typeof value.name !== "string" ||
    !Array.isArray(value.windows) ||
    !Array.isArray(value.groups)
  ) {
    return null;
  }

  const size = parseInfiniteCanvasSize(value.size);

  if (size === null) {
    return null;
  }

  const windows: InfiniteCanvasRecipeWindow[] = [];

  for (const entry of value.windows) {
    const window = parseInfiniteCanvasRecipeWindow(entry);

    if (window === null) {
      return null;
    }

    windows.push(window);
  }

  const groups: InfiniteCanvasRecipeGroup[] = [];

  for (const entry of value.groups) {
    const group = parseInfiniteCanvasRecipeGroup(entry);

    if (group === null) {
      return null;
    }

    groups.push(group);
  }

  return { groups, id: value.id, name: value.name, size, version: 1, windows };
}

function parseInfiniteCanvasSerializedState<Kind extends string>(
  value: unknown,
): InfiniteCanvasSerializedState<Kind> | null {
  // Versions below the current one migrate missing fields to empty lists.
  if (
    !isRecord(value) ||
    typeof value.version !== "number" ||
    value.version < 1 ||
    value.version > 4 ||
    !Number.isInteger(value.version)
  ) {
    return null;
  }

  const version = value.version;

  const { activeWindowId } = value;

  if (activeWindowId !== null && typeof activeWindowId !== "string") {
    return null;
  }

  const camera = parseInfiniteCanvasCamera(value.camera);

  if (camera === null || !Array.isArray(value.windows)) {
    return null;
  }

  const windows: InfiniteCanvasWindow<Kind>[] = [];

  for (const entry of value.windows) {
    const window = parseInfiniteCanvasWindow<Kind>(entry);

    if (window === null) {
      return null;
    }

    windows.push(window);
  }

  let selection: InfiniteCanvasSelection | undefined;

  if (!isAbsent(value.selection)) {
    const parsedSelection = parseInfiniteCanvasSelection(value.selection);

    if (parsedSelection === null) {
      return null;
    }

    selection = parsedSelection;
  }

  const groups: InfiniteCanvasGroup[] = [];

  if (!isAbsent(value.groups)) {
    if (!Array.isArray(value.groups)) {
      return null;
    }

    for (const entry of value.groups) {
      const group = parseInfiniteCanvasGroup(entry);

      if (group === null) {
        return null;
      }

      groups.push(group);
    }
  }

  const workspaces: InfiniteCanvasWorkspace[] = [];

  if (!isAbsent(value.workspaces)) {
    if (!Array.isArray(value.workspaces)) {
      return null;
    }

    for (const entry of value.workspaces) {
      const workspace = parseInfiniteCanvasWorkspace(entry);

      if (workspace === null) {
        return null;
      }

      workspaces.push(workspace);
    }
  }

  const connections: InfiniteCanvasConnection[] = [];

  if (!isAbsent(value.connections)) {
    if (!Array.isArray(value.connections)) {
      return null;
    }

    for (const entry of value.connections) {
      const connection = parseInfiniteCanvasConnection(entry);

      if (connection === null) {
        return null;
      }

      connections.push(connection);
    }
  }

  return {
    activeWindowId,
    // Versions 1 and 2 have no workspace fields.
    ...(version >= 3 && typeof value.activeWorkspaceId === "string"
      ? { activeWorkspaceId: value.activeWorkspaceId }
      : {}),
    camera,
    connections,
    groups,
    selection,
    version: 4,
    windows,
    ...(version >= 3 ? { workspaces } : { workspaces: [] }),
  };
}

export {
  parseInfiniteCanvasCamera,
  parseInfiniteCanvasConnection,
  parseInfiniteCanvasGroup,
  parseInfiniteCanvasGroupNode,
  parseInfiniteCanvasPoint,
  parseInfiniteCanvasRecipe,
  parseInfiniteCanvasRect,
  parseInfiniteCanvasSelection,
  parseInfiniteCanvasSerializedState,
  parseInfiniteCanvasSize,
  parseInfiniteCanvasWindow,
  parseInfiniteCanvasWorkspace,
};
