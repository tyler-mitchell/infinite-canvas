import { type } from "arktype";
import { expect, test } from "vite-plus/test";
import { createWorld } from "../src/index";

test("maintains a large document graph through edits, failures, and teardown", async () => {
  const components = {
    "#Money": type("string.numeric.parse").to("number >= 0"),
    Project: { title: "string.trim", theme: "'dark' | 'light' = 'dark'" },
    Section: { title: "string", collapsed: "boolean = false" },
    Item: {
      title: "string.trim",
      price: "Money",
      stock: "number.integer >= 0",
      quantity: "number.integer > 0 = 1",
      status: "'draft' | 'ready' = 'draft'",
      enabled: "boolean = true",
      note: "string | null = null",
      tags: ["string[]", "=", () => []],
      metadata: "object.json",
    },
    Label: "string",
    Flag: "boolean",
    Budget: "Money",
  } as const;
  const relations = {
    Contains: { order: "number.integer >= 0 = 0" },
    Tagged: { role: "'primary' | 'secondary' = 'primary'" },
    References: "number.integer >= 0",
    Signal: "boolean",
  } as const;
  const itemCount = 288;
  const projects = Array.from({ length: 3 }, (_, index) => ({
    id: `project-${index}`,
    components: { Project: { title: ` Project ${index} ` } },
  }));
  const sections = Array.from({ length: 12 }, (_, index) => ({
    id: `section-${index}`,
    components: { Section: { title: `Section ${index}` } },
  }));
  const items = Array.from({ length: itemCount }, (_, index) => ({
    id: `item-${index}`,
    components: {
      Item: {
        title: ` Item ${index} `,
        price: `${index % 25}.50`,
        stock: index % 4,
        enabled: index % 5 !== 0,
        ...(index % 2 === 0 ? { status: "ready" as const } : {}),
        metadata: { ordinal: index, nested: { flags: [true, false], value: null } },
      },
    },
  }));
  const labels = Array.from({ length: 8 }, (_, index) => ({
    id: `label-${index}`,
    components: { Label: `tag-${index}` },
  }));
  const initial = {
    entities: [
      ...projects,
      ...sections,
      ...items,
      ...labels,
      { id: "feature", components: { Flag: false, Budget: "0" } },
    ],
    relations: [
      ...sections.map((section, index) => ({
        source: `project-${Math.floor(index / 4)}`,
        target: section.id,
        kind: "Contains" as const,
        data: { order: index % 4 },
      })),
      ...items.map((item, index) => ({
        source: `section-${Math.floor(index / 24)}`,
        target: item.id,
        kind: "Contains" as const,
        data: { order: index % 24 },
      })),
      ...items.flatMap((item, index) => [
        { source: item.id, target: `label-${index % 8}`, kind: "Tagged" as const, data: {} },
        {
          source: item.id,
          target: `label-${(index + 1) % 8}`,
          kind: "Tagged" as const,
          data: { role: "secondary" as const },
        },
      ]),
      ...items.map((item, index) => ({
        source: item.id,
        target: `item-${(index + 1) % itemCount}`,
        kind: "References" as const,
        data: index,
      })),
      ...projects.map((project, index) => ({
        source: project.id,
        target: "label-0",
        kind: "Tagged" as const,
        data: { role: index === 1 ? ("secondary" as const) : ("primary" as const) },
      })),
      { source: "project-0", target: "feature", kind: "Signal" as const, data: false },
    ],
  };
  const world = await createWorld({ components, relations, initial });
  const isolated = await createWorld({ components, relations });
  try {
    const loaded = await world.get();
    expect(loaded.entities).toHaveLength(initial.entities.length);
    expect(loaded.relations).toHaveLength(initial.relations.length);
    expect(items[0]!.components.Item.price).toBe("0.50");
    expect(await world.get({ id: "item-0", component: "Item" })).toEqual({
      title: "Item 0",
      price: 0.5,
      stock: 0,
      quantity: 1,
      status: "ready",
      enabled: false,
      note: null,
      tags: [],
      metadata: { ordinal: 0, nested: { flags: [true, false], value: null } },
    });
    const local = await world.get({ id: "item-0", component: "Item" });
    local!.tags.push("local");
    expect((await world.get({ id: "item-0", component: "Item" }))!.tags).toEqual([]);
    expect((await world.get({ id: "item-1", component: "Item" }))!.tags).toEqual([]);
    expect((await world.get({ id: "item-1", component: "Item" }))!.status).toBe("draft");

    const selection = {
      Project: true,
      Tagged: { edge: { role: "'primary'" }, target: { Label: "'tag-0'" } },
      Contains: {
        target: {
          Section: true,
          Contains: {
            target: {
              Item: { status: "'ready'", stock: "number > 0" },
              Tagged: { edge: { role: "'primary'" }, target: { Label: "'tag-2'" } },
            },
          },
        },
      },
    } as const;
    const selected = await world.query(selection);
    expect(selected.map((row) => row.id).toSorted()).toEqual(["project-0", "project-2"]);
    const selectedItems = selected.flatMap((project) =>
      project.Contains.flatMap((section) => section.target.Contains.map((item) => item.target)),
    );
    const expectedIds = items
      .filter((_, index) => index % 8 === 2 && Math.floor(index / 96) !== 1)
      .map((item) => item.id)
      .toSorted();
    expect(selectedItems.map((item) => item.id).toSorted()).toEqual(expectedIds);
    expect(
      selectedItems.every(
        (item) =>
          item.Item.stock === 2 && item.Item.quantity === 1 && typeof item.Item.price === "number",
      ),
    ).toBe(true);
    const tree = await world.tree({ root: "project-0", relation: "Contains" });
    expect(tree!.children).toHaveLength(4);
    expect(tree!.children.flatMap((section) => section.target.children)).toHaveLength(96);
    const cycle = await world.query({
      id: ["item-0", "item-143", "item-287"],
      References: { target: { References: { target: { Item: true } } } },
    });
    expect(
      Object.fromEntries(
        cycle.map((row) => [row.id, row.References[0]!.target.References[0]!.target.id]),
      ),
    ).toEqual({
      "item-0": "item-2",
      "item-143": "item-145",
      "item-287": "item-1",
    });
    expect(
      await world.query({
        id: "project-0",
        Signal: { edge: "false", target: { Flag: true, Budget: true } },
      }),
    ).toEqual([
      {
        id: "project-0",
        Signal: [{ edge: false, target: { id: "feature", Flag: false, Budget: 0 } }],
      },
    ]);

    for (const _ of [0, 1, 2, 3]) {
      await world.update({
        match: { Item: { status: "'ready'", stock: "number > 0" } },
        set: ({ Item }) => ({
          Item: { ...Item, price: Item.price + 1, quantity: Item.quantity + 1 },
        }),
      });
    }
    expect((await world.get({ id: "item-2", component: "Item" }))!.price).toBe(6.5);
    expect((await world.get({ id: "item-2", component: "Item" }))!.quantity).toBe(5);
    expect((await world.get({ id: "item-3", component: "Item" }))!.price).toBe(3.5);
    const updated = await world.query({ Item: true });
    expect(Object.fromEntries(updated.map((row) => [row.id, row.Item]))).toEqual(
      Object.fromEntries(
        items.map((item, index) => {
          const increment = index % 4 === 2 ? 4 : 0;
          return [
            item.id,
            {
              title: `Item ${index}`,
              price: (index % 25) + 0.5 + increment,
              stock: index % 4,
              quantity: 1 + increment,
              status: index % 2 === 0 ? "ready" : "draft",
              enabled: index % 5 !== 0,
              note: null,
              tags: [],
              metadata: { ordinal: index, nested: { flags: [true, false], value: null } },
            },
          ];
        }),
      ),
    );
    const relation = await world.get((graph) =>
      graph.relations.find(
        (edge) => edge.source === "item-2" && edge.target === "label-2" && edge.kind === "Tagged",
      )!,
    );
    await world.relate({
      source: "item-2",
      target: "label-2",
      relation: "Tagged",
      data: { role: "secondary" },
    });
    expect(
      (await world.get((graph) => graph.relations.find((edge) => edge.id === relation.id)))!.data,
    ).toEqual({ role: "secondary" });
    await world.relate({ source: "item-2", target: "label-2", relation: "Tagged", data: {} });
    await world.transaction(async (transaction) => {
      await transaction.unrelate({ source: "section-0", target: "item-2", relation: "Contains" });
      await transaction.relate({
        source: "section-11",
        target: "item-2",
        relation: "Contains",
        data: { order: 24 },
      });
    });
    const parents = await world.query({
      id: "item-2",
      Contains: { direction: "incoming", target: { Section: true } },
    });
    expect(parents[0]!.Contains.map((edge) => edge.target.id)).toEqual(["section-11"]);
    const beforeFailure = await world.get();
    await expect(
      world.transaction(async (transaction) => {
        await transaction.despawn("project-0");
        await transaction.set({
          id: "item-2",
          components: { Item: { title: "Pending", price: "99", stock: 1, metadata: {} } },
        });
        await transaction.spawn({ id: "pending", components: { Label: "pending" } });
        await transaction.relate({
          source: "pending",
          target: "missing",
          relation: "References",
          data: 0,
        });
      }),
    ).rejects.toThrow();
    expect(await world.get()).toEqual(beforeFailure);
    await expect(
      world.update({
        match: { Item: true },
        set: ({ id, Item }) => ({ Item: { ...Item, quantity: id === "item-287" ? 0 : 50 } }),
      }),
    ).rejects.toThrow();
    expect(await world.get()).toEqual(beforeFailure);

    await isolated.spawn({ id: "item-2", components: { Flag: true, Budget: "100" } });
    expect(await isolated.get({ id: "item-2", component: "Budget" })).toBe(100);
    expect((await world.get({ id: "item-2", component: "Item" }))!.price).toBe(6.5);
    await world.despawn("project-0");
    const afterDelete = await world.get();
    expect(afterDelete.entities).toHaveLength(beforeFailure.entities.length - 1);
    expect(afterDelete.relations).toEqual(
      beforeFailure.relations.filter(
        (edge) => edge.source !== "project-0" && edge.target !== "project-0",
      ),
    );
    expect(await world.get({ id: "item-0", component: "Item" })).toBeDefined();
    expect((await world.query(selection)).map((row) => row.id)).toEqual(["project-2"]);
    await world.close();
    await expect(world.get()).rejects.toThrow();
    expect(await isolated.get({ id: "item-2", component: "Budget" })).toBe(100);
  } finally {
    try {
      await world.close();
    } finally {
      await isolated.close();
    }
  }
}, 30_000);
