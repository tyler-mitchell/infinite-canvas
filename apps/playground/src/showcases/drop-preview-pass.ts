import {
  PREMULTIPLIED_OVER_BLEND,
  camera,
  screenToClip,
  worldToScreen,
  type InfiniteCanvasScenePass,
} from "@hyphened/infinite-canvas/scene";
import type { InfiniteCanvasSceneLayerRenderContext } from "@hyphened/infinite-canvas";
import { d, tgpu } from "typegpu";

const Ghost = d.struct({
  /** World x, y, width, height. */
  rect: d.vec4f,
  /** Premultiplied color. */
  color: d.vec4f,
});

/** The ghost of this pass. Bound at build to the pass's own uniform. */
const ghost = tgpu.accessor(Ghost);

const ghostVertex = tgpu.vertexFn({
  in: { vertexIndex: d.builtin.vertexIndex },
  out: { pos: d.builtin.position },
})((input) => {
  "use gpu";
  const corners = [
    d.vec2f(0, 0),
    d.vec2f(1, 0),
    d.vec2f(0, 1),
    d.vec2f(0, 1),
    d.vec2f(1, 0),
    d.vec2f(1, 1),
  ];
  const corner = corners[input.vertexIndex];
  const rect = ghost.$.rect;
  const world = d.vec2f(rect.x + corner.x * rect.z, rect.y + corner.y * rect.w);

  return { pos: screenToClip(worldToScreen(world, camera.$), camera.$) };
});

const ghostFragment = tgpu.fragmentFn({ out: d.vec4f })(() => {
  "use gpu";

  return ghost.$.color;
});

type GhostModel<Kind extends string, Payload> = (
  context: InfiniteCanvasSceneLayerRenderContext<Kind, Payload>,
) => Readonly<{
  color: readonly [number, number, number, number];
  rect: Readonly<{ height: number; width: number; x: number; y: number }>;
}> | null;

/** One quad over the framework's drop placement rect, in the overlay world pass. */
function createDropPreviewPass<Kind extends string, Payload>(
  readModel: GhostModel<Kind, Payload>,
): InfiniteCanvasScenePass<Kind, Payload> {
  return {
    build: ({ configured, format, root }) => {
      const ghostUniform = root.createUniform(Ghost);
      const pipeline = configured.with(ghost, ghostUniform).createRenderPipeline({
        fragment: ghostFragment,
        targets: { blend: PREMULTIPLIED_OVER_BLEND, format },
        vertex: ghostVertex,
      });

      return {
        record: ({ context, target }) => {
          const model = readModel(context);

          if (model === null) {
            return;
          }

          const [r, g, b, a] = model.color;

          ghostUniform.write({
            color: d.vec4f(r * a, g * a, b * a, a),
            rect: d.vec4f(model.rect.x, model.rect.y, model.rect.width, model.rect.height),
          });
          pipeline.withColorAttachment(target()).draw(6);
        },
      };
    },
    placement: "overlay",
    space: "world",
  };
}

export { createDropPreviewPass };
