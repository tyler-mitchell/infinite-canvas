import { type } from "arktype";
import { expect, expectTypeOf, test } from "vite-plus/test";
import { createWorld } from "../src/world";

test("preserves explicit falsy settings and restores them after a failed edit", async () => {
  const world = await createWorld({
    components: {
      Settings: {
        enabled: "boolean = true",
        retries: "number.integer >= 0 = 3",
        description: "string | null = null",
        "detail?": "string",
      },
    },
  });
  try {
    await world.spawn({ id: "default", components: { Settings: {} } });
    await world.spawn({
      id: "custom",
      components: { Settings: { enabled: false, retries: 0, description: "" } },
    });
    expect(await world.get({ id: "default", component: "Settings" })).toEqual({
      enabled: true,
      retries: 3,
      description: null,
    });
    expect(await world.query({ Settings: { enabled: "false" } })).toEqual([
      { id: "custom", Settings: { enabled: false, retries: 0, description: "" } },
    ]);
    const before = await world.get();
    await expect(
      world.transaction(async (transaction) => {
        await transaction.set({
          id: "custom",
          components: { Settings: { enabled: true, detail: "pending" } },
        });
        await transaction.set({ id: "default", components: { Settings: { retries: -1 } } });
      }),
    ).rejects.toThrow();
    expect(await world.get()).toEqual(before);
    await world.set({ id: "custom", components: { Settings: { detail: "saved" } } });
    expect(await world.get({ id: "custom", component: "Settings" })).toEqual({
      enabled: true,
      retries: 3,
      description: null,
      detail: "saved",
    });
  } finally {
    await world.close();
  }
  await expect(world.get()).rejects.toThrow();
});

test("edits and reparents document items with defaults, parsing, and atomic recovery", async () => {
  const world = await createWorld({
    components: {
      "#Amount": type("string.numeric.parse").to("number >= 0"),
      Container: { title: "string.trim", collapsed: "boolean = false" },
      Item: {
        title: "string.trim",
        price: "Amount",
        quantity: "number.integer > 0 = 1",
        enabled: "boolean = false",
        tags: ["string[]", "=", () => []],
      },
    },
    relations: { Contains: { order: "number.integer >= 0 = 0", weight: "number > 0 = 1" } },
    initial: {
      entities: [
        { id: "draft", components: { Container: { title: " Draft " } } },
        { id: "published", components: { Container: { title: "Published" } } },
        { id: "first", components: { Item: { title: " First ", price: "12.50" } } },
      ],
      relations: [{ source: "draft", target: "first", kind: "Contains", data: {} }],
    },
  });
  try {
    const second = await world.spawn({
      id: "second",
      components: { Item: { title: " Second ", price: "0", quantity: 2, enabled: true } },
    });
    expect(await world.get({ id: "first", component: "Item" })).toEqual({
      title: "First",
      price: 12.5,
      quantity: 1,
      enabled: false,
      tags: [],
    });
    expect(await world.get({ id: "draft", component: "Container" })).toEqual({
      title: "Draft",
      collapsed: false,
    });
    const firstRead = await world.get({ id: "first", component: "Item" });
    expectTypeOf(firstRead).toEqualTypeOf<
      | {
          title: string;
          price: number;
          quantity: number;
          enabled: boolean;
          tags: string[];
        }
      | undefined
    >();
    firstRead!.tags.push("local-only");
    expect((await world.get({ id: "first", component: "Item" }))!.tags).toEqual([]);
    expect((await world.get({ id: second, component: "Item" }))!.tags).toEqual([]);

    await world.transaction(async (transaction) => {
      await transaction.set({
        id: "first",
        components: { Item: { title: " Revised ", price: "15", tags: ["ready"] } },
      });
      await transaction.unrelate({ source: "draft", target: "first", relation: "Contains" });
      await transaction.relate({
        source: "published",
        target: "first",
        relation: "Contains",
        data: { order: 2 },
      });
      await transaction.relate({
        source: "published",
        target: second,
        relation: "Contains",
        data: { order: 3 },
      });
    });
    const published = await world.query({
      id: "published",
      Container: true,
      Contains: { edge: { order: "2" }, target: { Item: true } },
    });
    expectTypeOf(published[0]!.Contains[0]!.target.Item).toEqualTypeOf<{
      title: string;
      price: number;
      quantity: number;
      enabled: boolean;
      tags: string[];
    }>();
    expect(published).toEqual([
      {
        id: "published",
        Container: { title: "Published", collapsed: false },
        Contains: [
          {
            edge: { order: 2, weight: 1 },
            target: {
              id: "first",
              Item: { title: "Revised", price: 15, quantity: 1, enabled: false, tags: ["ready"] },
            },
          },
        ],
      },
    ]);
    expect(await world.query({ id: "draft", Contains: { target: { Item: true } } })).toEqual([]);

    await world.update({
      match: { Item: true },
      set: ({ Item }) => ({ Item: { ...Item, quantity: Item.quantity + 1 } }),
    });
    expect((await world.get({ id: "first", component: "Item" }))!.price).toBe(15);
    expect((await world.get({ id: second, component: "Item" }))!.quantity).toBe(3);
    const before = await world.get();
    await expect(
      world.update({
        match: { Item: true },
        set: ({ id, Item }) => ({ Item: { ...Item, quantity: id === second ? 0 : 10 } }),
      }),
    ).rejects.toThrow();
    expect(await world.get()).toEqual(before);

    await expect(
      world.transaction(async (transaction) => {
        await transaction.despawn("first");
        await transaction.spawn({
          id: "temporary",
          components: { Item: { title: "Temporary", price: "5" } },
        });
        await transaction.relate({
          source: "missing",
          target: "temporary",
          relation: "Contains",
          data: {},
        });
      }),
    ).rejects.toThrow();
    expect(await world.get()).toEqual(before);
    await world.despawn("published");
    expect(await world.get((graph) => graph.relations)).toEqual([]);
    expect((await world.get({ id: "first", component: "Item" }))!.title).toBe("Revised");
    expect((await world.get({ id: second, component: "Item" }))!.price).toBe(0);
  } finally {
    await world.close();
  }
});
