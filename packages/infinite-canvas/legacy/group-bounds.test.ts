import { expect, test } from "vite-plus/test";
import { createInfiniteCanvasWindow } from "./factory";
import { getCanvasLayout } from "./layout";
import { captureInfiniteCanvasRecipe, applyInfiniteCanvasRecipe } from "./recipes";
import { createInfiniteCanvasStore } from "./store";
import { getInfiniteCanvasMovableSelection, moveInfiniteCanvasTargets } from "./movement";

const createStore = () => {
  const store = createInfiniteCanvasStore({
    initialState: {
      windows: [
        createInfiniteCanvasWindow({
          id: "a",
          kind: "note",
          rect: { x: 0, y: 0, width: 200, height: 150 },
        }),
        createInfiniteCanvasWindow({
          id: "b",
          kind: "note",
          rect: { x: 200, y: 0, width: 200, height: 150 },
        }),
      ],
    },
  });
  store.dispatch({
    type: "group.create",
    groupId: "group",
    windowIds: ["a", "b"],
    rect: { x: 0, y: 0, width: 400, height: 300 },
  });
  return store;
};

test("resizing the group frame preserves member geometry and supports undo", () => {
  const store = createStore();
  const before = getCanvasLayout(store.getState());
  store.dispatch({
    type: "interaction.startGroupResize",
    groupId: "group",
    handle: "south-east",
    minSize: { width: 1, height: 1 },
    point: { x: 0, y: 0 },
    pointerId: 1,
  });
  store.dispatch({ type: "interaction.step", point: { x: 100, y: 80 }, pointerId: 1 });
  const during = getCanvasLayout(store.getState());
  expect(during.windowRects).toEqual(before.windowRects);
  expect(during.groupRects.get("group")).toEqual({ x: 0, y: 0, width: 500, height: 380 });
  store.dispatch({ type: "interaction.finish", pointerId: 1 });
  expect(getCanvasLayout(store.getState()).groupRects).toEqual(during.groupRects);
  store.dispatch({ type: "history.undo" });
  expect(getCanvasLayout(store.getState()).groupRects).toEqual(before.groupRects);
  store.dispatch({ type: "history.redo" });
  expect(getCanvasLayout(store.getState()).groupRects).toEqual(during.groupRects);
});

test("cancelling a group frame resize restores the frame and members", () => {
  const store = createStore();
  const before = store.snapshot();
  store.dispatch({
    type: "interaction.startGroupResize",
    groupId: "group",
    handle: "north-west",
    minSize: { width: 1, height: 1 },
    point: { x: 0, y: 0 },
    pointerId: 1,
  });
  store.dispatch({ type: "interaction.step", point: { x: -100, y: -80 }, pointerId: 1 });
  store.dispatch({ type: "desktop.cancel" });
  expect(store.snapshot().groups).toEqual(before.groups);
  expect(store.snapshot().windows).toEqual(before.windows);
  expect(store.getState().interaction).toBeNull();
});

test("moving a group preserves the offset between its frame and contents", () => {
  const store = createStore();
  store.dispatch({
    type: "interaction.startGroupResize",
    groupId: "group",
    handle: "north-west",
    minSize: { width: 1, height: 1 },
    point: { x: 0, y: 0 },
    pointerId: 1,
  });
  store.dispatch({ type: "interaction.step", point: { x: -100, y: -80 }, pointerId: 1 });
  store.dispatch({ type: "interaction.finish", pointerId: 1 });
  const state = store.getState();
  store.dispatch({
    type: "selection.replace",
    targets: [{ type: "group", kind: "group", id: "group" }],
  });
  const moved = moveInfiniteCanvasTargets({
    state,
    origins: getInfiniteCanvasMovableSelection(store.getState()),
    delta: { x: 70, y: 50 },
  });
  expect(moved.groups[0]?.rect).toEqual({ x: 70, y: 50, width: 400, height: 300 });
  expect(getCanvasLayout(moved).groupRects.get("group")).toEqual({
    x: -30,
    y: -30,
    width: 500,
    height: 380,
  });
});

test("recipes include independent frame bounds in their size and placement", () => {
  const store = createStore();
  store.dispatch({
    type: "interaction.startGroupResize",
    groupId: "group",
    handle: "north-west",
    minSize: { width: 1, height: 1 },
    point: { x: 0, y: 0 },
    pointerId: 1,
  });
  store.dispatch({ type: "interaction.step", point: { x: -100, y: -80 }, pointerId: 1 });
  store.dispatch({ type: "interaction.finish", pointerId: 1 });
  const state = store.getState();
  const recipe = captureInfiniteCanvasRecipe(state, {
    name: "Layout",
    recipeId: "recipe",
    windowIds: ["a", "b"],
  });
  expect(recipe?.size).toEqual({ width: 500, height: 380 });
  if (recipe === null) throw new Error("Recipe is missing.");
  const restored = applyInfiniteCanvasRecipe(state, recipe, { origin: { x: 1000, y: 1000 } });
  expect(getCanvasLayout(restored).groupRects.get("group")).toEqual({
    x: 1000,
    y: 1000,
    width: 500,
    height: 380,
  });
  expect(restored.groups[0]?.rect).toEqual({ x: 1100, y: 1080, width: 400, height: 300 });
});
