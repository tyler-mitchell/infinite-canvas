import {
  PREMULTIPLIED_OVER_BLEND,
  camera,
  screenToClip,
  worldToScreen,
  type InfiniteCanvasScenePass,
} from "@hyphened/infinite-canvas/scene";
import type { InfiniteCanvasSceneLayerRenderContext } from "@hyphened/infinite-canvas";
import { d, std, tgpu } from "typegpu";

const LinkSegment = d.struct({
  /** World start and end. */
  a: d.vec2f,
  b: d.vec2f,
  /** CSS pixels, so thickness stays constant across zoom. */
  thickness: d.f32,
  color: d.vec4f,
});

const LINK_CAPACITY = 256;

const LinkSegments = d.arrayOf(LinkSegment, LINK_CAPACITY);

/** The links of this pass. Bound at build to the pass's own readonly buffer. */
const links = tgpu.accessor(LinkSegments);

const linkVertex = tgpu.vertexFn({
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
  const segment = links.$[input.instanceIndex];
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

const linkFragment = tgpu.fragmentFn({ in: { color: d.vec4f }, out: d.vec4f })((input) => {
  "use gpu";

  return input.color;
});

type WorkflowLink = Readonly<{
  a: readonly [number, number];
  b: readonly [number, number];
  selected: boolean;
}>;

type WorkflowLinkModel<Kind extends string> = (
  context: InfiniteCanvasSceneLayerRenderContext<Kind>,
) => readonly WorkflowLink[];

/** One instanced quad per link, drawn in the underlay world pass. */
function createWorkflowLinksPass<Kind extends string>(
  readModel: WorkflowLinkModel<Kind>,
): InfiniteCanvasScenePass<Kind> {
  return {
    build: ({ configured, format, root }) => {
      const segments = root.createReadonly(LinkSegments);
      const pipeline = configured.with(links, segments).createRenderPipeline({
        fragment: linkFragment,
        targets: { blend: PREMULTIPLIED_OVER_BLEND, format },
        vertex: linkVertex,
      });
      return {
        record: ({ context, target }) => {
          const links = readModel(context).slice(0, LINK_CAPACITY);

          // One patch for the whole set. The model is read every frame either
          // way, so gating the write behind a change check saved nothing.
          segments.buffer.patch(
            links.map((link) => ({
              a: d.vec2f(link.a[0], link.a[1]),
              b: d.vec2f(link.b[0], link.b[1]),
              // Premultiplied colors.
              color: link.selected
                ? d.vec4f(0.69, 0.86, 0.94, 0.95)
                : d.vec4f(0.12, 0.41, 0.53, 0.55),
              thickness: link.selected ? 4 : 2,
            })),
          );
          pipeline.withColorAttachment(target()).draw(6, links.length);
        },
      };
    },
    placement: "underlay",
    space: "world",
  };
}

export { createWorkflowLinksPass };
export type { WorkflowLink };
