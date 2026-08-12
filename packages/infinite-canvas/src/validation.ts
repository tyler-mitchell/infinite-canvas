import type { InfiniteCanvasGroupLayoutMode, InfiniteCanvasGroupNode } from "./group-tree";
import type {
  InfiniteCanvasCamera,
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
} from "./types";

/**
 * Structural parsers for untrusted persisted state. Each returns the parsed
 * value with unknown keys stripped, or `null` when the shape is invalid.
 *
 * These were an arktype schema, but `store -> persistence -> validation` puts
 * them on every consumer's render path, so the runtime type system shipped in
 * every bundle: 46 KB gzipped, 34% of the package, to validate eight small
 * shapes. Hand-rolled guards are behaviour-identical — ./validation.test.ts
 * characterizes the original semantics and passes unchanged against these.
 */

/** Matches arktype's `number.safe`: finite, and within the safe-integer magnitude. */
function isSafeNumber(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    Math.abs(value) <= Number.MAX_SAFE_INTEGER
  );
}

/** Matches arktype's `number.safe > 0`. */
function isPositiveSafeNumber(value: unknown): value is number {
  return isSafeNumber(value) && value > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

/** Optional keys: `JSON.parse` never yields `undefined`, so treat it as absent. */
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

/**
 * `undefined` when absent, `null` when malformed — the parser's own convention, kept so a
 * corrupt capability set rejects the window rather than silently unlocking it.
 *
 * Only `false` is carried across. A capability set to `true` means the same as absent, so
 * dropping it keeps persisted state small and canonical: two documents that behave
 * identically serialize identically.
 */
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

/**
 * How deep a persisted tree may nest before it is rejected as malformed.
 *
 * Every framework-written tree is normalized first — single-child splits collapse, same-axis
 * splits inline — so a real tree's depth is bounded by its axis alternations and tab/accordion
 * folds, in the low tens even for a canvas of hundreds of windows. 256 is an order of magnitude
 * of headroom over anything the serializer emits, and it exists only to answer a *hand-crafted*
 * `localStorage` payload nested thousands deep. Without it, `parseInfiniteCanvasGroupNode`
 * recurses to exhaustion and throws `RangeError` — which violates the contract every parser in
 * this file states ("`null` when the shape is invalid"), and which the framework's own hydration
 * only survives because `parseInfiniteCanvasStateJson` wraps the whole parse in `try/catch`. A
 * consumer calling the exported parser on already-parsed JSON has no such net; "too deep to be
 * real" is an invalid shape, and this returns `null` for it like every other invalid shape.
 */
const MAX_INFINITE_CANVAS_GROUP_TREE_DEPTH = 256;

/**
 * A persisted layout tree. Recursive, so it is parsed recursively; a malformed
 * branch invalidates the whole tree rather than silently pruning members, since
 * a half-parsed group would lay out windows nobody asked it to.
 *
 * `depth` is internal — callers parse a tree root and leave it at `0`.
 */
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

function parseInfiniteCanvasGroup(value: unknown): InfiniteCanvasGroup | null {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.title !== "string") {
    return null;
  }

  const rect = parseInfiniteCanvasRect(value.rect);
  const tree = parseInfiniteCanvasGroupNode(value.tree);

  if (rect === null || tree === null || !isSafeNumber(value.zIndex)) {
    return null;
  }

  return { id: value.id, rect, title: value.title, tree, zIndex: value.zIndex };
}

/**
 * Recipes cross `localStorage` like persisted state does, so they are parsed
 * structurally rather than trusted. A malformed entry is `null`, never a
 * half-built arrangement that would place windows nobody asked it to.
 */
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
  if (!isRecord(value) || typeof value.groupId !== "string" || typeof value.title !== "string") {
    return null;
  }

  const rect = parseInfiniteCanvasRect(value.rect);
  const tree = parseInfiniteCanvasGroupNode(value.tree);

  return rect === null || tree === null || !isSafeNumber(value.zIndex)
    ? null
    : { groupId: value.groupId, rect, title: value.title, tree, zIndex: value.zIndex };
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
  // `version: 1` predates groups and migrates to none. Accepting it here rather
  // than making `groups` optional is what stops an older build from reading a
  // newer payload, dropping the field it does not know, and writing back a
  // layout with every group silently deleted.
  if (!isRecord(value) || (value.version !== 1 && value.version !== 2)) {
    return null;
  }

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

  return {
    activeWindowId,
    camera,
    groups,
    selection,
    version: 2,
    windows,
  };
}

export {
  parseInfiniteCanvasCamera,
  parseInfiniteCanvasGroup,
  parseInfiniteCanvasGroupNode,
  parseInfiniteCanvasPoint,
  parseInfiniteCanvasRecipe,
  parseInfiniteCanvasRect,
  parseInfiniteCanvasSelection,
  parseInfiniteCanvasSerializedState,
  parseInfiniteCanvasSize,
  parseInfiniteCanvasWindow,
};
