import { d, std, tgpu } from "typegpu";

import { getInfiniteCanvasWindowConnectorSegment } from "../../scene-layer-geometry";
import type { InfiniteCanvasDropPayload } from "../../types";
import { camera, screenToClip, worldToScreen } from "../backend/camera";
import { PREMULTIPLIED_OVER_BLEND, type InfiniteCanvasScenePass } from "../pass";
import { DEFAULT_CONNECTIONS_OPTIONS, type InfiniteCanvasConnectionsOptions } from "../policy";

/**
 * Draws the `connections` slice: one instanced quad per edge, between the two
 * windows it names.
 *
 * The framework owns this because a connection is state, not a look a consumer
 * assembles. A consumer adds an edge through `connection.open` and never writes
 * a shader for it.
 */

const ConnectionSegment = d.struct({
  /** World start and end. */
  a: d.vec2f,
  b: d.vec2f,
  color: d.vec4f,
  /** CSS pixels, so a line keeps its weight through a zoom. */
  thickness: d.f32,
});

/** Edges beyond this are not drawn. A canvas with more has a legibility problem first. */
const CONNECTION_CAPACITY = 256;

const ConnectionSegments = d.arrayOf(ConnectionSegment, CONNECTION_CAPACITY);

const segments = tgpu.accessor(ConnectionSegments);

const connectionVertex = tgpu.vertexFn({
  in: { instanceIndex: d.builtin.instanceIndex, vertexIndex: d.builtin.vertexIndex },
  out: { color: d.vec4f, pos: d.builtin.position },
})((input) => {
  "use gpu";
  const corners = [
    d.vec2f(0, -0.5),
    d.vec2f(1, -0.5),
    d.vec2f(0, 0.5),
    d.vec2f(0, 0.5),
    d.vec2f(1, -0.5),
    d.vec2f(1, 0.5),
  ];
  const corner = corners[input.vertexIndex];
  const segment = segments.$[input.instanceIndex];
  const a = worldToScreen(segment.a, camera.$);
  const b = worldToScreen(segment.b, camera.$);
  const along = std.sub(b, a);
  const direction = std.normalize(along);
  const normal = d.vec2f(-direction.y, direction.x);
  const screen = std.add(
    std.add(a, std.mul(along, corner.x)),
    std.mul(normal, segment.thickness * corner.y),
  );

  return { color: segment.color, pos: screenToClip(screen, camera.$) };
});

const connectionFragment = tgpu.fragmentFn({ in: { color: d.vec4f }, out: d.vec4f })((input) => {
  "use gpu";

  return input.color;
});

/** Premultiplied, because the pass blends over what the medium already holds. */
const toPremultiplied = (tint: readonly [number, number, number], alpha: number) =>
  d.vec4f(tint[0] * alpha, tint[1] * alpha, tint[2] * alpha, alpha);

/** One quad per edge whose two windows both exist. */
function createInfiniteCanvasConnectionsPass<
  Kind extends string = string,
  Payload = InfiniteCanvasDropPayload,
>(
  options: InfiniteCanvasConnectionsOptions = DEFAULT_CONNECTIONS_OPTIONS,
): InfiniteCanvasScenePass<Kind, Payload> {
  const resting = toPremultiplied(options.tint, options.opacity);
  const selected = toPremultiplied(options.selectedTint, options.selectedOpacity);

  return {
    build: ({ configured, format, root }) => {
      const buffer = root.createReadonly(ConnectionSegments);
      const pipeline = configured.with(segments, buffer).createRenderPipeline({
        fragment: connectionFragment,
        targets: { blend: PREMULTIPLIED_OVER_BLEND, format },
        vertex: connectionVertex,
      });

      return {
        record: ({ context, target }) => {
          const { state } = context;
          // An edge target names a connection by id, whatever kind the consumer gave it.
          const selectedIds = new Set(
            state.selection.targets
              .filter((entry) => entry.type === "edge")
              .map((entry) => entry.id),
          );
          const drawn = state.connections
            .flatMap((connection) => {
              const from = context.windows.find((window) => window.id === connection.from);
              const to = context.windows.find((window) => window.id === connection.to);

              if (from === undefined || to === undefined) {
                return [];
              }

              const segment = getInfiniteCanvasWindowConnectorSegment(from, to);
              const isSelected = selectedIds.has(connection.id);

              return [
                {
                  a: d.vec2f(segment.start.x, segment.start.y),
                  b: d.vec2f(segment.end.x, segment.end.y),
                  color: isSelected ? selected : resting,
                  thickness: isSelected ? options.selectedThicknessPx : options.thicknessPx,
                },
              ];
            })
            .slice(0, CONNECTION_CAPACITY);

          if (drawn.length === 0) {
            return;
          }

          // One patch for the whole set. The state is read every frame either way.
          buffer.buffer.patch(drawn);
          pipeline.withColorAttachment(target()).draw(6, drawn.length);
        },
      };
    },
    placement: "underlay",
    space: "world",
  };
}

export { CONNECTION_CAPACITY, createInfiniteCanvasConnectionsPass };
