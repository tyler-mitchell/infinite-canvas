import { type } from "arktype";
import { expect, test as base } from "vite-plus/test";
import { createWorld, EntityId, type World } from "../src/index";

const components = type.module({
  Position: { x: "number", y: "number" },
  Label: { text: "string.trim", visible: "boolean = true" },
  Health: { value: "number >= 0" },
});
const relations = type.module({ ChildOf: { weight: "number > 0 = 1" } });
const test = base.extend<{ world: World<typeof components, typeof relations> }>({
  world: async ({}, use) => {
    const world = await createWorld({ components, relations });
    try {
      await use(world);
    } finally {
      await world.close();
    }
  },
});

test("starts with no entities or relations", async ({ world }) => {
  expect(await world.get()).toEqual({ entities: [], relations: [] });
  expect(await world.query({})).toEqual([]);
});

test("creates independent identities and canonical component values", async ({ world }) => {
  const first = await world.spawn({ components: { Label: { text: "  A  " } } });
  const second = await world.spawn({ components: {} });
  expect(first).not.toBe(second);
  expect(await world.get({ id: first, component: "Label" })).toEqual({ text: "A", visible: true });
  expect(await world.get({ id: second, component: "Label" })).toBeUndefined();
  expect(await world.query({ Label: true })).toEqual([
    { id: first, Label: { text: "A", visible: true } },
  ]);
});

test("rejects invalid components without creating an entity", async ({ world }) => {
  await expect(world.spawn({ components: { Health: { value: -1 } } })).rejects.toThrow();
  expect(await world.query({})).toEqual([]);
});

test("rejects unknown components at runtime", async ({ world }) => {
  // @ts-expect-error Unknown components must also fail at runtime.
  await expect(world.spawn({ components: { Missing: {} } })).rejects.toThrow();
  expect(await world.query({})).toEqual([]);
});

test("replaces a component and preserves unrelated components", async ({ world }) => {
  const id = await world.spawn({ components: { Position: { x: 1, y: 2 }, Label: { text: "A" } } });
  await world.set({ id, components: { Position: { x: 3, y: 4 } } });
  expect(await world.get({ id, component: "Position" })).toEqual({ x: 3, y: 4 });
  expect(await world.get({ id, component: "Label" })).toEqual({ text: "A", visible: true });
  await expect(world.set({ id, components: { Health: { value: -1 } } })).rejects.toThrow();
  expect(await world.get({ id, component: "Position" })).toEqual({ x: 3, y: 4 });
});

test("removes components and entities", async ({ world }) => {
  const id = await world.spawn({ components: { Position: { x: 1, y: 2 }, Health: { value: 3 } } });
  await world.remove({ id, component: "Position" });
  expect(await world.query({ Position: true })).toEqual([]);
  expect(await world.get({ id, component: "Health" })).toEqual({ value: 3 });
  await world.despawn(id);
  expect(await world.get({ id, component: "Health" })).toBeUndefined();
  expect(await world.query({})).toEqual([]);
});

test("enforces query value constraints", async ({ world }) => {
  const low = await world.spawn({ components: { Health: { value: 1 } } });
  const high = await world.spawn({ components: { Health: { value: 10 } } });
  const rows = await world.query({ Health: { value: "number >= 5" } });
  expect(rows).toEqual([{ id: high, Health: { value: 10 } }]);
  expect(rows.some((row) => row.id === low)).toBe(false);
});

test("returns every relation target that satisfies the pattern", async ({ world }) => {
  const source = await world.spawn({ components: { Label: { text: "Source" } } });
  const rejected = await world.spawn({ components: { Health: { value: 1 } } });
  const first = await world.spawn({ components: { Health: { value: 8 } } });
  const second = await world.spawn({ components: { Health: { value: 9 } } });
  for (const target of [rejected, first, second]) {
    await world.relate({ source, target, relation: "ChildOf", data: {} });
  }
  const rows = await world.query({
    Label: true,
    ChildOf: { target: { Health: { value: "number >= 5" } } },
  });
  expect(rows).toHaveLength(1);
  expect(rows[0]!.ChildOf.map((join) => join.target.id).toSorted()).toEqual(
    [first, second].toSorted(),
  );
  expect(rows[0]!.ChildOf.every((join) => join.edge.weight === 1)).toBe(true);
});

test("removes relations explicitly and when an endpoint is deleted", async ({ world }) => {
  const source = await world.spawn({ components: {} });
  const target = await world.spawn({ components: { Health: { value: 4 } } });
  await world.relate({ source, target, relation: "ChildOf", data: {} });
  await world.unrelate({ source, target, relation: "ChildOf" });
  expect(await world.get((graph) => graph.relations)).toEqual([]);
  await world.relate({ source, target, relation: "ChildOf", data: {} });
  await world.despawn(target);
  expect(await world.get((graph) => graph.relations)).toEqual([]);
  expect(await world.query({ ChildOf: { target: {} } })).toEqual([]);
});

test("rejects missing relation endpoints and invalid relation values", async ({ world }) => {
  const source = await world.spawn({ components: {} });
  await expect(
    world.relate({ source, target: EntityId.from("missing"), relation: "ChildOf", data: {} }),
  ).rejects.toThrow();
  await expect(
    world.relate({ source, target: source, relation: "ChildOf", data: { weight: 0 } }),
  ).rejects.toThrow();
  expect(await world.get((graph) => graph.relations)).toEqual([]);
});

test("commits related writes together and returns the callback result", async ({ world }) => {
  const result = await world.transaction(async (transaction) => {
    const source = await transaction.spawn({ components: {} });
    const target = await transaction.spawn({ components: { Health: { value: 2 } } });
    await transaction.relate({ source, target, relation: "ChildOf", data: {} });
    return target;
  });
  expect(await world.get({ id: result, component: "Health" })).toEqual({ value: 2 });
  expect(await world.get((graph) => graph.relations)).toHaveLength(1);
});

test("rolls back writes when a transaction callback fails", async ({ world }) => {
  await expect(
    world.transaction(async (transaction) => {
      await transaction.spawn({ components: { Health: { value: 2 } } });
      throw new Error("Cancel this transaction");
    }),
  ).rejects.toThrow("Cancel this transaction");
  expect(await world.query({})).toEqual([]);
});

test("preserves an existing entity when its identity is reused", async ({ world }) => {
  const id = EntityId.from("stable-id");
  await world.spawn({ id, components: { Health: { value: 5 } } });
  await expect(world.spawn({ id, components: { Health: { value: 10 } } })).rejects.toThrow();
  expect(await world.get({ id, component: "Health" })).toEqual({ value: 5 });
});

test("keeps returned component objects separate from stored values", async ({ world }) => {
  const id = await world.spawn({ components: { Position: { x: 1, y: 2 } } });
  const position = await world.get({ id, component: "Position" });
  position!.x = 100;
  expect(await world.get({ id, component: "Position" })).toEqual({ x: 1, y: 2 });
});

test("keeps worlds isolated", async ({ world }) => {
  const other = await createWorld({ components, relations });
  try {
    const id = EntityId.from("shared-name");
    await world.spawn({ id, components: { Health: { value: 1 } } });
    await other.spawn({ id, components: { Health: { value: 2 } } });
    expect(await world.get({ id, component: "Health" })).toEqual({ value: 1 });
    expect(await other.get({ id, component: "Health" })).toEqual({ value: 2 });
  } finally {
    await other.close();
  }
});

test("matches nested graph paths and excludes incomplete paths", async ({ world }) => {
  const root = await world.spawn({ components: { Label: { text: "Root" } } });
  const middle = await world.spawn({ components: {} });
  const leaf = await world.spawn({ components: { Health: { value: 7 } } });
  await world.relate({ source: root, target: middle, relation: "ChildOf", data: {} });
  expect(
    await world.query({
      Label: true,
      ChildOf: { target: { ChildOf: { target: { Health: true } } } },
    }),
  ).toEqual([]);
  await world.relate({ source: middle, target: leaf, relation: "ChildOf", data: {} });
  const rows = await world.query({
    Label: true,
    ChildOf: { target: { ChildOf: { target: { Health: true } } } },
  });
  expect(rows[0]!.ChildOf[0]!.target.ChildOf[0]!.target).toEqual({
    id: leaf,
    Health: { value: 7 },
  });
});

test("queries a finite path through a cyclic graph", async ({ world }) => {
  const id = await world.spawn({ components: { Label: { text: "Self" } } });
  await world.relate({ source: id, target: id, relation: "ChildOf", data: {} });
  const rows = await world.query({ ChildOf: { target: { ChildOf: { target: { Label: true } } } } });
  expect(rows[0]!.ChildOf[0]!.target.ChildOf[0]!.target.Label.text).toBe("Self");
});

test("rejects unknown query keys instead of ignoring them", async ({ world }) => {
  await world.spawn({ components: {} });
  // @ts-expect-error Unknown query keys must also fail at runtime.
  await expect(world.query({ Missing: true })).rejects.toThrow("Invalid relation query");
  // @ts-expect-error A relation query requires a target pattern.
  await expect(world.query({ ChildOf: true })).rejects.toThrow("Invalid relation query");
});

test("rolls back earlier changes when a later database write fails", async ({ world }) => {
  const id = await world.spawn({ components: { Health: { value: 3 } } });
  await expect(
    world.transaction(async (transaction) => {
      await transaction.set({ id, components: { Health: { value: 9 } } });
      await transaction.spawn({ id, components: {} });
    }),
  ).rejects.toThrow();
  expect(await world.get({ id, component: "Health" })).toEqual({ value: 3 });
});

test("rejects work after the world is closed", async () => {
  const world = await createWorld({ components, relations });
  await world.close();
  await expect(world.spawn({ components: {} })).rejects.toThrow();
});

test("rolls back a new entity when its relation write fails", async ({ world }) => {
  const existing = await world.spawn({ components: { Health: { value: 3 } } });
  await expect(
    world.transaction(async (transaction) => {
      const source = await transaction.spawn({ id: "pending", components: {} });
      await transaction.relate({ source, target: "missing", relation: "ChildOf", data: {} });
    }),
  ).rejects.toThrow();
  expect(await world.get()).toEqual({
    entities: [{ id: existing, components: { Health: { value: 3 } } }],
    relations: [],
  });
});

test("reads a hierarchy with native recursive traversal and edge data", async ({ world }) => {
  const root = await world.spawn({ components: { Label: { text: "Root" } } });
  const branch = await world.spawn({ components: { Label: { text: "Branch" } } });
  const leaf = await world.spawn({ components: { Health: { value: 4 } } });
  await world.relate({ source: root, target: branch, relation: "ChildOf", data: { weight: 2 } });
  await world.relate({ source: branch, target: leaf, relation: "ChildOf", data: { weight: 3 } });
  expect(await world.tree({ root, relation: "ChildOf" })).toEqual({
    id: root,
    components: { Label: { text: "Root", visible: true } },
    children: [
      {
        edge: { weight: 2 },
        target: {
          id: branch,
          components: { Label: { text: "Branch", visible: true } },
          children: [
            {
              edge: { weight: 3 },
              target: {
                id: leaf,
                components: { Health: { value: 4 } },
                children: [],
              },
            },
          ],
        },
      },
    ],
  });
});

test("loads an initial graph without consumer write loops", async () => {
  const world = await createWorld({
    components,
    relations,
    initial: {
      entities: [
        { id: "parent", components: { Label: { text: "Parent" } } },
        { id: "child", components: { Health: { value: 5 } } },
      ],
      relations: [{ source: "parent", target: "child", kind: "ChildOf", data: {} }],
    },
  });
  try {
    const rows = await world.query({ ChildOf: { target: { Health: true } } });
    expect(rows[0]!.ChildOf[0]!.target.Health.value).toBe(5);
  } finally {
    await world.close();
  }
});

test("rejects invalid initial graph data and leaves later worlds usable", async () => {
  await expect(
    createWorld({
      components,
      relations,
      initial: {
        entities: [{ id: "bad", components: { Health: { value: -1 } } }],
      },
    }),
  ).rejects.toThrow();
  const world = await createWorld({ components, relations, initial: { entities: [] } });
  try {
    expect(await world.get()).toEqual({ entities: [], relations: [] });
  } finally {
    await world.close();
  }
});

test("rejects ambiguous schema names", async () => {
  await expect(createWorld({ components: { id: type("string") }, relations: {} })).rejects.toThrow(
    "reserved or repeated",
  );
  await expect(
    createWorld({ components: { Shared: type("string") }, relations: { Shared: type({}) } }),
  ).rejects.toThrow("reserved or repeated");
  await expect(createWorld({ components: {}, relations: { id: type({}) } })).rejects.toThrow(
    "reserved or repeated",
  );
});

test("matches selected identities and accepts an empty selection", async ({ world }) => {
  const first = await world.spawn({ components: { Health: { value: 1 } } });
  const second = await world.spawn({ components: { Health: { value: 2 } } });
  expect(await world.query({ id: first, Health: true })).toEqual([
    { id: first, Health: { value: 1 } },
  ]);
  expect((await world.query({ id: [first, second] })).map((row) => row.id).toSorted()).toEqual(
    [first, second].toSorted(),
  );
  expect(await world.query({ id: [], Health: true })).toEqual([]);
});

test("updates matched entities atomically and preserves unmatched entities", async ({ world }) => {
  const first = await world.spawn({ components: { Health: { value: 1 } } });
  const second = await world.spawn({ components: { Health: { value: 10 } } });
  await world.update({
    match: { Health: { value: "number < 5" } },
    set: ({ Health }) => ({ Health: { value: Health.value + 2 } }),
  });
  expect(await world.get({ id: first, component: "Health" })).toEqual({ value: 3 });
  expect(await world.get({ id: second, component: "Health" })).toEqual({ value: 10 });
});

test("rejects invalid component query syntax", async ({ world }) => {
  // @ts-expect-error Invalid ArkType syntax must also fail at runtime.
  await expect(world.query({ Health: { value: "number >> 3" } })).rejects.toThrow();
});

test("does not create empty entity identities", async ({ world }) => {
  await expect(world.spawn({ id: "", components: {} })).rejects.toThrow();
  expect(await world.query({})).toEqual([]);
});

test("gets multiple components with one named selection", async ({ world }) => {
  const id = await world.spawn({
    components: { Position: { x: 1, y: 2 }, Label: { text: "  Name  " } },
  });
  expect(await world.get({ id, components: ["Position", "Label"] })).toEqual({
    Position: { x: 1, y: 2 },
    Label: { text: "Name", visible: true },
  });
  expect(await world.query({ Position: true, Label: true })).toEqual([
    {
      id,
      Position: { x: 1, y: 2 },
      Label: { text: "Name", visible: true },
    },
  ]);
});

test("distinguishes missing entities from missing selected components", async ({ world }) => {
  const id = await world.spawn({ components: { Position: { x: 1, y: 2 } } });
  expect(await world.get({ id, components: ["Position", "Label"] })).toEqual({
    Position: { x: 1, y: 2 },
    Label: undefined,
  });
  expect(await world.get({ id: "missing", components: ["Position", "Label"] })).toBeUndefined();
  expect(await world.query({ Position: true, Label: true })).toEqual([]);
  expect(await world.get({ id, components: [] })).toEqual({});
});

test("rejects unknown component names in direct reads and removals", async ({ world }) => {
  const id = await world.spawn({ components: {} });
  // @ts-expect-error Unknown component names must also fail at runtime.
  await expect(world.get({ id, components: ["Missing"] })).rejects.toThrow();
  // @ts-expect-error Unknown component names must also fail at runtime.
  await expect(world.remove({ id, component: "Missing" })).rejects.toThrow();
});

test("reads leaf hierarchies and missing roots", async ({ world }) => {
  const root = await world.spawn({ components: {} });
  expect(await world.tree({ root, relation: "ChildOf" })).toEqual({
    id: root,
    components: {},
    children: [],
  });
  expect(await world.tree({ root: "missing", relation: "ChildOf" })).toBeUndefined();
});

test("preserves scalar, nullable, and array components", async () => {
  const world = await createWorld({
    components: {
      Visible: type("boolean"),
      Count: type("number"),
      Label: type("string | null"),
      Tags: type("string[]"),
    },
    relations: {},
  });
  try {
    const id = await world.spawn({
      components: { Visible: false, Count: 0, Label: null, Tags: ["a", "b"] },
    });
    expect(await world.query({ Visible: true, Count: true, Label: true, Tags: true })).toEqual([
      {
        id,
        Visible: false,
        Count: 0,
        Label: null,
        Tags: ["a", "b"],
      },
    ]);
  } finally {
    await world.close();
  }
});

test("preserves relation values from native ArkType modules", async () => {
  const world = await createWorld({
    components: {},
    relations: type.module({ Weight: "number", Enabled: "boolean" }),
  });
  try {
    const source = await world.spawn({ components: {} });
    const target = await world.spawn({ components: {} });
    await world.relate({ source, target, relation: "Weight", data: 0 });
    await world.relate({ source, target, relation: "Enabled", data: false });
    const rows = await world.query({ Weight: { target: {} }, Enabled: { target: {} } });
    expect(rows[0]!.Weight[0]!.edge).toBe(0);
    expect(rows[0]!.Enabled[0]!.edge).toBe(false);
  } finally {
    await world.close();
  }
});

test("updates an existing relation without replacing its identity", async ({ world }) => {
  const source = await world.spawn({ components: {} });
  const target = await world.spawn({ components: {} });
  await world.relate({ source, target, relation: "ChildOf", data: { weight: 1 } });
  const before = await world.get((graph) => graph.relations[0]!);
  await world.relate({ source, target, relation: "ChildOf", data: { weight: 4 } });
  expect(await world.get((graph) => graph.relations)).toEqual([{ ...before, data: { weight: 4 } }]);
});

test("keeps distinct relation kinds independent during updates", async () => {
  const world = await createWorld({
    components: {},
    relations: { Owns: type({ rank: "number" }), Links: type({ label: "string" }) },
  });
  try {
    const source = await world.spawn({ components: {} });
    const target = await world.spawn({ components: {} });
    await world.relate({ source, target, relation: "Owns", data: { rank: 1 } });
    await world.relate({ source, target, relation: "Links", data: { label: "Keep" } });
    await world.relate({ source, target, relation: "Owns", data: { rank: 2 } });
    const rows = await world.query({ Owns: { target: {} }, Links: { target: {} } });
    expect(rows[0]!.Owns[0]!.edge).toEqual({ rank: 2 });
    expect(rows[0]!.Links[0]!.edge).toEqual({ label: "Keep" });
  } finally {
    await world.close();
  }
});

test("does not change an edge when its updated data is invalid", async ({ world }) => {
  const source = await world.spawn({ components: {} });
  const target = await world.spawn({ components: {} });
  await world.relate({ source, target, relation: "ChildOf", data: { weight: 2 } });
  const before = await world.get();
  await expect(
    world.relate({ source, target, relation: "ChildOf", data: { weight: -1 } }),
  ).rejects.toThrow();
  expect(await world.get()).toEqual(before);
});

test("selects graph data without extra read plumbing", async ({ world }) => {
  const id = await world.spawn({ components: { Health: { value: 3 } } });
  expect(await world.get((graph) => graph.entities.map((entity) => entity.id))).toEqual([id]);
  expect(await world.get(async (graph) => graph.entities.length)).toBe(1);
  expect(await world.get(() => undefined)).toBeUndefined();
});

test("preserves graph data when a read selector fails", async ({ world }) => {
  const id = await world.spawn({ components: { Health: { value: 3 } } });
  await expect(
    world.get(() => {
      throw new Error("Selector failed");
    }),
  ).rejects.toThrow("Selector failed");
  expect(await world.get({ id, component: "Health" })).toEqual({ value: 3 });
});

test("updates canonical values without applying input morphs again", async () => {
  const world = await createWorld({
    components: {
      Amount: type("number")
        .pipe((value) => value * 2)
        .to("number >= 0"),
    },
    relations: {},
  });
  try {
    const id = await world.spawn({ components: { Amount: 2 } });
    expect(await world.get({ id, component: "Amount" })).toBe(4);
    await world.update({ match: { Amount: true }, set: ({ Amount }) => ({ Amount: Amount + 1 }) });
    expect(await world.get({ id, component: "Amount" })).toBe(5);
  } finally {
    await world.close();
  }
});

test("validates canonical update results before committing them", async () => {
  const world = await createWorld({
    components: { Amount: type("string.numeric.parse").to("number >= 0") },
    relations: {},
  });
  try {
    const id = await world.spawn({ components: { Amount: "4" } });
    await expect(
      world.update({ match: { Amount: true }, set: () => ({ Amount: -1 }) }),
    ).rejects.toThrow();
    expect(await world.get({ id, component: "Amount" })).toBe(4);
  } finally {
    await world.close();
  }
});
