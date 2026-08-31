import type { ReactNode } from "react";

import type { InfiniteCanvasDiagnosticsPolicy } from "./diagnostics";
import type {
  InfiniteCanvasChromeMetrics,
  InfiniteCanvasDropInteraction,
  InfiniteCanvasDropPayload,
  InfiniteCanvasSceneLayer,
  InfiniteCanvasSceneLayerPlacement,
  InfiniteCanvasSceneLayerSpace,
  InfiniteCanvasSpatialTargetResolver,
  InfiniteCanvasTheme,
} from "./types";

/** Defines the renderer-neutral scene surface contract. */
const SCENE_UNDERLAY_Z_INDEX = 0;

type InfiniteCanvasSceneSurfaceProps<
  Kind extends string,
  Payload = InfiniteCanvasDropPayload,
> = Readonly<{
  chrome?: InfiniteCanvasChromeMetrics;
  devicePixelRatio?: number;
  diagnostics: InfiniteCanvasDiagnosticsPolicy;
  dropInteraction?: InfiniteCanvasDropInteraction<Payload, Kind>;
  sceneLayers?: readonly InfiniteCanvasSceneLayer<Kind, Payload>[];
  space?: InfiniteCanvasSceneLayerSpace;
  spatialTargetResolvers?: readonly InfiniteCanvasSpatialTargetResolver<Kind>[];
  theme?: InfiniteCanvasTheme;
  zIndex?: number;
}>;

/** Renders scene layers behind and above the window plane. */
type InfiniteCanvasSceneSurface<Kind extends string, Payload = InfiniteCanvasDropPayload> = (
  props: InfiniteCanvasSceneSurfaceProps<Kind, Payload>,
) => ReactNode;

function getSceneLayerPlacement<Kind extends string, Payload>(
  layer: InfiniteCanvasSceneLayer<Kind, Payload>,
): InfiniteCanvasSceneLayerPlacement {
  return layer.placement ?? "underlay";
}

function getSceneLayerSpace<Kind extends string, Payload>(
  layer: InfiniteCanvasSceneLayer<Kind, Payload>,
): InfiniteCanvasSceneLayerSpace {
  return layer.space ?? "world";
}

function getSceneLayers<Kind extends string, Payload>(
  layers: readonly InfiniteCanvasSceneLayer<Kind, Payload>[],
  placement: InfiniteCanvasSceneLayerPlacement,
  space: InfiniteCanvasSceneLayerSpace,
) {
  return layers.filter(
    (layer) => getSceneLayerPlacement(layer) === placement && getSceneLayerSpace(layer) === space,
  );
}

export { SCENE_UNDERLAY_Z_INDEX, getSceneLayerPlacement, getSceneLayerSpace, getSceneLayers };
export type { InfiniteCanvasSceneSurface, InfiniteCanvasSceneSurfaceProps };
