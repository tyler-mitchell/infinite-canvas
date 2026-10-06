import type { TgpuRoot, WithBinding } from "typegpu";

import type { InfiniteCanvasStore } from "../store";
import type {
  InfiniteCanvasDropPayload,
  InfiniteCanvasSceneLayerPlacement,
  InfiniteCanvasSceneLayerRenderContext,
  InfiniteCanvasSceneLayerSpace,
} from "../types";

/** Handed to a pass once. The pass creates pipelines and resources from this only. */
type CompositorBuildContext = Readonly<{
  /**
   * A root configured with the surface's resources: the `camera` accessor holds
   * the camera of this pass's space and the `instances` accessor holds every
   * window instance. A pass creates its pipelines here and reads `camera.$`
   * and `instances.$` in shader code with no layout or bind group of its own.
   */
  configured: WithBinding;
  /** The color target format every pipeline must use. */
  format: GPUTextureFormat;
  /** Creates fixed resources the pass owns (root.createUniform, createReadonly, createMutable). */
  root: TgpuRoot;
  /** The store's readback slices. A readback pass publishes here; nothing else writes them. */
  signals$: InfiniteCanvasStore["signals$"];
}>;

/**
 * Source over destination with a premultiplied source. The canvas is
 * premultiplied, so a pass that lays paint on the medium uses this and writes
 * `vec4f(colour * amount, amount)`.
 */
const PREMULTIPLIED_OVER_BLEND: GPUBlendState = {
  alpha: { dstFactor: "one-minus-src-alpha", operation: "add", srcFactor: "one" },
  color: { dstFactor: "one-minus-src-alpha", operation: "add", srcFactor: "one" },
};

/** Source added to destination, for a pass whose contributions accumulate rather than cover. */
const ADDITIVE_BLEND: GPUBlendState = {
  alpha: { dstFactor: "one", operation: "add", srcFactor: "one" },
  color: { dstFactor: "one", operation: "add", srcFactor: "one" },
};

/** The canvas as one draw sees it. */
type CompositorColorAttachment = Readonly<{
  clearValue?: readonly [number, number, number, number];
  loadOp: GPULoadOp;
  storeOp: GPUStoreOp;
  view: GPUCanvasContext;
}>;

/**
 * Claims the canvas for one draw. The first claim of a frame clears the
 * canvas; every later claim keeps what the earlier draws put there. Call it
 * once for each draw:
 *
 * `pipeline.withColorAttachment(target()).draw(3)`
 */
type CompositorTarget = () => CompositorColorAttachment;

type CompositorFrameBase<Kind extends string, Payload> = Readonly<{
  context: InfiniteCanvasSceneLayerRenderContext<Kind, Payload>;
  /** Seconds since the previous frame. */
  deltaSeconds: number;
  /** Seconds since the surface mounted. */
  elapsedSeconds: number;
  /** Window instances written this frame. Draw or dispatch at most this many from `instances`. */
  instanceCount: number;
}>;

type CompositorFrame<
  Kind extends string,
  Payload = InfiniteCanvasDropPayload,
> = CompositorFrameBase<Kind, Payload> & Readonly<{ target: CompositorTarget }>;

type CompositorBuiltPass<Kind extends string, Payload = InfiniteCanvasDropPayload> = Readonly<{
  /**
   * Dispatches compute work. It runs before every draw of the frame, so a
   * draw reads what it wrote. Dispatch with no pass and no encoder
   * (`pipeline.dispatchWorkgroups(n)`): each dispatch submits itself.
   */
  compute?: (frame: CompositorFrameBase<Kind, Payload>) => void;
  /**
   * Reads GPU results back to the CPU. It runs after every draw of the frame,
   * so the read observes this frame's work.
   */
  readback?: (frame: CompositorFrameBase<Kind, Payload>) => void;
  /** Draws onto the canvas. Take the attachment from `target()`, once per draw. */
  record?: (frame: CompositorFrame<Kind, Payload>) => void;
}>;

/** A scene layer after the pivot: data the surface builds once and draws per frame. */
type InfiniteCanvasScenePass<
  Kind extends string = string,
  Payload = InfiniteCanvasDropPayload,
> = Readonly<{
  build: (context: CompositorBuildContext) => CompositorBuiltPass<Kind, Payload>;
  placement?: InfiniteCanvasSceneLayerPlacement;
  space?: InfiniteCanvasSceneLayerSpace;
}>;

export { ADDITIVE_BLEND, PREMULTIPLIED_OVER_BLEND };
export type {
  CompositorBuildContext,
  CompositorBuiltPass,
  CompositorColorAttachment,
  CompositorFrame,
  CompositorFrameBase,
  CompositorTarget,
  InfiniteCanvasScenePass,
};
