import type {
  InfiniteCanvasCamera,
  InfiniteCanvasPoint,
  InfiniteCanvasRect,
  InfiniteCanvasSelection,
  InfiniteCanvasSelectionTarget,
  InfiniteCanvasSerializedState,
  InfiniteCanvasSize,
  InfiniteCanvasWindow,
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

  return {
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

function parseInfiniteCanvasSerializedState<Kind extends string>(
  value: unknown,
): InfiniteCanvasSerializedState<Kind> | null {
  if (!isRecord(value) || value.version !== 1) {
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

  return {
    activeWindowId,
    camera,
    selection,
    version: 1,
    windows,
  };
}

export {
  parseInfiniteCanvasCamera,
  parseInfiniteCanvasPoint,
  parseInfiniteCanvasRect,
  parseInfiniteCanvasSelection,
  parseInfiniteCanvasSerializedState,
  parseInfiniteCanvasSize,
  parseInfiniteCanvasWindow,
};
