import { type } from "arktype";

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

type InfiniteCanvasParsedWindow<Kind extends string> = Omit<InfiniteCanvasWindow<Kind>, "mode"> &
  Readonly<{
    mode?: InfiniteCanvasWindowMode;
  }>;

type InfiniteCanvasParsedSerializedState<Kind extends string> = Omit<
  InfiniteCanvasSerializedState<Kind>,
  "windows"
> &
  Readonly<{
    windows: readonly InfiniteCanvasParsedWindow<Kind>[];
  }>;

const infiniteCanvasPointSchema = type({
  "+": "delete",
  x: "number.safe",
  y: "number.safe",
});

const infiniteCanvasSizeSchema = type({
  "+": "delete",
  height: "number.safe > 0",
  width: "number.safe > 0",
});

const infiniteCanvasRectSchema = type({
  "+": "delete",
  height: "number.safe > 0",
  width: "number.safe > 0",
  x: "number.safe",
  y: "number.safe",
});

const infiniteCanvasCameraSchema = type({
  "+": "delete",
  center: infiniteCanvasPointSchema,
  zoom: "number.safe > 0",
});

const infiniteCanvasWindowModeSchema = type.enumerated("normal", "minimized", "maximized");

const infiniteCanvasSelectionTargetTypeSchema = type.enumerated("edge", "scene-object");

const infiniteCanvasSelectionTargetSchema = type({
  "+": "delete",
  "data?": "unknown",
  id: "string",
  kind: "string",
  type: infiniteCanvasSelectionTargetTypeSchema,
});

const infiniteCanvasSelectionSchema = type({
  "+": "delete",
  "anchorWindowId?": "string | null",
  "targets?": type(infiniteCanvasSelectionTargetSchema, "[]"),
  windowIds: "string[]",
});

const infiniteCanvasWindowSchema = type({
  "+": "delete",
  "data?": "unknown",
  id: "string",
  isPinned: "boolean",
  kind: "string",
  minSize: infiniteCanvasSizeSchema,
  "mode?": infiniteCanvasWindowModeSchema,
  rect: infiniteCanvasRectSchema,
  "restoreRect?": infiniteCanvasRectSchema,
  title: "string",
  zIndex: "number.safe",
});

const infiniteCanvasSerializedStateSchema = type({
  "+": "delete",
  activeWindowId: "string | null",
  camera: infiniteCanvasCameraSchema,
  "selection?": infiniteCanvasSelectionSchema,
  version: "1",
  windows: type(infiniteCanvasWindowSchema, "[]"),
});

function parseInfiniteCanvasSchema<Value>(
  schema: (value: unknown) => unknown,
  value: unknown,
): Value | null {
  const result = schema(value);

  return result instanceof type.errors ? null : (result as Value);
}

function parseInfiniteCanvasPoint(value: unknown): InfiniteCanvasPoint | null {
  return parseInfiniteCanvasSchema<InfiniteCanvasPoint>(infiniteCanvasPointSchema, value);
}

function parseInfiniteCanvasSize(value: unknown): InfiniteCanvasSize | null {
  return parseInfiniteCanvasSchema<InfiniteCanvasSize>(infiniteCanvasSizeSchema, value);
}

function parseInfiniteCanvasRect(value: unknown): InfiniteCanvasRect | null {
  return parseInfiniteCanvasSchema<InfiniteCanvasRect>(infiniteCanvasRectSchema, value);
}

function parseInfiniteCanvasCamera(value: unknown): InfiniteCanvasCamera | null {
  return parseInfiniteCanvasSchema<InfiniteCanvasCamera>(infiniteCanvasCameraSchema, value);
}

function parseInfiniteCanvasSelection(value: unknown): InfiniteCanvasSelection | null {
  const parsed = parseInfiniteCanvasSchema<
    Readonly<{
      anchorWindowId?: string | null;
      targets?: readonly InfiniteCanvasSelectionTarget[];
      windowIds: readonly string[];
    }>
  >(infiniteCanvasSelectionSchema, value);

  return parsed === null
    ? null
    : {
        anchorWindowId: parsed.anchorWindowId ?? null,
        ...(parsed.targets === undefined ? {} : { targets: parsed.targets }),
        windowIds: parsed.windowIds,
      };
}

function parseInfiniteCanvasWindow<Kind extends string>(
  value: unknown,
): InfiniteCanvasWindow<Kind> | null {
  const parsed = parseInfiniteCanvasSchema<InfiniteCanvasParsedWindow<Kind>>(
    infiniteCanvasWindowSchema,
    value,
  );

  return parsed === null
    ? null
    : {
        ...parsed,
        mode: parsed.mode ?? "normal",
      };
}

function parseInfiniteCanvasSerializedState<Kind extends string>(
  value: unknown,
): InfiniteCanvasSerializedState<Kind> | null {
  const parsed = parseInfiniteCanvasSchema<InfiniteCanvasParsedSerializedState<Kind>>(
    infiniteCanvasSerializedStateSchema,
    value,
  );

  return parsed === null
    ? null
    : {
        ...parsed,
        selection:
          parsed.selection === undefined
            ? undefined
            : {
                anchorWindowId: parsed.selection.anchorWindowId ?? null,
                ...(parsed.selection.targets === undefined
                  ? {}
                  : { targets: parsed.selection.targets }),
                windowIds: parsed.selection.windowIds,
              },
        windows: parsed.windows.map((window) => ({
          ...window,
          mode: window.mode ?? "normal",
        })),
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
