import { screenPointToWorldPoint } from "./geometry";
import { applySnapToRect } from "./snap-resolver";
import type {
  InfiniteCanvasCamera,
  InfiniteCanvasDropInteraction,
  InfiniteCanvasDropPlacement,
  InfiniteCanvasDropValidationInput,
  InfiniteCanvasDropValidationResult,
  InfiniteCanvasPoint,
  InfiniteCanvasRect,
  InfiniteCanvasResolvedDropTarget,
  InfiniteCanvasSize,
  InfiniteCanvasSnapPolicy,
  InfiniteCanvasSpatialTarget,
  InfiniteCanvasState,
  InfiniteCanvasViewport,
} from "./types";

type InfiniteCanvasDropInteractionInput<
  Payload = unknown,
  Kind extends string = string,
> = Readonly<{
  camera: InfiniteCanvasCamera;
  clientPoint: InfiniteCanvasPoint;
  id: string;
  originClientPoint: InfiniteCanvasPoint;
  payload: Payload;
  placement?: InfiniteCanvasDropPlacement | null;
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
  placement = null,
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
    placement,
    pointerId,
    status: "dragging",
    viewportPoint,
    worldPoint,
  };
}

type InfiniteCanvasDropPlacementInput<Kind extends string = string> = Readonly<{
  /** Pointer position in the placed rect, normalized from `0` to `1`. */
  anchor?: InfiniteCanvasPoint;
  groupInsertion?: InfiniteCanvasDropPlacement["groupInsertion"];
  contentSize?: InfiniteCanvasSize;
  size: InfiniteCanvasSize;
  /** Snap policy for drop placement. `false` disables snapping. */
  snapPolicy?: InfiniteCanvasSnapPolicy | false;
  state: InfiniteCanvasState<Kind>;
  worldPoint: InfiniteCanvasPoint;
}>;

/** Returns the pointer-anchored placement used by drop previews and commits. */
function getInfiniteCanvasDropPlacement<Kind extends string>({
  anchor = { x: 0.5, y: 0.5 },
  groupInsertion,
  contentSize,
  size,
  snapPolicy,
  state,
  worldPoint,
}: InfiniteCanvasDropPlacementInput<Kind>): InfiniteCanvasDropPlacement {
  const rect: InfiniteCanvasRect = {
    height: size.height,
    width: size.width,
    x: worldPoint.x - size.width * anchor.x,
    y: worldPoint.y - size.height * anchor.y,
  };

  const placement = applySnapToRect(state, null, rect, snapPolicy, []);
  return {
    ...placement,
    ...(groupInsertion === undefined ? {} : { groupInsertion }),
    ...(contentSize === undefined ? {} : { contentSize }),
  };
}

export {
  EMPTY_INFINITE_CANVAS_DROP,
  createInfiniteCanvasDropInteraction,
  getInfiniteCanvasDropPlacement,
  isPointInsideInfiniteCanvasViewport,
  normalizeInfiniteCanvasDropValidation,
};

export type { InfiniteCanvasDropInteractionInput, InfiniteCanvasDropPlacementInput };
