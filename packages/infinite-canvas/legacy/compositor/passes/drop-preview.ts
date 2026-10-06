import { d, tgpu } from "typegpu";

import type { InfiniteCanvasDropPayload } from "../../types";
import { camera, screenToClip, worldToScreen } from "../backend/camera";
import { PREMULTIPLIED_OVER_BLEND, type InfiniteCanvasScenePass } from "../pass";
import { DEFAULT_DROP_PREVIEW_OPTIONS, type InfiniteCanvasDropPreviewOptions } from "../policy";

/**
 * Shows where a dragged payload will land, in the rect the framework already
 * resolved for it.
 *
 * Every input is the framework's own: the drop status, whether the pointer is
 * over the viewport, whether the target accepted the payload, and the placement
 * rect from `dropPolicy`. A consumer states valid and invalid colours through
 * the policy and writes no shader.
 */

const Ghost = d.struct({
  /** Premultiplied colour. */
  color: d.vec4f,
  /** World x, y, width, height. */
  rect: d.vec4f,
});

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

/** One quad over the framework's drop placement rect, in the overlay world pass. */
function createInfiniteCanvasDropPreviewPass<
  Kind extends string = string,
  Payload = InfiniteCanvasDropPayload,
>(
  options: InfiniteCanvasDropPreviewOptions = DEFAULT_DROP_PREVIEW_OPTIONS,
): InfiniteCanvasScenePass<Kind, Payload> {
  const premultiplied = (tint: readonly [number, number, number], alpha: number) =>
    d.vec4f(tint[0] * alpha, tint[1] * alpha, tint[2] * alpha, alpha);
  const valid = premultiplied(options.validTint, options.validOpacity);
  const invalid = premultiplied(options.invalidTint, options.invalidOpacity);

  return {
    build: ({ configured, format, root }) => {
      const uniform = root.createUniform(Ghost);
      const pipeline = configured.with(ghost, uniform).createRenderPipeline({
        fragment: ghostFragment,
        targets: { blend: PREMULTIPLIED_OVER_BLEND, format },
        vertex: ghostVertex,
      });

      return {
        record: ({ context, target }) => {
          const { drop } = context;

          // No preview without a drag over the canvas that resolved to a placement.
          if (
            drop.status !== "dragging" ||
            !drop.isOverViewport ||
            drop.dropTarget.target === null ||
            drop.placement === null
          ) {
            return;
          }

          const { rect } = drop.placement;

          uniform.write({
            color: drop.dropTarget.status === "valid" ? valid : invalid,
            rect: d.vec4f(rect.x, rect.y, rect.width, rect.height),
          });
          pipeline.withColorAttachment(target()).draw(6);
        },
      };
    },
    placement: "overlay",
    space: "world",
  };
}

export { createInfiniteCanvasDropPreviewPass };
