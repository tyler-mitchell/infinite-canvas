/**
 * Compositor spine. Incubation artifact, not shipped code.
 *
 * Capability: paint scene layers behind and above the DOM window plane with a
 * TypeGPU pass graph, and remove `three` and `@react-three/fiber` from the
 * framework.
 *
 * Owning invariant: the viewport paints every scene layer through one
 * `InfiniteCanvasSceneSurface` seam, and that seam has no engine type in its
 * input or output.
 *
 * Entry point: `InfiniteCanvasViewport` mounts `sceneSurface` for a placement.
 * Observable result: a canvas under (or over) the window plane shows every
 * pass of that placement, in declaration order, aligned with the DOM windows
 * on the same frame as the camera state that produced it.
 *
 * Authorities read in full on 2026-09-08: docs/compositor.md, TypeGPU 0.12
 * docs (pipelines, roots, bind groups, buffers, textures, slots, accessors),
 * apps/compositor-poc/src/main.ts, packages/infinite-canvas/src/webgpu-surface.tsx,
 * visibility.tsx, visibility-probes.tsx, scene-surface.ts, types.ts.
 *
 * Symbols marked PROPOSED do not exist yet. Every other import is real.
 */

import {
  d,
  tgpu,
  type TgpuFragmentFn,
  type TgpuRoot,
  type TgpuUniformBuffer,
  type TgpuVertexFn,
} from "typegpu";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";

import type {
  InfiniteCanvasCamera,
  InfiniteCanvasChromeMetrics,
  InfiniteCanvasDropInteraction,
  InfiniteCanvasDropPayload,
  InfiniteCanvasSceneLayerRenderContext,
  InfiniteCanvasSceneLayerPlacement,
  InfiniteCanvasSceneLayerSpace,
  InfiniteCanvasState,
  InfiniteCanvasTheme,
  InfiniteCanvasViewport,
  InfiniteCanvasWindow,
} from "../../../../packages/infinite-canvas/src/types.ts";
import type { InfiniteCanvasDiagnosticsPolicy } from "../../../../packages/infinite-canvas/src/diagnostics.tsx";
import { isWorldRectWithinViewport } from "../../../../packages/infinite-canvas/src/geometry.ts";
import {
  useInfiniteCanvasStore,
  useInfiniteCanvasState,
} from "../../../../packages/infinite-canvas/src/store.tsx";
import { useInfiniteCanvasVisibilityContext } from "../../../../packages/infinite-canvas/src/visibility.tsx";

// ---------------------------------------------------------------------------
// 1. Pass contract. PROPOSED: packages/infinite-canvas/src/compositor/pass.ts
//    This file must not import typegpu. Only the backend directory names it.
// ---------------------------------------------------------------------------

/** The per-space camera uniform. Written once per frame per space by the graph. */
const CompositorCamera = d.struct({
  /** World units at the viewport centre. Zero for screen space. */
  center: d.vec2f,
  /** CSS pixels. */
  viewport: d.vec2f,
  /** Device pixels per world unit. One for screen space. */
  zoom: d.f32,
  devicePixelRatio: d.f32,
});

type CompositorCameraUniform = TgpuUniformBuffer<typeof CompositorCamera>;

/**
 * What the graph hands a pass once, at build time. The pass creates its
 * pipelines, layouts, buffers, and bind groups from this and nothing else.
 * PROPOSED type.
 */
type CompositorBuildContext = Readonly<{
  /** Owned by the surface. A pass never calls tgpu.init. */
  root: TgpuRoot;
  /** The camera uniform for this pass's space. Bind it; never write it. */
  camera: CompositorCameraUniform;
  /** The color target format of the shared pass. Every pipeline must use it. */
  format: GPUTextureFormat;
}>;

/**
 * What the graph hands a built pass every frame. `record` receives the shared
 * render pass; a pass must not begin its own pass or submit its own buffer.
 * PROPOSED type. The pass type is the TypeGPU typed render pass from
 * `root['~unstable'].createCommandEncoder().beginRenderPass(...)`.
 */
type CompositorRenderPass = ReturnType<
  ReturnType<TgpuRoot["~unstable"]["createCommandEncoder"]>["beginRenderPass"]
>;

type CompositorFrame<Kind extends string, Payload> = Readonly<{
  context: InfiniteCanvasSceneLayerRenderContext<Kind, Payload>;
  pass: CompositorRenderPass;
}>;

/** PROPOSED. Replaces the `render` field on InfiniteCanvasSceneLayer. */
type CompositorBuiltPass<Kind extends string, Payload> = Readonly<{
  /**
   * Called before each candidate frame with the latest scene context. Returns
   * true when this pass owns something that changed since its last record.
   * The graph draws the frame when any pass returns true, or when the store
   * revision changed, or when any pass declares frameloop "always".
   */
  invalidate: (context: InfiniteCanvasSceneLayerRenderContext<Kind, Payload>) => boolean;
  /** Uploads per-frame data and records draws into the shared pass. */
  record: (frame: CompositorFrame<Kind, Payload>) => void;
  /** Releases buffers the pass created. Pipelines are released by the root. */
  destroy: () => void;
  /** Awaited once at boot so the first frame does not stall. */
  ready: Promise<void>;
}>;

/**
 * PROPOSED shape of InfiniteCanvasSceneLayer after the pivot. `id`,
 * `placement`, `space`, and `frameloop` keep their current meaning. `render`
 * (ReactNode) is replaced by `build`. This is the only public type change in
 * the seam, and it is the coupling docs/compositor.md names.
 */
type InfiniteCanvasScenePass<Kind extends string, Payload = InfiniteCanvasDropPayload> = Readonly<{
  frameloop?: "always" | "demand";
  id: string;
  placement?: InfiniteCanvasSceneLayerPlacement;
  space?: InfiniteCanvasSceneLayerSpace;
  build: (context: CompositorBuildContext) => CompositorBuiltPass<Kind, Payload>;
}>;

// ---------------------------------------------------------------------------
// 2. Root ownership. PROPOSED: compositor/backend/root.tsx
//    One TgpuRoot per viewport, shared by both placements. TypeGPU docs:
//    "creating just one root at the start of the program is the safest bet".
// ---------------------------------------------------------------------------

type CompositorRootState =
  | Readonly<{ status: "booting" }>
  | Readonly<{ status: "ready"; root: TgpuRoot; format: GPUTextureFormat }>
  | Readonly<{ status: "unsupported"; reason: string }>;

/**
 * Owned by InfiniteCanvasViewport (not by each surface). Boots once, is
 * destroyed on viewport unmount. The `unsupported` branch replaces
 * WebGpuGuard's throw: the surface renders nothing and the DOM plane stands.
 */
function useCompositorRoot(): CompositorRootState {
  const [state, setState] = useState<CompositorRootState>({ status: "booting" });

  useEffect(() => {
    const controller = new AbortController();

    if (typeof navigator === "undefined" || navigator.gpu === undefined) {
      setState({ status: "unsupported", reason: "navigator.gpu is undefined" });

      return;
    }

    void tgpu
      .init({ device: { optionalFeatures: ["timestamp-query"] } })
      .then((root) => {
        if (controller.signal.aborted) {
          root.destroy();

          return;
        }

        setState({ format: navigator.gpu.getPreferredCanvasFormat(), root, status: "ready" });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setState({ reason: String(error), status: "unsupported" });
        }
      });

    return () => {
      controller.abort();
      setState((current) => {
        if (current.status === "ready") {
          current.root.destroy();
        }

        return { status: "booting" };
      });
    };
  }, []);

  return state;
}

// ---------------------------------------------------------------------------
// 3. Surface. PROPOSED: compositor/backend/surface.tsx, exported from the
//    `/scene` entry as InfiniteCanvasCompositorSurface. It replaces
//    InfiniteCanvasWebGpuSurface behind the unchanged seam
//    InfiniteCanvasSceneSurface. The viewport mounts it once per placement
//    with both spaces; the world passes record before the screen passes.
// ---------------------------------------------------------------------------

type CompositorSurfaceProps<Kind extends string, Payload> = Readonly<{
  chrome: InfiniteCanvasChromeMetrics;
  devicePixelRatio: number;
  diagnostics: InfiniteCanvasDiagnosticsPolicy;
  dropInteraction: InfiniteCanvasDropInteraction<Payload, Kind>;
  /** Already filtered to one placement by getSceneLayers in the viewport. */
  passes: readonly InfiniteCanvasScenePass<Kind, Payload>[];
  root: Extract<CompositorRootState, { status: "ready" }>;
  theme: InfiniteCanvasTheme;
  zIndex: number;
}>;

function getCameraValue(
  state: InfiniteCanvasState,
  space: InfiniteCanvasSceneLayerSpace,
  devicePixelRatio: number,
) {
  return space === "screen"
    ? {
        center: d.vec2f(0, 0),
        devicePixelRatio,
        viewport: d.vec2f(state.viewport.width, state.viewport.height),
        zoom: 1,
      }
    : {
        center: d.vec2f(state.camera.center.x, state.camera.center.y),
        devicePixelRatio,
        viewport: d.vec2f(state.viewport.width, state.viewport.height),
        zoom: state.camera.zoom,
      };
}

/**
 * Frame owner. Every value below has one origin:
 *   - camera and viewport: store.state$ (peeked, never React-rendered)
 *   - canvas size: ResizeObserver on the canvas, times devicePixelRatio
 *   - pass list: props, built once per (root, pass.id), rebuilt on identity change
 *   - dirty flag: store change, resize, pass.invalidate, or frameloop "always"
 */
function InfiniteCanvasCompositorSurface<Kind extends string, Payload = InfiniteCanvasDropPayload>(
  props: CompositorSurfaceProps<Kind, Payload>,
): ReactNode {
  const store = useInfiniteCanvasStore<Kind>();
  const state = useInfiniteCanvasState<Kind>();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { root, format } = props.root;

  // 3a. Per-space camera uniforms. Two buffers, both written each frame.
  const cameras = useMemo(
    () => ({
      screen: root.createBuffer(CompositorCamera).$usage("uniform"),
      world: root.createBuffer(CompositorCamera).$usage("uniform"),
    }),
    [root],
  );

  // 3b. Build passes once. Order is declaration order within each space;
  //     world passes precede screen passes so screen content draws on top.
  const built = useMemo(() => {
    const ordered = [
      ...props.passes.filter((pass) => (pass.space ?? "world") === "world"),
      ...props.passes.filter((pass) => (pass.space ?? "world") === "screen"),
    ];

    return ordered.map((pass) => ({
      always: pass.frameloop === "always",
      id: pass.id,
      pass: pass.build({
        camera: (pass.space ?? "world") === "screen" ? cameras.screen : cameras.world,
        format,
        root,
      }),
    }));
  }, [cameras, format, props.passes, root]);

  useEffect(
    () => () => {
      built.forEach((entry) => entry.pass.destroy());
    },
    [built],
  );

  // 3c. Boot: initAsync on every pipeline before the first frame. No timers.
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    setReady(false);
    void Promise.all(built.map((entry) => entry.pass.ready)).then(() => {
      if (!controller.signal.aborted) {
        setReady(true);
      }
    });

    return () => controller.abort();
  }, [built]);

  // 3d. Frame loop. One rAF in flight at most; scheduled only while dirty.
  useLayoutEffect(() => {
    const canvas = canvasRef.current;

    if (canvas === null || !ready) {
      return;
    }

    const context = root.configureContext({ alphaMode: "premultiplied", canvas });
    let frameHandle = 0;
    let dirty = true;

    const schedule = () => {
      if (frameHandle === 0) {
        frameHandle = requestAnimationFrame(frame);
      }
    };

    const frame = () => {
      frameHandle = 0;

      const latest = store.state$.peek() as InfiniteCanvasState<Kind>;
      // PROPOSED: getSceneLayerRenderContext(latest, props) extracts the
      // context construction now inlined in webgpu-surface.tsx lines 120-200.
      // Its output type is unchanged: InfiniteCanvasSceneLayerRenderContext.
      const sceneContext = getSceneLayerRenderContext(latest, props, store);
      const invalidated = built.some(
        (entry) => entry.always || entry.pass.invalidate(sceneContext),
      );

      if (!dirty && !invalidated) {
        return;
      }

      dirty = false;
      cameras.world.write(getCameraValue(latest, "world", props.devicePixelRatio));
      cameras.screen.write(getCameraValue(latest, "screen", props.devicePixelRatio));

      // One command buffer, one render pass, every pipeline of this placement.
      const encoder = root["~unstable"].createCommandEncoder();
      const pass = encoder.beginRenderPass({
        colorAttachments: { clearValue: [0, 0, 0, 0], loadOp: "clear", view: context },
      });

      built.forEach((entry) => entry.pass.record({ context: sceneContext, pass }));
      pass.end();
      encoder.submit();

      if (built.some((entry) => entry.always)) {
        schedule();
      }
    };

    // Store change is the invalidation source the current
    // InfiniteCanvasSceneStateInvalidator reads through React deps.
    const unsubscribe = store.state$.onChange(() => {
      dirty = true;
      schedule();
    });

    // Canvas backing size follows the element, capped at 2x like the proof.
    const observer = new ResizeObserver(() => {
      const ratio = Math.min(props.devicePixelRatio, 2);

      canvas.width = Math.max(Math.round(canvas.clientWidth * ratio), 1);
      canvas.height = Math.max(Math.round(canvas.clientHeight * ratio), 1);
      dirty = true;
      schedule();
    });

    observer.observe(canvas);
    schedule();

    return () => {
      unsubscribe();
      observer.disconnect();

      if (frameHandle !== 0) {
        cancelAnimationFrame(frameHandle);
      }
    };
  }, [built, cameras, props, ready, root, store]);

  // Diagnostics: the frustum probe no longer lives here. See section 4.
  void state;

  return (
    <div style={{ inset: 0, pointerEvents: "none", position: "absolute", zIndex: props.zIndex }}>
      <canvas ref={canvasRef} style={{ height: "100%", width: "100%" }} />
    </div>
  );
}

/** PROPOSED. Closed leaf: same body as the useMemo in webgpu-surface.tsx. */
declare function getSceneLayerRenderContext<Kind extends string, Payload>(
  state: InfiniteCanvasState<Kind>,
  props: CompositorSurfaceProps<Kind, Payload>,
  store: ReturnType<typeof useInfiniteCanvasStore<Kind>>,
): InfiniteCanvasSceneLayerRenderContext<Kind, Payload>;

// ---------------------------------------------------------------------------
// 4. Visibility probe. Replaces visibility-probes.tsx. Needs no GPU, so it
//    leaves the scene surface and becomes a store subscription inside
//    InfiniteCanvasVisibilityProvider, active when diagnostics.frustum is on.
//    The viewport condition `underlayWorldSceneLayers.length === 0 &&
//    !diagnostics.frustum` collapses to the layer count alone.
// ---------------------------------------------------------------------------

function getWindowVisibilityEntries<Kind extends string>(
  camera: InfiniteCanvasCamera,
  viewport: InfiniteCanvasViewport,
  windows: readonly InfiniteCanvasWindow<Kind>[],
) {
  return windows
    .filter((window) => window.mode !== "minimized")
    .map((window) => ({
      isFramed: isWorldRectWithinViewport(camera, viewport, window.rect, 0),
      windowId: window.id,
    }));
}

/** PROPOSED: lives in visibility.tsx. */
function useInfiniteCanvasWindowFrustumProbe(enabled: boolean) {
  const store = useInfiniteCanvasStore();
  const visibility = useInfiniteCanvasVisibilityContext();

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const probe = () => {
      const state = store.state$.peek() as InfiniteCanvasState;
      const entries = getWindowVisibilityEntries(state.camera, state.viewport, state.windows);

      visibility.retainWindows(entries.map((entry) => entry.windowId));
      visibility.markWindowsFramed(entries);
    };

    probe();

    return store.state$.onChange(probe);
  }, [enabled, store, visibility]);
}

// ---------------------------------------------------------------------------
// 5. First consumer pass: workflow-board links. PROPOSED: replaces the
//    <group>/<mesh> render in apps/playground/src/routes/workflow-board.tsx.
//    One instanced quad per link segment, in world space. This is the shape
//    the proof measured (storage array + instanced draw, 0.9 ms for 100k).
// ---------------------------------------------------------------------------

const LinkSegment = d.struct({
  /** World start and end. */
  a: d.vec2f,
  b: d.vec2f,
  /** Screen pixels, so thickness stays constant across zoom. */
  thickness: d.f32,
  color: d.vec4f,
});

const LINK_CAPACITY = 256;

const linkLayout = tgpu.bindGroupLayout({
  camera: { uniform: CompositorCamera },
  segments: { access: "readonly", storage: d.arrayOf(LinkSegment) },
});

/**
 * Closed leaf: the WGSL. Input: instanceIndex, vertexIndex. Reads
 * layout.$.segments[instance] and layout.$.camera. Builds a screen-thick
 * oriented quad from a to b, converts world to clip as the proof's
 * surfaceVertex does. Fragment returns color. No new structure here.
 */
type LinkVaryings = { color: d.Vec4f };

declare const linkVertex: TgpuVertexFn<
  { instanceIndex: typeof d.builtin.instanceIndex; vertexIndex: typeof d.builtin.vertexIndex },
  LinkVaryings & { pos: typeof d.builtin.position }
>;
declare const linkFragment: TgpuFragmentFn<LinkVaryings, d.Vec4f>;

type LinkModel = Readonly<{
  /** Consumer-owned. Origin: the route's `connections` state plus the selection. */
  segments: readonly Readonly<{ a: [number, number]; b: [number, number]; selected: boolean }>[];
  revision: number;
}>;

function createWorkflowLinksPass<Kind extends string>(
  readModel: (context: InfiniteCanvasSceneLayerRenderContext<Kind>) => LinkModel,
): InfiniteCanvasScenePass<Kind> {
  return {
    frameloop: "demand",
    id: "workflow-links",
    placement: "underlay",
    space: "world",
    build: ({ camera, format, root }) => {
      const segments = root.createBuffer(d.arrayOf(LinkSegment, LINK_CAPACITY)).$usage("storage");
      const bindGroup = root.createBindGroup(linkLayout, { camera, segments });
      const pipeline = root
        .createRenderPipeline({
          fragment: linkFragment,
          primitive: { topology: "triangle-list" },
          targets: {
            blend: {
              alpha: { dstFactor: "one-minus-src-alpha", operation: "add", srcFactor: "one" },
              color: { dstFactor: "one-minus-src-alpha", operation: "add", srcFactor: "src-alpha" },
            },
            format,
          },
          vertex: linkVertex,
        })
        .with(bindGroup);

      let recordedRevision = -1;
      let count = 0;

      return {
        destroy: () => segments.destroy(),
        invalidate: (context) => readModel(context).revision !== recordedRevision,
        ready: pipeline.initAsync(),
        record: ({ context, pass }) => {
          const model = readModel(context);

          if (model.revision !== recordedRevision) {
            recordedRevision = model.revision;
            count = Math.min(model.segments.length, LINK_CAPACITY);
            segments.write(
              model.segments.slice(0, count).map((segment) => ({
                a: d.vec2f(...segment.a),
                b: d.vec2f(...segment.b),
                color: segment.selected
                  ? d.vec4f(0.73, 0.9, 0.99, 0.95)
                  : d.vec4f(0.22, 0.74, 0.97, 0.55),
                thickness: segment.selected ? 4 : 2,
              })),
            );
          }

          pipeline.with(pass).draw(6, count);
        },
      };
    },
  };
}

// ---------------------------------------------------------------------------
// 6. Viewport mount. The only change in infinite-canvas.tsx: two mounts
//    (underlay, overlay) instead of four, each receiving both spaces, plus the
//    root from useCompositorRoot. Everything else in the layer stack stays.
// ---------------------------------------------------------------------------

declare const viewportSketch: <Kind extends string, Payload>(
  args: Readonly<{
    SceneSurface: typeof InfiniteCanvasCompositorSurface<Kind, Payload> | undefined;
    diagnostics: InfiniteCanvasDiagnosticsPolicy;
    overlayPasses: readonly InfiniteCanvasScenePass<Kind, Payload>[];
    underlayPasses: readonly InfiniteCanvasScenePass<Kind, Payload>[];
  }>,
) => ReactNode;
/*
  const root = useCompositorRoot();                     // once per viewport
  useInfiniteCanvasWindowFrustumProbe(diagnostics.frustum); // no GPU dependency

  {SceneSurface !== undefined && root.status === "ready" && underlayPasses.length > 0 ? (
    <SceneSurface passes={underlayPasses} root={root} zIndex={SCENE_UNDERLAY_Z_INDEX} ... />
  ) : null}
  ...group layer, window layer...
  {SceneSurface !== undefined && root.status === "ready" && overlayPasses.length > 0 ? (
    <SceneSurface passes={overlayPasses} root={root} zIndex={SCENE_OVERLAY_Z_INDEX} ... />
  ) : null}

  root.status === "unsupported": nothing mounts; the DOM plane is the fallback.
  SCENE_SCREEN_UNDERLAY_Z_INDEX and SCENE_SCREEN_OVERLAY_Z_INDEX are deleted.
*/
void viewportSketch;
void createWorkflowLinksPass;
void useInfiniteCanvasWindowFrustumProbe;
void InfiniteCanvasCompositorSurface;
void useCompositorRoot;

// ---------------------------------------------------------------------------
// 7. End state: html-in-canvas. Owner direction stated 2026-09-08: the target
//    is a canvas fully driven by html-in-canvas. It has not shipped in stable
//    Chrome (Origin Trial / flag, per docs/research/html-in-canvas.md), so it
//    is not in this spine's implementation scope. This section fixes the
//    structural facts now so that program extends sections 1-6 without
//    replacing any owner.
// ---------------------------------------------------------------------------
/*
  Facts fixed by this spine that the end state depends on:

  - ONE ROOT. useCompositorRoot owns the only TgpuRoot. Capture needs
    root.device.queue.copyElementImageToTexture and root.unwrap(texture).
    A per-surface root would make the window texture unreachable from the
    window pass. Section 2 is therefore load-bearing for the end state.

  - GRAPH-OWNED RESOURCES. The texture array that holds captured windows is a
    CompositorResource allocated by the surface, not by a pass. It is handed
    to passes through CompositorBuildContext, the same way `camera` is today.
    PROPOSED addition when the program starts:
      CompositorBuildContext.resources: Readonly<Record<string, TgpuTexture>>
    Residency (256 layers, eviction, scale) is the surface's policy.

  - THE WINDOW PASS IS A PASS. Textured window quads are one
    InfiniteCanvasScenePass with placement "underlay", space "world", built
    from the same contract as the links pass in section 5. It reads the
    texture array and the window proxies from the scene context. No new
    surface, no new frame loop.

  - THE DOM STAYS THE AUTHORITY. Layout, focus, hit tests, accessibility, and
    the window under edit remain live DOM. Capture targets are immediate
    children of one `layoutsubtree` canvas. That canvas is the window layer
    element itself (INFINITE_CANVAS_SLOTS window layer), which today is a
    <div>; it becomes a <canvas layoutsubtree> with the same <article>
    children. The window frame contract does not change.

  - CAPTURE IS SCHEDULED BY THE SURFACE. The `paint` event's changedElements
    is the only dirty set. The surface coalesces one requestPaint per frame,
    copies changed windows into their layers, then records the frame. The
    measured budget (about 20 captures per 60 Hz frame) is a surface policy,
    not a pass concern.

  - FEATURE GATE. `supportsHtmlInCanvas()` (named in
    docs/research/html-in-canvas.md; checks a 2D context for drawElementImage
    and the queue for copyElementImageToTexture) decides at boot whether the
    window pass mounts. Without it the DOM window layer paints as it does
    today. This is the same shape as the `unsupported` branch in section 2.
*/

// ---------------------------------------------------------------------------
// 8. Teardown. Each target has its dependency closure named.
// ---------------------------------------------------------------------------
/*
  DELETE packages/infinite-canvas/src/webgpu-surface.tsx
    -> scene.ts re-export changes to InfiniteCanvasCompositorSurface.
  DELETE packages/infinite-canvas/src/visibility-probes.tsx
    -> scene.ts re-export of InfiniteCanvasWindowFrustumProbeLayer removed.
    -> visibility-devtools.tsx keeps reading visibility.state$; unchanged.
  DELETE getInfiniteCanvasWorldSegmentSceneTransform and
         getInfiniteCanvasWorldPathSceneTransforms (scene-layer-geometry.ts)
    -> only consumer is workflow-board.tsx, replaced by section 5.
    -> InfiniteCanvasSceneSegmentTransform type removed; docs/API.md rows removed.
  DELETE InfiniteCanvasSceneVector3 fields on InfiniteCanvasWindowProxy:
         bodyScenePosition, frameScenePosition, screenPosition (window-proxy.ts)
    -> exist only for Three's y-up, z-depth placement.
    -> scene-layer-geometry.test.ts and framework-boundary.test.ts fixtures updated.
  CHANGE InfiniteCanvasSceneLayer.render -> build (types.ts)
    -> docs/API.md entry; consumer-visible, so a Bumpy bump file (minor).
  CHANGE InfiniteCanvasSceneSurfaceProps (scene-surface.ts): drop `space` and
         `sceneLayers`, add `passes` and `root`.
  DELETE peerDependencies three, @react-three/fiber; devDependencies
         @types/three, three, @react-three/fiber, @react-three/drei in
         packages/infinite-canvas/package.json; the "react-three-fiber" keyword;
         the canary catalog pins in pnpm-workspace.yaml once apps/playground
         drops them too.
  ADD dependency typegpu (catalog) to packages/infinite-canvas; unplugin-typegpu
         to its build config, as apps/compositor-poc already does.
  UPDATE verify-pure-core.mjs banned list: replace three and
         @react-three/fiber with typegpu, so the core still cannot import the GPU.
  UPDATE docs/compositor.md "Target module structure" to match sections 1-3.
*/
