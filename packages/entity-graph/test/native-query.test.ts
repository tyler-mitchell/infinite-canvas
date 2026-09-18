import { type } from "arktype";
import { expect, test } from "vite-plus/test";
import { createWorld } from "../src/world";

test("executes native filtering, graph traversal, updates, and rollback", async () => {
  const world = await createWorld({
    components: type.module({ Health: { value: "number >= 0" } }),
    relations: type.module({ Contains: { order: "number.integer >= 0" } }),
    initial: {
      entities: [
        { id: "parent", components: { Health: { value: 10 } } },
        { id: "low", components: { Health: { value: 1 } } },
        { id: "high", components: { Health: { value: 8 } } },
      ],
      relations: [
        { source: "parent", target: "low", kind: "Contains", data: { order: 0 } },
        { source: "parent", target: "high", kind: "Contains", data: { order: 1 } },
      ],
    },
  });
  try {
    const rows = await world.query({
      id: "parent",
      Health: true,
      Contains: {
        edge: { order: "1" },
        target: { Health: { value: "number >= 5" } },
      },
    });
    expect(rows).toEqual([
      {
        id: "parent",
        Health: { value: 10 },
        Contains: [{ edge: { order: 1 }, target: { id: "high", Health: { value: 8 } } }],
      },
    ]);
    await world.update({
      match: { Health: { value: "number >= 5" } },
      set: ({ Health }) => ({ Health: { value: Health.value + 1 } }),
    });
    expect(await world.get({ id: "high", component: "Health" })).toEqual({ value: 9 });
    expect(await world.get({ id: "low", component: "Health" })).toEqual({ value: 1 });
    const before = await world.get();
    await expect(
      world.transaction(async (transaction) => {
        await transaction.spawn({ id: "temporary", components: { Health: { value: 2 } } });
        await transaction.relate({
          source: "temporary",
          target: "missing",
          relation: "Contains",
          data: { order: 0 },
        });
      }),
    ).rejects.toThrow();
    expect(await world.get()).toEqual(before);
  } finally {
    await world.close();
  }
});
