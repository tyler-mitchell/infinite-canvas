import type { SurfaceShader } from "../surface.ts";
import { DEFAULT_FIELD_OPTIONS, createFieldSource, type FieldOptions } from "./field.ts";
import { DEFAULT_GLINT_OPTIONS, createGlintEffect, type GlintOptions } from "./glints.ts";

/** A folded glow field with glints twinkling on its bright parts. */
export type SparkleOptions = Readonly<{
  field: FieldOptions;
  /** `false` paints the field alone. */
  glints: GlintOptions | false;
}>;

/** Each part takes a whole, a partial over its defaults, or nothing for the defaults. */
export type SparkleOptionsInput = Readonly<{
  field?: Partial<FieldOptions>;
  glints?: Partial<GlintOptions> | false;
}>;

export const DEFAULT_SPARKLE_OPTIONS: SparkleOptions = {
  field: DEFAULT_FIELD_OPTIONS,
  glints: DEFAULT_GLINT_OPTIONS,
};

/** Build once, outside render: each call specialises a new pair of shaders. */
export function sparkle(options: SparkleOptionsInput = {}): SurfaceShader {
  const field = { ...DEFAULT_FIELD_OPTIONS, ...options.field };
  const glints = options.glints === false ? false : { ...DEFAULT_GLINT_OPTIONS, ...options.glints };

  return {
    effects: glints === false ? [] : [createGlintEffect(glints)],
    source: createFieldSource(field),
  };
}

/** The sparkle as tuned. */
export const SPARKLE: SurfaceShader = sparkle();

export { DEFAULT_FIELD_OPTIONS, DEFAULT_GLINT_OPTIONS };
export type { FieldOptions, GlintOptions };
