import type { ReactNode } from "react";

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

/** One surface paints every framework pass of one placement, world passes before screen passes. */
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
  /** Which side of the window plane this surface paints. Each pass states the side it belongs to. */
  placement: InfiniteCanvasSceneLayerPlacement;
  spatialTargetResolvers?: readonly InfiniteCanvasSpatialTargetResolver<Kind>[];
  theme?: InfiniteCanvasTheme;
  zIndex?: number;
}>;

/** Renders the framework's passes behind and above the window plane. */
type InfiniteCanvasSceneSurface<Kind extends string, Payload = InfiniteCanvasDropPayload> = (
  props: InfiniteCanvasSceneSurfaceProps<Kind, Payload>,
) => ReactNode;

export { SCENE_UNDERLAY_Z_INDEX };
export type { InfiniteCanvasSceneSurface, InfiniteCanvasSceneSurfaceProps };
