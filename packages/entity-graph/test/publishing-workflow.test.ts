import { expect, expectTypeOf, test } from "vite-plus/test";
import { createWorld } from "../src/index";

test("selects publishable documents across multiple paths and preserves shared records", async () => {
  const world = await createWorld({
    components: {
      Document: { title: "string" },
      Section: { title: "string" },
      Item: { title: "string", stock: "number.integer >= 0" },
      Label: { text: "string" },
    },
    relations: {
      Contains: { order: "number.integer >= 0 = 0" },
      Tagged: { role: "'primary' | 'secondary' = 'primary'" },
    },
    initial: {
      entities: [
        { id: "first", components: { Document: { title: "First" } } },
        { id: "second", components: { Document: { title: "Second" } } },
        { id: "section-a", components: { Section: { title: "A" } } },
        { id: "section-b", components: { Section: { title: "B" } } },
        { id: "item-a", components: { Item: { title: "A", stock: 3 } } },
        { id: "sold-out", components: { Item: { title: "Unavailable", stock: 0 } } },
        { id: "item-b", components: { Item: { title: "B", stock: 2 } } },
        { id: "release", components: { Label: { text: "release" } } },
        { id: "draft", components: { Label: { text: "draft" } } },
      ],
      relations: [
        { source: "first", target: "section-a", kind: "Contains", data: {} },
        { source: "second", target: "section-b", kind: "Contains", data: {} },
        { source: "section-a", target: "item-a", kind: "Contains", data: {} },
        { source: "section-a", target: "sold-out", kind: "Contains", data: { order: 1 } },
        { source: "section-b", target: "item-b", kind: "Contains", data: {} },
        { source: "first", target: "release", kind: "Tagged", data: {} },
        { source: "second", target: "draft", kind: "Tagged", data: {} },
        { source: "item-a", target: "release", kind: "Tagged", data: {} },
      ],
    },
  });
  const selection = {
    Document: true,
    Contains: {
      target: { Section: true, Contains: { target: { Item: { stock: "number > 0" } } } },
    },
    Tagged: { edge: { role: "'primary'" }, target: { Label: { text: "'release'" } } },
  } as const;
  try {
    const rows = await world.query(selection);
    expect(rows).toEqual([
      {
        id: "first",
        Document: { title: "First" },
        Contains: [
          {
            edge: { order: 0 },
            target: {
              id: "section-a",
              Section: { title: "A" },
              Contains: [
                {
                  edge: { order: 0 },
                  target: {
                    id: "item-a",
                    Item: { title: "A", stock: 3 },
                  },
                },
              ],
            },
          },
        ],
        Tagged: [
          { edge: { role: "primary" }, target: { id: "release", Label: { text: "release" } } },
        ],
      },
    ]);
    expectTypeOf(rows[0]!.Contains[0]!.target.Contains[0]!.target.Item).toEqualTypeOf<{
      title: string;
      stock: number;
    }>();
    const incoming = await world.query({
      id: "release",
      Tagged: { direction: "incoming", target: { Document: true } },
    });
    expect(incoming[0]!.Tagged.map((edge) => edge.target.id)).toEqual(["first"]);

    await world.set({ id: "item-a", components: { Item: { title: "A", stock: 0 } } });
    expect(await world.query(selection)).toEqual([]);
    expect(await world.get({ id: "item-b", component: "Item" })).toEqual({ title: "B", stock: 2 });
    await world.set({ id: "item-a", components: { Item: { title: "A", stock: 4 } } });
    expect((await world.query(selection)).map((row) => row.id)).toEqual(["first"]);

    await world.despawn("first");
    expect(await world.query(selection)).toEqual([]);
    expect(
      await world.query({
        id: "release",
        Tagged: { direction: "incoming", target: { Document: true } },
      }),
    ).toEqual([]);
    const shared = await world.query({
      id: "release",
      Label: true,
      Tagged: { direction: "incoming", target: { Item: true } },
    });
    expect(shared[0]!.Tagged[0]!.target.Item).toEqual({ title: "A", stock: 4 });
    expect(await world.get({ id: "section-a", component: "Section" })).toEqual({ title: "A" });
  } finally {
    await world.close();
  }
});
