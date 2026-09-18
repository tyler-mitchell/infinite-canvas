import { attest } from "@ark/attest";
import { linked } from "@legendapp/state";
import { type } from "arktype";
import { expect, test, vi } from "vite-plus/test";
import { model, type Result } from "./model";

const pointer = type({ pointerId: "number.integer", delta: "number" });
const activate = vi.fn();
const measure = vi.fn((title: string) => title.length);

test("computed inference precedes operation binding", () => {
  const example = model({
    state: type({ title: "string" }),
    initial: () => ({ title: "Note" }),
  })
    .computed(({ state }) => ({ length: () => state.title.get().length }))
    .computed(({ computed }) => ({ doubled: () => computed.length.get() * 2 }))
    .create(undefined);
  attest<number>(example.computed.doubled.get());
  expect(example.computed.doubled.get()).toBe(8);
});

const createCanvas = model({
  state: type({
    windows: {
      "[string]": {
        title: "string",
        mode: "'normal' | 'minimized' = 'normal'",
      },
    },
    groups: { "[string]": { nodes: { "[string]": { windowId: "string" } } } },
    drag: [{ pointerId: "number", windowId: "string" }, "|", "null"],
    activeId: "string | null",
  }),
  initial: (options: { title: string; enabled: boolean }) => ({
    windows: { a: { title: options.title } },
    groups: { g: { nodes: { n: { windowId: "a" } } } },
    drag: null,
    activeId: null,
  }),
})
  .configuration((options) => ({ enabled: options.enabled }))
  .history(({ state }) => ({ state: state.windows }))
  .computed(({ state }) => ({
    windowTitle: (id: string) => state.windows[id].title,
    activeWindow: linked({
      get: () => {
        const id = state.activeId.get();
        return id === null ? null : state.windows[id];
      },
      initial: null,
    }),
    pointerId: linked({ get: () => state.drag.get()?.pointerId ?? null, initial: null }),
  }))
  .computed(({ computed }) => ({ titleLength: () => measure(computed.windowTitle.a.get()) }))
  .computed(({ computed }) => ({ doubledLength: () => computed.titleLength.get() * 2 }))
  .inputs(({ state }) =>
    type.module({
      existingWindow: type("string").pipe((id, ctx) => {
        const window = state.windows[id];
        return window.get() === undefined ? ctx.error("an existing window") : window;
      }),
      node: type({ groupId: "string", nodeId: "string" }).pipe(({ groupId, nodeId }, ctx) => {
        const node = state.groups[groupId].nodes[nodeId];
        return node.get() === undefined ? ctx.error("an existing node") : node;
      }),
    }),
  )
  .inputs(({ inputs }) =>
    type.module({
      existingWindow: inputs.existingWindow,
      node: inputs.node,
      normalWindow: inputs.existingWindow.pipe((window, ctx) =>
        window.mode.get() === "normal" ? window : ctx.error("a normal window"),
      ),
    }),
  )
  .inputs(({ inputs, configuration, computed, history }) =>
    type.module({
      "#existingWindow": inputs.existingWindow,
      node: inputs.node,
      normalWindow: inputs.normalWindow,
      editableWindow: inputs.normalWindow.pipe((window, ctx) =>
        configuration.enabled ? window : ctx.error("editing enabled"),
      ),
      ownedPointer: [
        pointer,
        ":",
        (input, ctx) =>
          input.pointerId === computed.pointerId.get() || ctx.reject("the captured pointer"),
      ],
      rename: { window: "normalWindow", title: "string.trim" },
      renameMany: { windows: "normalWindow[]", title: "string" },
      readTitle: { window: "existingWindow" },
      updateNode: { target: { node: "node" }, window: "existingWindow" },
      resize: { window: "editableWindow", amount: "string.numeric.parse", increment: "number = 1" },
      move: { pointer: "ownedPointer" },
      undo: [{}, ":", (_, ctx) => history.undos$.get() > 0 || ctx.reject("an undoable change")],
      clear: {},
    }),
  )
  .actions(({ state, inputs, computed }) => ({
    renameWindow: type.fn(inputs.rename)((input) => {
      attest<string>(input.title);
      attest<"normal" | "minimized">(input.window.mode.get());
      input.window.title.set(input.title);
    }),
    renameWindows: type.fn(inputs.renameMany)((input) => {
      input.windows.forEach((window) => {
        attest<string>(window.title.get());
        window.title.set(input.title);
      });
    }),
    readWindowTitle: type.fn(inputs.readTitle)((input) => input.window.title.get()),
    readWindowTitleAsync: type.fn(inputs.readTitle)(async (input) => input.window.title.get()),
    resizeWindow: type.fn(inputs.resize)((input) => {
      attest<number>(input.amount);
      attest<number>(input.increment);
      return input.amount + input.increment;
    }),
    updateNode: type.fn(inputs.updateNode)((input) => {
      attest<string>(input.target.node.windowId.get());
      input.target.node.windowId.set("a");
    }),
    move: type.fn(inputs.move)((input) => input.pointer.delta),
    readLength: type.fn(inputs.clear)(() => computed.doubledLength.get()),
    cancelDrag: type.fn(inputs.clear)(() => state.drag.set(null)),
  }))
  .actions(({ inputs, history, actions }) => ({
    undo: type.fn(inputs.undo)(() => {
      const error = actions.cancelDrag.run({});
      if (error !== undefined) return error;
      history.undo();
    }),
  }))
  .commands(({ actions }) => ({
    rename: { action: actions.renameWindow, label: "Rename", icon: "rename" },
    read: { action: actions.readWindowTitle, label: "Read title", icon: "read" },
    readAsync: {
      action: actions.readWindowTitleAsync,
      label: "Read title asynchronously",
      icon: "read",
    },
    resize: { action: actions.resizeWindow, label: "Resize", icon: "resize" },
    undo: { action: actions.undo, label: "Undo", icon: "undo" },
  }))
  .activate(activate).create;

test("commands retain action identity, input types, and asynchronous results", async () => {
  const canvas = createCanvas({ title: "A", enabled: true });
  attest<"renameWindow">(canvas.commands.rename.action);
  attest<{ window: string; title: string }>(canvas.commands.rename.input.inferIn);
  attest<Result<null>>(await canvas.commands.rename.run({ window: "a", title: "B" }));
  attest<Result<string>>(await canvas.commands.read.run({ window: "a" }));
  attest<Result<string>>(await canvas.commands.readAsync.run({ window: "a" }));
  attest<Result<number>>(await canvas.commands.resize.run({ window: "a", amount: "2" }));
  expect(await canvas.commands.resize.run({ window: "a", amount: "2" })).toEqual({
    data: 3,
    error: null,
  });
  expect(await canvas.commands.readAsync.run({ window: "a" })).toEqual({ data: "B", error: null });
  expect((await canvas.commands.readAsync.run({ window: "missing" })).error).toBeInstanceOf(
    type.errors,
  );
});

test("native modules preserve raw inputs, resolved observables, and return types", () => {
  const canvas = createCanvas({ title: "A", enabled: true });
  attest<{ window: string; title: string }>(canvas.actions.renameWindow.input.inferIn);
  attest<string | Error | type.errors>(canvas.actions.readWindowTitle.run({ window: "a" }));

  expect(canvas.actions.renameWindow.canRun({ window: "a", title: " B " })).toBe(true);
  expect(canvas.state.windows.a.title.get()).toBe("A");
  expect(canvas.actions.renameWindow.run({ window: "a", title: " B " })).toBeUndefined();
  expect(canvas.state.windows.a.title.get()).toBe("B");

  canvas.state.windows.a.mode.set("minimized");
  expect(canvas.actions.renameWindow.canRun({ window: "a", title: "C" })).toBe(false);
  expect(canvas.actions.renameWindow.run({ window: "a", title: "C" })).toBeInstanceOf(type.errors);
  expect(canvas.state.windows.a.title.get()).toBe("B");

  canvas.state.windows.a.mode.set("normal");
  canvas.actions.renameWindows.run({ windows: ["a"], title: "D" });
  expect(canvas.actions.readWindowTitle.run({ window: "a" })).toBe("D");

  canvas.state.windows.a.delete();
  expect(canvas.actions.renameWindow.run({ window: "a", title: "E" })).toBeInstanceOf(type.errors);
});

test("computed values retain keyed, dependent, nullable, and observable results", () => {
  measure.mockClear();
  const canvas = createCanvas({ title: "Note", enabled: true });
  attest<string>(canvas.computed.windowTitle.a.get());
  attest<number>(canvas.computed.doubledLength.get());
  attest<number | null>(canvas.computed.pointerId.get());
  expect(canvas.computed.doubledLength.get()).toBe(8);
  expect(canvas.computed.titleLength.get()).toBe(4);
  expect(measure).toHaveBeenCalledTimes(1);
  expect(canvas.computed.activeWindow.get()).toBeNull();
  canvas.state.activeId.set("a");
  expect(canvas.computed.activeWindow.get()?.title).toBe("Note");
  expect(measure.mock.calls).toEqual([["Note"]]);
  canvas.state.windows.a.title.set("Longer");
  expect(canvas.computed.doubledLength.get()).toBe(12);
  expect(measure).toHaveBeenLastCalledWith("Longer");
  const evaluations = measure.mock.calls.length;
  expect(canvas.computed.titleLength.get()).toBe(6);
  expect(canvas.computed.doubledLength.get()).toBe(12);
  expect(measure).toHaveBeenCalledTimes(evaluations);
});

test("history, nested targets, pointer ownership, and cross-action calls share state", async () => {
  activate.mockClear();
  const canvas = createCanvas({ title: "A", enabled: true });
  expect(activate).toHaveBeenCalledTimes(1);
  expect(canvas.commands.undo.canRun({})).toBe(false);
  const target = { node: { groupId: "g", nodeId: "n" } };
  expect(canvas.actions.updateNode.run({ target, window: "a" })).toBeUndefined();
  expect(
    canvas.actions.updateNode.canRun({
      target: { node: { groupId: "g", nodeId: "missing" } },
      window: "a",
    }),
  ).toBe(false);
  canvas.state.drag.set({ pointerId: 1, windowId: "a" });
  expect(canvas.actions.move.canRun({ pointer: { pointerId: 2, delta: 3 } })).toBe(false);
  expect(canvas.actions.move.run({ pointer: { pointerId: 1, delta: 3 } })).toBe(3);
  canvas.actions.renameWindow.run({ window: "a", title: "B" });
  expect(await canvas.commands.undo.run({})).toEqual({ data: null, error: null });
  expect(canvas.state.windows.a.title.get()).toBe("A");
  expect(canvas.state.drag.get()).toBeNull();
  const disabled = createCanvas({ title: "A", enabled: false });
  expect(disabled.actions.resizeWindow.canRun({ window: "a", amount: "2" })).toBe(false);
});
