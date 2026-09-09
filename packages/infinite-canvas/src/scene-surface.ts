import type { ReactNode } from "react";

import type { InfiniteCanvasScenePass } from "./compositor/pass";
import type { InfiniteCanvasCompositorPolicy } from "./compositor/policy";
import type { InfiniteCanvasDiagnosticsPolicy } from "./diagnostics";
import type {
  InfiniteCanvasChromeMetrics,
  InfiniteCanvasDropInteraction,
  InfiniteCanvasDropPayload,
  InfiniteCanvasSceneLayerPlacement,
  InfiniteCanvasSpatialTargetResolver,
  InfiniteCanvasTheme,
} from "./types";

/** Defines the renderer-neutral scene surface contract. */
const SCENE_UNDERLAY_Z_INDEX = 0;

/** One surface paints every layer of one placement, world layers before screen layers. */
type InfiniteCanvasSceneSurfaceProps<
  Kind extends string,
  Payload = InfiniteCanvasDropPayload,
> = Readonly<{
  chrome?: InfiniteCanvasChromeMetrics;
  /** Which framework passes run and how each is tuned. Resolved by the viewport. */
  compositor?: InfiniteCanvasCompositorPolicy;
  devicePixelRatio?: number;
  diagnostics: InfiniteCanvasDiagnosticsPolicy;
  dropInteraction?: InfiniteCanvasDropInteraction<Payload, Kind>;
  /** Which side of the window plane this surface paints. The framework's own passes live in the underlay. */
  placement: InfiniteCanvasSceneLayerPlacement;
  sceneLayers?: readonly InfiniteCanvasScenePass<Kind, Payload>[];
  spatialTargetResolvers?: readonly InfiniteCanvasSpatialTargetResolver<Kind>[];
  theme?: InfiniteCanvasTheme;
  zIndex?: number;
}>;

/** Renders scene layers behind and above the window plane. */
type InfiniteCanvasSceneSurface<Kind extends string, Payload = InfiniteCanvasDropPayload> = (
  props: InfiniteCanvasSceneSurfaceProps<Kind, Payload>,
) => ReactNode;

function getSceneLayers<Kind extends string, Payload>(
  layers: readonly InfiniteCanvasScenePass<Kind, Payload>[],
  placement: InfiniteCanvasSceneLayerPlacement,
) {
  return layers.filter((layer) => (layer.placement ?? "underlay") === placement);
}

export { SCENE_UNDERLAY_Z_INDEX, getSceneLayers };
export type { InfiniteCanvasSceneSurface, InfiniteCanvasSceneSurfaceProps };
