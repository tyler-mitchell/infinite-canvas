import type {
  InfiniteCanvasCursorInteraction,
  InfiniteCanvasInputPolicy,
  InfiniteCanvasPointerMode,
} from "./types";

const DEFAULT_INFINITE_CANVAS_CURSOR_POLICY = {
  idle: {
    marquee: "default",
    pan: "default",
  },
  interaction: {
    marquee: "default",
    move: "grabbing",
    pan: "default",
  },
} satisfies Required<NonNullable<InfiniteCanvasInputPolicy["cursor"]>>;

function getInfiniteCanvasPointerMode(
  inputPolicy: InfiniteCanvasInputPolicy,
): InfiniteCanvasPointerMode {
  return inputPolicy.emptyCanvasDrag === "pan" ? "pan" : "marquee";
}

function withInfiniteCanvasPointerMode(
  inputPolicy: InfiniteCanvasInputPolicy,
  pointerMode: InfiniteCanvasPointerMode,
): InfiniteCanvasInputPolicy {
  return {
    ...inputPolicy,
    emptyCanvasDrag: pointerMode,
  };
}

function getInfiniteCanvasIdleCursor(
  inputPolicy: InfiniteCanvasInputPolicy,
  pointerMode: InfiniteCanvasPointerMode,
) {
  return (
    inputPolicy.cursor?.idle?.[pointerMode] ??
    DEFAULT_INFINITE_CANVAS_CURSOR_POLICY.idle[pointerMode]
  );
}

function getInfiniteCanvasInteractionCursor(
  inputPolicy: InfiniteCanvasInputPolicy,
  interaction: InfiniteCanvasCursorInteraction,
) {
  return (
    inputPolicy.cursor?.interaction?.[interaction] ??
    DEFAULT_INFINITE_CANVAS_CURSOR_POLICY.interaction[interaction]
  );
}

export {
  DEFAULT_INFINITE_CANVAS_CURSOR_POLICY,
  getInfiniteCanvasIdleCursor,
  getInfiniteCanvasInteractionCursor,
  getInfiniteCanvasPointerMode,
  withInfiniteCanvasPointerMode,
};
