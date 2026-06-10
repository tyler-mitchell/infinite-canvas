import { screenPointToWorldPoint } from "#/experiments/infinite-canvas/geometry";
import type {
  InfiniteCanvasCamera,
  InfiniteCanvasDropInteraction,
  InfiniteCanvasDropValidationInput,
  InfiniteCanvasDropValidationResult,
  InfiniteCanvasPoint,
  InfiniteCanvasResolvedDropTarget,
  InfiniteCanvasSpatialTarget,
  InfiniteCanvasViewport,
} from "#/experiments/infinite-canvas/types";

type InfiniteCanvasDropInteractionInput<
  Payload = unknown,
  Kind extends string = string,
> = Readonly<{
  camera: InfiniteCanvasCamera;
  clientPoint: InfiniteCanvasPoint;
  id: string;
  originClientPoint: InfiniteCanvasPoint;
  payload: Payload;
  pointerId: number;
  target?: InfiniteCanvasSpatialTarget<Kind> | null;
  validation?: InfiniteCanvasDropValidationInput;
  viewport: InfiniteCanvasViewport;
  viewportPoint: InfiniteCanvasPoint;
}>;

const EMPTY_INFINITE_CANVAS_DROP = {
  status: "idle",
} satisfies InfiniteCanvasDropInteraction;

function isPointInsideInfiniteCanvasViewport(
  viewport: InfiniteCanvasViewport,
  point: InfiniteCanvasPoint,
) {
  return point.x >= 0 && point.y >= 0 && point.x <= viewport.width && point.y <= viewport.height;
}

function normalizeInfiniteCanvasDropValidation(
  input: InfiniteCanvasDropValidationInput = true,
): InfiniteCanvasDropValidationResult {
  return typeof input === "boolean"
    ? {
        accepted: input,
      }
    : input;
}

function createInfiniteCanvasDropTarget<Kind extends string>({
  isOverViewport,
  target,
  validation,
  viewportPoint,
  worldPoint,
}: Readonly<{
  isOverViewport: boolean;
  target?: InfiniteCanvasSpatialTarget<Kind> | null;
  validation: InfiniteCanvasDropValidationResult;
  viewportPoint: InfiniteCanvasPoint;
  worldPoint: InfiniteCanvasPoint;
}>): InfiniteCanvasResolvedDropTarget<Kind> {
  if (!isOverViewport) {
    return {
      status: "outside",
      target: null,
    };
  }

  const resolvedTarget =
    target ??
    ({
      type: "empty-world",
      viewportPoint,
      worldPoint,
    } satisfies InfiniteCanvasSpatialTarget<Kind>);

  return validation.accepted
    ? {
        status: "valid",
        target: resolvedTarget,
      }
    : {
        reason: validation.reason,
        status: "invalid",
        target: resolvedTarget,
      };
}

function createInfiniteCanvasDropInteraction<Payload, Kind extends string = string>({
  camera,
  clientPoint,
  id,
  originClientPoint,
  payload,
  pointerId,
  target,
  validation = true,
  viewport,
  viewportPoint,
}: InfiniteCanvasDropInteractionInput<Payload, Kind>): InfiniteCanvasDropInteraction<
  Payload,
  Kind
> {
  const isOverViewport = isPointInsideInfiniteCanvasViewport(viewport, viewportPoint);
  const worldPoint = screenPointToWorldPoint(camera, viewport, viewportPoint);
  const normalizedValidation = normalizeInfiniteCanvasDropValidation(validation);

  return {
    clientPoint,
    dropTarget: createInfiniteCanvasDropTarget({
      isOverViewport,
      target,
      validation: normalizedValidation,
      viewportPoint,
      worldPoint,
    }),
    id,
    isOverViewport,
    originClientPoint,
    payload,
    pointerId,
    status: "dragging",
    viewportPoint,
    worldPoint,
  };
}

export {
  EMPTY_INFINITE_CANVAS_DROP,
  createInfiniteCanvasDropInteraction,
  isPointInsideInfiniteCanvasViewport,
  normalizeInfiniteCanvasDropValidation,
};

export type { InfiniteCanvasDropInteractionInput };
