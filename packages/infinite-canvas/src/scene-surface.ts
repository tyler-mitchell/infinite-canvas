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

/**
 * The contract between the viewport and whatever paints scene layers.
 *
 * Everything here is pure types and pure functions, so the viewport can decide
 * *whether* a scene surface is needed — and lay out around one — without
 * importing `three` or `@react-three/fiber`. The WebGPU implementation lives
 * behind the `@hyphened/infinite-canvas/scene` entry and is injected through the
 * `sceneSurface` prop, so a consumer that never renders scene content never
 * has a 3D engine anywhere in its module graph. A dynamic `import()` would not
 * have achieved that: bundlers follow static specifiers into lazy chunks and
 * fail to resolve the peer at build time, whatever the manifest claims.
 */

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

/**
 * A component that paints scene layers behind and above the window plane.
 * `InfiniteCanvasWebGpuSurface` from `@hyphened/infinite-canvas/scene` is the
 * implementation this framework ships; the seam exists so that it is
 * replaceable and, more importantly, omissible.
 */
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
