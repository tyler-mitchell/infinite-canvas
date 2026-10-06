import { type } from "arktype";
import { expect, test } from "vite-plus/test";

import { insertComponent } from "./component";
import { resolveComponentPlacement } from "./component-placement";
import { getCanvasLayout } from "./layout";
import type { InfiniteCanvasWindowDefinition } from "./types";
import { createInfiniteCanvasWindow } from "./factory";
import { getInfiniteCanvasGroupWindowIds } from "./group-tree";
import { createInfiniteCanvasStore } from "./store";
import { createCanvasTools, defineComponent } from "./core";

const components: Readonly<Record<string, InfiniteCanvasWindowDefinition<"box">>> = {
  box: { kind: "box", schema: type({}), renderBody: () => null },
};

test("headless component actions follow selection and reject invalid multi-window updates atomically", async () => {
  const counter = defineComponent({
    id: "counter",
    schema: type({ count: "number <= 2" }),
    actions: {
      increment: {
        label: "Increment",
        multiple: true,
        update: ({ count }) => ({ count: count + 1 }),
      },
    },
  });
  const store = createInfiniteCanvasStore({
    initialState: { windows: [] },
    windowDefinitions: { counter },
  });
  for (const [windowId, count] of [
    ["first", 0],
    ["second", 2],
  ] as const) {
    insertComponent({ store, input: { windowId, componentId: "counter", props: { count } } });
  }
  store.dispatch({ type: "window.focus", windowId: "first" });
  const command = store
    .getContextualCommands()
    .find(({ id }) => id === "component:counter:increment");
  expect(command?.enabled).toBe(true);
  const tool = createCanvasTools({ store }).find(({ name }) => name === "command.execute")!;
  const options = { signal: new AbortController().signal };
  const before = store.getState();
  expect(
    await tool.execute(
      {
        command: {
          type: "component.action",
          actionId: "increment",
          windowIds: ["first", "second"],
        },
      },
      options,
    ),
  ).toBeInstanceOf(Error);
  expect(store.getState()).toEqual(before);
  await tool.execute(
    { command: { type: "component.action", actionId: "increment", windowIds: ["first"] } },
    options,
  );
  expect(store.getState().windows.find(({ id }) => id === "first")?.data).toEqual({ count: 1 });
  store.dispatch({ type: "window.focus", windowId: "second" });
  expect(
    store
      .getContextualCommands({ includeDisabled: true })
      .find(({ id }) => id === "component:counter:increment")?.enabled,
  ).toBe(false);
});

test("a removed insertion destination rejects the component without changing state", () => {
  const store = createInfiniteCanvasStore<"box">({
    initialState: { windows: [] },
    windowDefinitions: components,
  });
  const before = store.getState();
  const result = insertComponent<"box">({
    store,
    input: {
      windowId: "new",
      componentId: "box",
      props: {},
      target: { groupId: "removed" },
    },
  });
  expect(result).toBeInstanceOf(Error);
  expect(store.getState()).toEqual(before);
});

test("a component inserts on the canvas without a group target", () => {
  const store = createInfiniteCanvasStore<"box">({
    initialState: { windows: [] },
    windowDefinitions: components,
  });
  const result = insertComponent<"box">({
    store,
    input: { windowId: "new", componentId: "box", props: {} },
  });
  expect(result).not.toBeInstanceOf(Error);
  expect(result).not.toBeInstanceOf(type.errors);
  expect(store.getState().windows.map((window) => window.id)).toEqual(["new"]);
  expect(store.getState().groups).toEqual([]);
});

test.each(["masonry", "split", "tabs", "accordion"] as const)(
  "a component inserts into a one-member %s group",
  (layout) => {
    const store = createInfiniteCanvasStore<"box">({
      windowDefinitions: components,
      initialState: {
        windows: [
          createInfiniteCanvasWindow({
            id: "seed",
            kind: "box",
            rect: { x: 0, y: 0, width: 320, height: 240 },
          }),
        ],
      },
    });
    store.dispatch({
      type: "group.create",
      groupId: "group",
      layout,
      rect: { x: 0, y: 0, width: 640, height: 480 },
      windowIds: ["seed"],
    });
    const result = insertComponent<"box">({
      store,
      input: {
        windowId: "new",
        componentId: "box",
        props: {},
        target: { groupId: "group" },
      },
    });
    expect(result).not.toBeInstanceOf(Error);
    expect(result).not.toBeInstanceOf(type.errors);
    expect(getInfiniteCanvasGroupWindowIds(store.getState().groups[0]!.tree)).toEqual([
      "seed",
      "new",
    ]);
  },
);

test.each(["masonry", "split", "tabs", "accordion"] as const)(
  "%s insertion matches its preview",
  (layout) => {
    const store = createInfiniteCanvasStore<"box">({
      windowDefinitions: components,
      initialState: {
        windows: [
          createInfiniteCanvasWindow({
            id: "seed",
            kind: "box",
            rect: { x: 0, y: 0, width: 320, height: 240 },
          }),
        ],
      },
    });
    store.dispatch({
      type: "group.create",
      groupId: "group",
      layout,
      rect: { x: 0, y: 0, width: 640, height: 480 },
      windowIds: ["seed"],
    });
    const placement = resolveComponentPlacement<"box">({
      state: store.getState(),
      components,
      componentId: "box",
      windowId: "new",
      worldPoint: { x: 100, y: 100 },
    });
    if (placement instanceof Error || placement instanceof type.errors) throw placement;
    expect(store.getState().windows).toHaveLength(1);
    expect(placement.input.target?.groupId).toBe("group");
    const result = insertComponent<"box">({
      store,
      input: { ...placement.input, rect: placement.rect },
    });
    expect(result).not.toBeInstanceOf(Error);
    expect(result).not.toBeInstanceOf(type.errors);
    expect(getCanvasLayout(store.getState()).windowRects.get("new")).toEqual(placement.rect);
  },
);
