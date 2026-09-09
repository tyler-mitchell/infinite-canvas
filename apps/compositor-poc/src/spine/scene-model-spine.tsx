/**
 * Scene-model spine. Incubation artifact for the engine-first target in
 * docs/internal/shaping/compositor-blueprint.md, "Correction on 2026-09-08".
 *
 * Capability: the framework owns one world derived from canvas state; the GPU
 * render graph and the DOM window layer are two presentations of it.
 * Consumers add entities through state and commands and never write shaders.
 *
 * Entry point: a store change. Observable result: the world moves toward the
 * new state over time, and the DOM plane projects the same rects each frame.
 *
 * PROPOSED symbols are marked. Real imports are used where they exist.
 *
 * ---------------------------------------------------------------------------
 * REVISION 2 on 2026-09-08. Supersedes revision 1, which is kept nowhere: this
 * file is the whole spine.
 *
 * Referent: `getInfiniteCanvasSceneModel` and the frame path that consumes it.
 *
 * Revision 1 declared the scene model a pure-core root that maps state to
 * camera, windows, segments and viewport. That is the architecture the
 * compositor already has, with connections added and proxies renamed. It
 * carries two defects into the replacement:
 *
 *   No time. Nothing in the model lives longer than one frame, so no value can
 *   move toward another value. The owner reports that light changes
 *   instantly when focus moves. That is not a defect in a shader constant. A
 *   pure projection of the current state cannot produce a transition, because
 *   the previous value does not exist anywhere to move from.
 *
 *   No depth. `windows` are window proxies, which are rects. `segments` are
 *   pairs of 2D points. Today the only depth is `WindowInstance.state.w`, a
 *   normalized z-index, which is an order and not a position. The owner
 *   states the canvas is a world with depth and that everything on it belongs
 *   to that world.
 *
 * Evidence: packages/infinite-canvas/src/compositor/backend/surface.tsx builds
 * the whole frame from `store.state$.peek()` each tick; instances.ts writes
 * `tint.w` from `proxy.isActive`, a boolean, so emission is a step function;
 * @typegpu/radiance-cascades solves a 2D field and its `sdf` and `color` hooks
 * take a flat uv, so depth cannot enter the lighting through its API.
 *
 * The correction: the store holds intent, the world holds state. State is the
 * authority for what is drawn, and it moves toward intent over time. This
 * inverts what the surface uploads. Today it uploads final values. Here it
 * uploads targets, and the world keeps the current values on the GPU.
 * Continuity then belongs to the architecture instead of being eased at the
 * edges, and every pass reads a world that already moved.
 *
 * REVISION 3 on 2026-09-08. Extends revision 2; nothing in it is withdrawn.
 *
 * Referent: what the world carries, so a lighting model can read it.
 *
 * Revision 2 gave a window a height and left the rest of the scene as
 * rectangles. That is still not enough for any real lighting model. Read from
 * the source of TypeGPU's `rendering--area-light` example, which solves a
 * rectangular emitter with Linearly Transformed Cosines, a lighting model
 * needs three things the world does not have:
 *
 *   A receiving surface. LTC integrates irradiance at a point that has a
 *   world position and a normal. Our medium is a floor plane and the compositor
 *   has never named it. `ltcRectFormFactors` takes `normal`, `viewDir` and
 *   `worldPos` and builds a tangent basis from them.
 *
 *   A material. The LUT is indexed by roughness and view angle
 *   (`ltcUv(roughness, NdotV)`), so without roughness the lookup has nothing
 *   to index and the specular term is meaningless.
 *
 *   An emitter with orientation. `RectLight` is center, dirX, dirY, halfSize,
 *   color and intensity. A window has a rect and a height; it has no plane.
 *
 * Our geometry is the example's geometry seen from above: the medium is the
 * floor, a window is a panel parallel to it at `height`, and the camera looks
 * down. So the emitter basis is fixed rather than free, which is why this is
 * an extension of the world and not a new system.
 *
 * This revision adds those three to the world. It does NOT choose the lighting
 * model; that stays backlog item 7. It states what any candidate must be able
 * to read, so the choice is made against a world that can feed it.
 * ---------------------------------------------------------------------------
 */

import type { TgpuRoot } from "typegpu";

import {
  getInfiniteCanvasWindowConnectorSegment,
  getInfiniteCanvasWindowProxies,
  type InfiniteCanvasCamera,
  type InfiniteCanvasChromeMetrics,
  type InfiniteCanvasPoint,
  type InfiniteCanvasState,
  // The barrel renames the rect type, because the viewport component owns the
  // bare name in value space.
  type InfiniteCanvasViewportSize,
  type InfiniteCanvasWindowProxy,
} from "@hyphened/infinite-canvas";

// ---------------------------------------------------------------------------
// 1. State slice. PROPOSED in types.ts, reducer.ts, validation.ts, persistence.ts.
//    A connection is document state like a window: it undoes, serializes, and
//    belongs to a workspace. This is the `connections` slice the blueprint names.
//    Unchanged from revision 1.
// ---------------------------------------------------------------------------

type InfiniteCanvasConnection = Readonly<{
  from: string;
  id: string;
  /** Consumer-owned payload, validated by the consumer's guard like window.data. */
  data?: unknown;
  kind: string;
  to: string;
}>;

/** PROPOSED additions to InfiniteCanvasState. */
type SceneState<Kind extends string> = InfiniteCanvasState<Kind> &
  Readonly<{ connections: readonly InfiniteCanvasConnection[] }>;

/** PROPOSED reducer actions, routed like window actions through commands.ts. */
type ConnectionAction =
  | Readonly<{ connection: InfiniteCanvasConnection; type: "connection.open" }>
  | Readonly<{ connectionId: string; type: "connection.close" }>
  | Readonly<{
      connectionId: string;
      patch: Partial<InfiniteCanvasConnection>;
      type: "connection.update";
    }>;

// ---------------------------------------------------------------------------
// 2. Intent. PROPOSED: packages/infinite-canvas/src/scene-intent.ts, a
//    pure-core root. This is revision 1's scene model, narrowed to its true
//    job: what the document says the world should become. It is pure and it
//    holds no history. It is NOT what gets drawn.
//
//    `height` is the one addition to the per-window record. It is a world
//    coordinate above the floor plane, in the same units as rect, and it
//    replaces the normalized z-index in WindowInstance.state.w. The stack
//    order still decides it, but the value is a position, so lighting,
//    shadow and parallax can all read one number that means one thing.
// ---------------------------------------------------------------------------

type SceneSegment = Readonly<{
  connectionId: string;
  end: InfiniteCanvasPoint;
  kind: string;
  selected: boolean;
  start: InfiniteCanvasPoint;
}>;

/**
 * What one window should become. The world moves toward this.
 *
 * A window is an emitter, and revision 3 makes it one that a lighting model
 * can read. It is a panel parallel to the floor at `height`, facing down, so
 * its plane is fixed rather than free: the basis is the world's x and y axes
 * and the half size comes from the rect. That is the same shape as
 * `RectLight` in TypeGPU's area-light example, with the orientation implied
 * by the canvas rather than stored per window.
 */
type WindowIntent<Kind extends string> = Readonly<{
  /** World units above the floor plane. Derived from the stack order. */
  height: number;
  proxy: InfiniteCanvasWindowProxy<Kind>;
  /** Linear rgb the window gives off. */
  color: readonly [number, number, number];
  /** 0 to 1. How much light this window gives off when it is settled. */
  emission: number;
}>;

/**
 * The medium: the surface every light falls on. Revision 3 names it, because
 * a lighting model integrates irradiance at a point that has a position, a
 * normal and a material, and the compositor has never had one.
 *
 * The plane sits at height 0 and faces the viewer, so its normal is constant
 * and no per-pixel normal buffer is needed. Roughness and metallic are here
 * because the LTC lookup is indexed by roughness and view angle; a lighting
 * model that ignores them can leave them unread.
 */
type FloorMaterial = Readonly<{
  /** Linear rgb the medium reflects. */
  albedo: readonly [number, number, number];
  /** 0 is a mirror, 1 is fully diffuse. Indexes the LTC lookup. */
  roughness: number;
  /** 0 is dielectric, 1 is metal. */
  metallic: number;
}>;

/**
 * Where the viewer is. A lighting model needs a view direction per shaded
 * point, and the 2D camera has no eye. Height is in world units above the
 * floor, so a zoom moves the eye rather than scaling a flat picture.
 */
type SceneEye = Readonly<{ height: number }>;

type InfiniteCanvasSceneIntent<Kind extends string> = Readonly<{
  camera: InfiniteCanvasCamera;
  /** PROPOSED, policy-owned. One material for the whole medium to begin with. */
  floor: FloorMaterial;
  eye: SceneEye;
  segments: readonly SceneSegment[];
  viewport: InfiniteCanvasViewportSize;
  windows: readonly WindowIntent<Kind>[];
}>;

/** World units between one stack level and the next. PROPOSED, policy-owned. */
declare const WINDOW_HEIGHT_STEP: number;

/** PROPOSED, policy-owned, per window kind later. Linear rgb. */
declare const WINDOW_EMISSION_COLOR: readonly [number, number, number];

/** PROPOSED, policy-owned. The medium's material and where the viewer sits. */
declare const FLOOR_MATERIAL: FloorMaterial;
declare const EYE: SceneEye;

function getInfiniteCanvasSceneIntent<Kind extends string>(
  state: SceneState<Kind>,
  chrome: InfiniteCanvasChromeMetrics,
  devicePixelRatio: number,
): InfiniteCanvasSceneIntent<Kind> {
  const proxies = getInfiniteCanvasWindowProxies(state, chrome, devicePixelRatio);
  const byId = new Map(proxies.map((proxy) => [proxy.id, proxy]));
  const lowest = proxies.reduce((low, proxy) => Math.min(low, proxy.zIndex), 0);
  const windows = proxies.map((proxy) => ({
    color: WINDOW_EMISSION_COLOR,
    // A position, not an order: the gap between levels is a world distance.
    height: (proxy.zIndex - lowest) * WINDOW_HEIGHT_STEP,
    emission: proxy.isActive ? 1 : proxy.isSelected ? 0.4 : 0.12,
    proxy,
  }));
  const segments = state.connections.flatMap((connection) => {
    const from = byId.get(connection.from);
    const to = byId.get(connection.to);

    if (from === undefined || to === undefined) {
      return [];
    }

    const segment = getInfiniteCanvasWindowConnectorSegment(from, to);

    return [
      {
        connectionId: connection.id,
        end: segment.end,
        kind: connection.kind,
        // Selection targets already carry edge selection; see selection.ts.
        selected: false,
        start: segment.start,
      },
    ];
  });

  return {
    camera: state.camera,
    eye: EYE,
    floor: FLOOR_MATERIAL,
    segments,
    viewport: state.viewport,
    windows,
  };
}

// ---------------------------------------------------------------------------
// 3. The world. PROPOSED: compositor/backend/world.ts. This is the load-bearing
//    change and the reason for the revision.
//
//    The world is GPU-resident and it lives across frames. Each entity keeps
//    the values that must move continuously. Every frame the surface writes
//    the intent, then one compute pass moves the world toward it by dt. Render
//    passes read the world, never the intent, so nothing they draw can jump.
//
//    This is the pattern passes/particle-field.ts already uses: state in a
//    `root.createMutable` buffer, advanced by a compute step that takes dt from
//    the frame. The world generalizes it from particles to every entity.
// ---------------------------------------------------------------------------

/*
  PROPOSED schemas, in compositor/backend/world.ts:

  const WindowTarget = d.struct({
    rect: d.vec4f,        // world x, y, width, height
    height: d.f32,        // world units above the floor
    emission: d.f32,      // 0 to 1 when settled
    flags: d.vec2f,       // active, selected
  });

  const WindowBody = d.struct({
    rect: d.vec4f,        // where the window IS, moving toward target.rect
    height: d.f32,        // where it IS in depth
    emission: d.f32,      // how much light it gives off right now
    // Rate of change, so a move can overshoot and settle instead of ramping.
    velocity: d.vec4f,
  });

  const Targets = d.arrayOf(WindowTarget, WINDOW_CAPACITY);   // written per frame
  const Bodies  = d.arrayOf(WindowBody,   WINDOW_CAPACITY);   // owned by the GPU

  const targets = tgpu.accessor(Targets);
  const bodies  = tgpu.mutableAccessor(Bodies);   // the step writes it
  const world   = tgpu.accessor(Bodies);          // every pass reads it

  A window that appears starts settled at its target, so it does not fly in
  from the previous entity at that index. PROPOSED: the surface writes a
  `settle` count of leading entities that must be seeded this frame.
*/

/** PROPOSED. One compute step. It runs before every draw of the frame. */
declare const advanceWorld: unknown;
/*
  const advanceWorld = tgpu.computeFn({
    in: { gid: d.builtin.globalInvocationId },
    workgroupSize: [64],
  })((input) => {
    'use gpu';
    // Critically damped approach toward the target, in world units per second.
    // Reads targets.$[i], writes bodies.$[i]. Uses clock.$.dt like the
    // particle step, so one frame of lag never becomes a jump.
  });
*/

/**
 * PROPOSED: writes the intent into the target buffer and dispatches the step.
 * The surface calls this once per frame, before any pass draws.
 */
declare function advanceInfiniteCanvasWorld<Kind extends string>(
  root: TgpuRoot,
  intent: InfiniteCanvasSceneIntent<Kind>,
  deltaSeconds: number,
): Readonly<{ segmentCount: number; windowCount: number }>;
/*
  targetStore  = useReadonly(Targets)    -- written each frame from intent
  bodyStore    = useMutable(Bodies)      -- never written from the CPU
  segmentStore = useReadonly(SceneSegments)
  configured   = root.with(camera, cameraUniform).with(world, bodyStore)
                     .with(segments, segmentStore)

  Per frame: common.writeSoA(targetStore.buffer, columns(intent.windows))
             common.writeSoA(segmentStore.buffer, columns(intent.segments))
             advance.dispatchWorkgroups(ceil(windowCount / 64))
*/

// ---------------------------------------------------------------------------
// 4. Presentation. PROPOSED: every framework pass reads `world.$[i]`, so it
//    draws where the window IS, not where the document says it should be.
//    `WindowInstance.state.w` is DELETED with its normalized z-index; depth is
//    `world.$[i].height` in world units.
//
//    The lighting technique is chosen against this model, not inherited.
//    @typegpu/radiance-cascades solves a 2D field: its `sdf` and `color` hooks
//    take a flat uv, so a window's height cannot reach it. It is therefore NOT
//    the lighting owner for a world with depth, and the radiance pass is
//    DELETED rather than tuned. The replacement is an open decision and it is
//    the next thing to settle; it is not settled here, and nothing downstream
//    should assume a technique before it is.
//
//    Kept: passes/proximity.ts (a readback, no look of its own),
//    passes/particle-field.ts (already a simulation; its wander reads the
//    world instead of the instance rects).
//    Moved in: the playground's workflow-links-pass becomes
//    passes/connections.ts and reads `segments.$`.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// 5. Mount. PROPOSED: the viewport imports nothing from /scene. The /scene
//    entry exports `InfiniteCanvasCompositor`, a component the consumer
//    renders once anywhere inside the provider; it registers itself with the
//    viewport through a context the main entry owns. No `sceneSurface` prop,
//    no `sceneLayers` prop. Both are deleted with webgpu-era types.
//
//    `InfiniteCanvasScenePass.frameloop` is DELETED. The world advances every
//    frame by definition, so a demand mode cannot exist. It is unread today.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// 6. Signals as state. PROPOSED: readbacks write through a store method
//    `store.publishSignal("proximity", readings)` into `state.signals`, which
//    is view state (not in the undo document), replacing window-proximity.ts's
//    WeakMap. Hooks select from the store like every other slice.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// 7. Consumer view after the change: Polkadot's ConnectorLayer (SVG) and the
//    playground's links pass are deleted. Polkadot dispatches connection.open
//    when a relation is created; labels stay DOM in renderOverlay, projected
//    from intent.segments midpoints as they are today.
//
//    The DOM window plane still projects from the document, so a window's
//    frame lands where the document says while the world settles under it.
//    That gap is real and it is bounded by the settle time. It closes only
//    when the windows themselves live in the world, which is the html-in-canvas
//    end state and is out of scope here.
// ---------------------------------------------------------------------------

export type {
  ConnectionAction,
  FloorMaterial,
  InfiniteCanvasConnection,
  InfiniteCanvasSceneIntent,
  SceneEye,
  SceneSegment,
  SceneState,
  WindowIntent,
};
export { advanceInfiniteCanvasWorld, advanceWorld, getInfiniteCanvasSceneIntent };
