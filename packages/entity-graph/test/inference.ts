import { type } from "arktype";
import { expectTypeOf } from "vite-plus/test";
import type { EntityId, World } from "../src/index";

const components = type.module({
  Position: { x: "number", y: "number" },
  Label: { text: "string.trim", visible: "boolean = true" },
});
const relations = type.module({ Contains: { order: "number.integer >= 0" } });
declare const world: World<typeof components, typeof relations>;
declare const id: EntityId;
declare const empty: World<{}, {}>;
declare const parsed: World<{ Amount: ReturnType<typeof amount> }, {}>;
function amount() {
  return type("string.numeric.parse").to("number >= 0");
}
parsed.set({ id, components: { Amount: "4" } });
parsed.update({ match: { Amount: true }, set: ({ Amount }) => ({ Amount: Amount + 1 }) });
// @ts-expect-error Updates produce canonical numeric values.
parsed.update({ match: { Amount: true }, set: () => ({ Amount: "5" }) });
// @ts-expect-error Empty registries accept no component names.
empty.spawn({ components: { Unknown: 1 } });

expectTypeOf(world.get({ id, component: "Position" })).toEqualTypeOf<
  Promise<{ x: number; y: number } | undefined>
>();
expectTypeOf(world.get((graph) => graph.entities.length)).toEqualTypeOf<Promise<number>>();
expectTypeOf(world.get(async (graph) => graph.entities.length)).toEqualTypeOf<Promise<number>>();
expectTypeOf(world.get({ id, component: "Label" })).toEqualTypeOf<
  Promise<{ text: string; visible: boolean } | undefined>
>();
expectTypeOf(world.get({ id, components: ["Position", "Label"] })).toEqualTypeOf<
  Promise<
    | {
        readonly Position: { x: number; y: number } | undefined;
        readonly Label: { text: string; visible: boolean } | undefined;
      }
    | undefined
  >
>();
// @ts-expect-error Every selected component name must exist.
world.get({ id, components: ["Position", "Missing"] });
world.spawn({ components: { Label: { text: "A" } } });
world.set({ id, components: { Position: { x: 1, y: 2 } } });
world.relate({ source: id, target: id, relation: "Contains", data: { order: 0 } });

// @ts-expect-error Component names come from the schema.
world.get({ id, component: "Missing" });
// @ts-expect-error Missing component fields must fail.
world.set({ id, components: { Position: { x: 1 } } });
// @ts-expect-error Unknown components must fail.
world.spawn({ components: { Missing: true } });
// @ts-expect-error Relation data is required.
world.relate({ source: id, target: id, relation: "Contains", data: {} });
// @ts-expect-error Unknown root query keys must fail.
world.query({ Missing: true });
// @ts-expect-error Unknown nested query keys must fail.
world.query({ Contains: { target: { Missing: true } } });

export async function queryInference() {
  const relation = await world.query({
    Contains: { edge: { order: "0" }, target: { Position: true } },
  });
  expectTypeOf(relation[0]!.Contains[0]!.edge.order).toEqualTypeOf<0>();
  expectTypeOf(relation[0]!.Contains[0]!.target.Position.x).toEqualTypeOf<number>();
  const optionalPattern: { Position?: true; Label?: true } = {};
  const optional = await world.query(optionalPattern);
  expectTypeOf(optional[0]!.Position).toEqualTypeOf<{ x: number; y: number } | undefined>();
  // @ts-expect-error Optional query fields cannot promise a matching component.
  optional[0]!.Position.x;
  const inline = await world.query({ Position: { x: "0" } });
  expectTypeOf(inline[0]!.Position.x).toEqualTypeOf<0>();
  expectTypeOf(inline[0]!.Position.y).toEqualTypeOf<number>();
  const narrowed = await world.query({ Position: components.Position.narrow(({ x }) => x > 400) });
  expectTypeOf(narrowed[0]!.Position.x).toEqualTypeOf<number>();
  expectTypeOf(narrowed[0]!.Position.y).toEqualTypeOf<number>();
  const filtered = await world.query({ Position: type({ x: "0" }) });
  expectTypeOf(filtered[0]!.Position.x).toEqualTypeOf<0>();
  expectTypeOf(filtered[0]!.Position.y).toEqualTypeOf<number>();
  const rows = await world.query({
    Position: true,
    Contains: { target: { Label: true, Position: type({ x: "0", y: "number" }) } },
  });
  expectTypeOf(rows[0]!.Position).toEqualTypeOf<{ x: number; y: number }>();
  expectTypeOf(rows[0]!.Contains[0]!.edge).toEqualTypeOf<{ order: number }>();
  expectTypeOf(rows[0]!.Contains[0]!.target.Label).toEqualTypeOf<{
    text: string;
    visible: boolean;
  }>();
  expectTypeOf(rows[0]!.Contains[0]!.target.Position.x).toEqualTypeOf<0>();
}
