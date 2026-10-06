/**
 * The compositor policy: which framework passes the surface mounts and how
 * each is tuned. No GPU import, so the viewport can resolve it without the
 * GPU stack. Follows the `hud` and `rasterization` policy shape.
 */

type InfiniteCanvasContactShadowOptions = Readonly<{
  /** Window corner radius in world units, as the shadow sees it. */
  cornerRadius: number;
  /** How far below the window the shadow falls, in world units, at the back of the stack. */
  offset: number;
  /** Darkness at the shadow's core, 0 to 1. */
  opacity: number;
  /** World units over which the shadow edge fades out, at the back of the stack. */
  softness: number;
}>;

type InfiniteCanvasParticleFieldOptions = Readonly<{
  /** Extra pull of the active window as a multiple of `gravity`. Zero for no difference. */
  activeBoost: number;
  /** Particles simulated. Clamped to the pass capacity of 4096. */
  count: number;
  /** Fraction of velocity lost per second. */
  damping: number;
  /** World units per second squared the flow field pushes a particle. */
  drift: number;
  /** How tight the flow field's swirls are. Higher is busier. */
  flowScale: number;
  /** World units per second squared a window bends nearby drift. Zero for no shaping. */
  gravity: number;
  /** World units per second a particle can move at most. */
  maxSpeed: number;
  /** Peak alpha of one particle, 0 to 1. */
  opacity: number;
  /** World units from a window's edge where its shaping is strongest. It fades past that. */
  reach: number;
  /** When the viewer prefers reduced motion, place the particles once and stop. */
  respectReducedMotion: boolean;
  /** Diameter of one particle in CSS pixels. */
  sizePx: number;
  /** sRGB, 0 to 1, the same channels a CSS hex carries. */
  tint: readonly [number, number, number];
}>;

type InfiniteCanvasConnectionsOptions = Readonly<{
  /** Peak alpha of a resting edge, 0 to 1. */
  opacity: number;
  /** Peak alpha of a selected edge, 0 to 1. */
  selectedOpacity: number;
  /** Line width of a selected edge in CSS pixels. */
  selectedThicknessPx: number;
  /** sRGB, 0 to 1, the same channels a CSS hex carries. */
  selectedTint: readonly [number, number, number];
  /** Line width in CSS pixels, held constant across zoom. */
  thicknessPx: number;
  /** sRGB, 0 to 1, the same channels a CSS hex carries. */
  tint: readonly [number, number, number];
}>;

type InfiniteCanvasDropPreviewOptions = Readonly<{
  /** Peak alpha of a refused placement, 0 to 1. */
  invalidOpacity: number;
  /** sRGB, 0 to 1, the same channels a CSS hex carries. */
  invalidTint: readonly [number, number, number];
  /** Peak alpha of an accepted placement, 0 to 1. */
  validOpacity: number;
  /** sRGB, 0 to 1, the same channels a CSS hex carries. */
  validTint: readonly [number, number, number];
}>;

type InfiniteCanvasProximityOptions = Readonly<{
  /** World units. Windows farther apart than this do not see each other. */
  reach: number;
}>;

type InfiniteCanvasAreaLightOptions = Readonly<{
  /** World units a window rises above the medium for each step up the stack. */
  heightStep: number;
  /** Multiplier on the light the medium receives. */
  intensity: number;
}>;

type InfiniteCanvasGridOptions = Readonly<{
  /** How much the grid fades toward the edges of the view, 0 to 1. */
  falloff: number;
  /** Line width in CSS pixels, held constant across zoom. */
  lineWidthPx: number;
  /** Minor lines between one major line and the next. */
  majorEvery: number;
  /** Peak alpha of a major line, 0 to 1. */
  majorOpacity: number;
  /** Peak alpha of a minor line, 0 to 1. */
  minorOpacity: number;
  /** sRGB, 0 to 1, the same channels a CSS hex carries. */
  tint: readonly [number, number, number];
}>;

type InfiniteCanvasFocusFieldOptions = Readonly<{
  /** How dark the medium becomes at full distance, 0 to 1. */
  dimStrength: number;
  /** CSS pixels the medium stays lit around the active window. */
  reachPx: number;
}>;

type InfiniteCanvasCompositorPolicy = Readonly<{
  areaLight: InfiniteCanvasAreaLightOptions | false;
  connections: InfiniteCanvasConnectionsOptions | false;
  contactShadow: InfiniteCanvasContactShadowOptions | false;
  dropPreview: InfiniteCanvasDropPreviewOptions | false;
  focusField: InfiniteCanvasFocusFieldOptions | false;
  grid: InfiniteCanvasGridOptions | false;
  particleField: InfiniteCanvasParticleFieldOptions | false;
  proximity: InfiniteCanvasProximityOptions | false;
}>;

/** `true` keeps the defaults, `false` disables the pass, an object overrides fields. */
type InfiniteCanvasCompositorPolicyInput = Readonly<{
  areaLight?: Partial<InfiniteCanvasAreaLightOptions> | boolean;
  connections?: Partial<InfiniteCanvasConnectionsOptions> | boolean;
  contactShadow?: Partial<InfiniteCanvasContactShadowOptions> | boolean;
  dropPreview?: Partial<InfiniteCanvasDropPreviewOptions> | boolean;
  focusField?: Partial<InfiniteCanvasFocusFieldOptions> | boolean;
  grid?: Partial<InfiniteCanvasGridOptions> | boolean;
  particleField?: Partial<InfiniteCanvasParticleFieldOptions> | boolean;
  proximity?: Partial<InfiniteCanvasProximityOptions> | boolean;
}>;

const DEFAULT_AREA_LIGHT_OPTIONS: InfiniteCanvasAreaLightOptions = {
  heightStep: 90,
  intensity: 0.28,
};

const DEFAULT_CONTACT_SHADOW_OPTIONS: InfiniteCanvasContactShadowOptions = {
  cornerRadius: 8,
  offset: 6,
  opacity: 0.35,
  softness: 24,
};

// Matches the CSS backdrop this replaces: --icx-grid-major rgba(61,102,112,.24)
// and --icx-grid-minor rgba(38,66,74,.18), with a falloff CSS could not do.
const DEFAULT_GRID_OPTIONS: InfiniteCanvasGridOptions = {
  falloff: 0.55,
  lineWidthPx: 1.25,
  majorEvery: 4,
  majorOpacity: 0.24,
  minorOpacity: 0.18,
  tint: [0.24, 0.4, 0.44],
};

const DEFAULT_FOCUS_FIELD_OPTIONS: InfiniteCanvasFocusFieldOptions = {
  dimStrength: 0.42,
  reachPx: 420,
};

const DEFAULT_PARTICLE_FIELD_OPTIONS: InfiniteCanvasParticleFieldOptions = {
  activeBoost: 0.35,
  count: 480,
  damping: 0.9,
  drift: 26,
  flowScale: 0.0016,
  gravity: 26,
  maxSpeed: 90,
  opacity: 0.28,
  reach: 150,
  respectReducedMotion: true,
  sizePx: 2.5,
  tint: [0.62, 0.74, 0.92],
};

/*
 * Neutral at rest, brighter when selected. Drawing every edge at full strength
 * spends the loudest value on whatever happens to exist and leaves nothing to
 * mark what a person is acting on.
 */
const DEFAULT_CONNECTIONS_OPTIONS: InfiniteCanvasConnectionsOptions = {
  opacity: 0.55,
  selectedOpacity: 0.95,
  selectedThicknessPx: 4,
  selectedTint: [0.69, 0.86, 0.94],
  thicknessPx: 2,
  tint: [0.22, 0.74, 0.96],
};

/*
 * Faint either way. The preview says where a thing will land, and a wash that
 * competes with the windows around it answers a question nobody asked.
 */
const DEFAULT_DROP_PREVIEW_OPTIONS: InfiniteCanvasDropPreviewOptions = {
  invalidOpacity: 0.08,
  invalidTint: [0.97, 0.44, 0.44],
  validOpacity: 0.16,
  validTint: [0.42, 0.78, 0.94],
};

const DEFAULT_PROXIMITY_OPTIONS: InfiniteCanvasProximityOptions = {
  reach: 240,
};

const DEFAULT_INFINITE_CANVAS_COMPOSITOR: InfiniteCanvasCompositorPolicy = {
  // Off by default. Irradiance on a featureless plane is a radial gradient, so
  // it reads as an aura rather than as light until the medium has structure.
  areaLight: false,
  // On by default: an edge in the document is content, and a canvas that holds
  // one and draws nothing is simply missing it.
  connections: DEFAULT_CONNECTIONS_OPTIONS,
  contactShadow: DEFAULT_CONTACT_SHADOW_OPTIONS,
  // On by default, and inert until a consumer supplies a dropPolicy that
  // resolves a placement. Without one it never draws.
  dropPreview: DEFAULT_DROP_PREVIEW_OPTIONS,
  // Off by default: the halo it leaves around the active window reads as an
  // aura on the medium. The pass stays available for a consumer that wants it.
  focusField: false,
  grid: DEFAULT_GRID_OPTIONS,
  particleField: DEFAULT_PARTICLE_FIELD_OPTIONS,
  // Off by default. The pass costs a compute dispatch and a GPU-to-CPU buffer
  // map every frame, and the map forces a synchronisation. Only a consumer
  // reading `useInfiniteCanvasWindowProximity` gets anything back for that.
  proximity: false,
};

/**
 * An absent field keeps whatever `DEFAULT_INFINITE_CANVAS_COMPOSITOR` says, so
 * which passes are on by default is stated there and nowhere else.
 */
function resolvePassOptions<Options extends object>(
  input: Partial<Options> | boolean | undefined,
  absent: Options | false,
  defaults: Options,
): Options | false {
  if (input === undefined) {
    return absent;
  }

  if (input === false) {
    return false;
  }

  return input === true ? defaults : { ...defaults, ...input };
}

/**
 * Whether anything the framework owns will paint above the window plane.
 *
 * The viewport mounts the overlay surface only when something will draw in it, and it cannot ask
 * the compositor directly without pulling the GPU stack into the main entry. This answers from the
 * policy, which has no GPU import.
 *
 * The drop preview is the only such pass, and it draws from a placement that `dropPolicy` resolves.
 * Without one it can never draw, so a canvas that takes no drops keeps a single surface.
 */
function hasInfiniteCanvasOverlayPass(
  input: Readonly<{ hasDropPolicy: boolean; policy: InfiniteCanvasCompositorPolicy }>,
): boolean {
  return input.hasDropPolicy && input.policy.dropPreview !== false;
}

function resolveInfiniteCanvasCompositorPolicy(
  input?: InfiniteCanvasCompositorPolicyInput,
): InfiniteCanvasCompositorPolicy {
  const absent = DEFAULT_INFINITE_CANVAS_COMPOSITOR;

  return {
    areaLight: resolvePassOptions(input?.areaLight, absent.areaLight, DEFAULT_AREA_LIGHT_OPTIONS),
    connections: resolvePassOptions(
      input?.connections,
      absent.connections,
      DEFAULT_CONNECTIONS_OPTIONS,
    ),
    contactShadow: resolvePassOptions(
      input?.contactShadow,
      absent.contactShadow,
      DEFAULT_CONTACT_SHADOW_OPTIONS,
    ),
    dropPreview: resolvePassOptions(
      input?.dropPreview,
      absent.dropPreview,
      DEFAULT_DROP_PREVIEW_OPTIONS,
    ),
    focusField: resolvePassOptions(
      input?.focusField,
      absent.focusField,
      DEFAULT_FOCUS_FIELD_OPTIONS,
    ),
    grid: resolvePassOptions(input?.grid, absent.grid, DEFAULT_GRID_OPTIONS),
    particleField: resolvePassOptions(
      input?.particleField,
      absent.particleField,
      DEFAULT_PARTICLE_FIELD_OPTIONS,
    ),
    proximity: resolvePassOptions(input?.proximity, absent.proximity, DEFAULT_PROXIMITY_OPTIONS),
  };
}

export {
  DEFAULT_AREA_LIGHT_OPTIONS,
  DEFAULT_CONNECTIONS_OPTIONS,
  DEFAULT_CONTACT_SHADOW_OPTIONS,
  DEFAULT_DROP_PREVIEW_OPTIONS,
  DEFAULT_FOCUS_FIELD_OPTIONS,
  DEFAULT_GRID_OPTIONS,
  DEFAULT_INFINITE_CANVAS_COMPOSITOR,
  DEFAULT_PARTICLE_FIELD_OPTIONS,
  DEFAULT_PROXIMITY_OPTIONS,
  hasInfiniteCanvasOverlayPass,
  resolveInfiniteCanvasCompositorPolicy,
};
export type {
  InfiniteCanvasAreaLightOptions,
  InfiniteCanvasCompositorPolicy,
  InfiniteCanvasConnectionsOptions,
  InfiniteCanvasContactShadowOptions,
  InfiniteCanvasCompositorPolicyInput,
  InfiniteCanvasDropPreviewOptions,
  InfiniteCanvasFocusFieldOptions,
  InfiniteCanvasGridOptions,
  InfiniteCanvasParticleFieldOptions,
  InfiniteCanvasProximityOptions,
};
