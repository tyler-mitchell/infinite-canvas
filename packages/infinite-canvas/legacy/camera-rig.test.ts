import { getSelectedWindowIds } from "./selection";
import { afterEach, expect, test, vi } from "vite-plus/test";
import { createInfiniteCanvasStore } from "./store";
import { createInfiniteCanvasWindow } from "./factory";
import { createCanvasTools } from "./tools";
import type { MotionValue } from "motion";

const playback = vi.hoisted(() => {
  const animations: { update(progress: number): void; complete(): void }[] = [];
  return {
    animations,
    deferRender: false,
    update: (progress: number) =>
      animations.slice(-3).forEach((animation) => animation.update(progress)),
    complete: () => animations.slice(-3).forEach((animation) => animation.complete()),
    stop: vi.fn(),
  };
});
vi.mock("motion", async (importOriginal) => ({
  ...(await importOriginal<typeof import("motion")>()),
  frame: {
    render: (callback: () => void) => {
      if (!playback.deferRender) callback();
    },
  },
  animate: (value: MotionValue<number>, target: number) => {
    const from = value.get();
    const animation = {
      update: (progress: number) => value.set(from + (target - from) * progress),
      complete: () => {},
    };
    const finished = new Promise<void>((resolve) => {
      animation.complete = resolve;
    });
    playback.animations.push(animation);
    return { then: finished.then.bind(finished), stop: playback.stop };
  },
}));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  playback.animations.splice(0);
  playback.deferRender = false;
});

test("camera frames reach state and snapshots before the destination is persisted", async () => {
  vi.stubGlobal("requestAnimationFrame", vi.fn());
  const store = createInfiniteCanvasStore({
    zoomPolicy: { maxZoom: 4 },
    initialState: { camera: { center: { x: 0, y: 0 }, zoom: 1 }, windows: [] },
  });
  const finished = store.camera.navigate({
    target: { type: "point", point: { x: 100, y: 200 } },
    behavior: { type: "centerAtZoom", zoom: 4 },
  });
  playback.update(0.5);
  expect(store.getState().camera).toEqual({ center: { x: 50, y: 100 }, zoom: 2 });
  expect(store.snapshot().camera).toEqual(store.getState().camera);
  expect(store.document$.camera.peek().zoom).toBe(1);
  playback.update(1);
  playback.complete();
  expect(await finished).toBe("completed");
  expect(store.document$.camera.peek()).toEqual(store.getState().camera);
});

test("manual camera input cancels the flight and continues from its current frame", async () => {
  vi.stubGlobal("requestAnimationFrame", vi.fn());
  const store = createInfiniteCanvasStore({
    initialState: { camera: { center: { x: 0, y: 0 }, zoom: 1 }, windows: [] },
  });
  const finished = store.camera.navigate({ target: { type: "point", point: { x: 100, y: 200 } } });
  playback.update(0.5);
  store.dispatch({
    type: "camera.navigate",
    request: { target: { type: "point", point: { x: 20, y: 40 } } },
  });
  expect(await finished).toBe("cancelled");
  expect(playback.stop).toHaveBeenCalledTimes(3);
  expect(store.getState().camera.center).toEqual({ x: 20, y: 40 });
});

test("replacement navigation starts at the latest motion values before the render phase", async () => {
  vi.stubGlobal("requestAnimationFrame", vi.fn());
  const store = createInfiniteCanvasStore({
    initialState: { camera: { center: { x: 0, y: 0 }, zoom: 1 }, windows: [] },
  });
  const first = store.camera.navigate({ target: { type: "point", point: { x: 100, y: 200 } } });
  playback.deferRender = true;
  playback.update(0.5);
  expect(store.getState().camera.center).toEqual({ x: 0, y: 0 });
  const second = store.camera.navigate({ target: { type: "point", point: { x: 200, y: 400 } } });
  expect(await first).toBe("cancelled");
  expect(store.getState().camera.center).toEqual({ x: 50, y: 100 });
  playback.deferRender = false;
  playback.update(0.5);
  expect(store.getState().camera.center).toEqual({ x: 125, y: 250 });
  playback.update(1);
  playback.complete();
  expect(await second).toBe("completed");
});

test("missing targets preserve state and aborted requests do not start a flight", async () => {
  const store = createInfiniteCanvasStore({ initialState: { windows: [] } });
  const before = store.snapshot();
  expect(await store.camera.navigate({ target: { type: "window", windowId: "missing" } })).toBe(
    "unavailable",
  );
  expect(
    await store.camera.navigate({
      target: { type: "point", point: { x: 100, y: 200 } },
      signal: AbortSignal.abort(),
    }),
  ).toBe("cancelled");
  expect(store.snapshot()).toEqual(before);
});

test("configured navigation commands settle after the shared camera animation", async () => {
  vi.stubGlobal("requestAnimationFrame", vi.fn());
  const store = createInfiniteCanvasStore({
    initialState: { camera: { center: { x: 0, y: 0 }, zoom: 1 }, windows: [] },
    camera: { transition: { duration: 1 } },
  });
  const finished = store.dispatch({
    type: "camera.navigate",
    request: { target: { type: "point", point: { x: 100, y: 200 } } },
  });
  expect(finished).toBeInstanceOf(Promise);
  expect(store.getState().camera.center).toEqual({ x: 0, y: 0 });
  playback.update(0.5);
  expect(store.getState().camera.center).toEqual({ x: 50, y: 100 });
  playback.update(1);
  playback.complete();
  expect(await finished).toBe("completed");
  expect(store.snapshot().camera.center).toEqual({ x: 100, y: 200 });
});

test("navigation retargets after viewport insets change without cancelling its completion", async () => {
  vi.stubGlobal("requestAnimationFrame", vi.fn());
  const store = createInfiniteCanvasStore({
    initialState: { camera: { center: { x: 0, y: 0 }, zoom: 1 }, windows: [] },
  });
  const finished = store.camera.navigate({ target: { type: "point", point: { x: 100, y: 200 } } });
  playback.update(0.5);
  store.dispatch({ type: "viewportInsets.set", insets: { left: 200 } });
  expect(store.getState().camera.center).toEqual({ x: 50, y: 100 });
  playback.update(1);
  playback.complete();
  expect(await finished).toBe("completed");
  expect(store.getState().camera.center).toEqual({ x: 0, y: 200 });
});

test("agent tools focus components and execute validated movement commands", async () => {
  const store = createInfiniteCanvasStore({
    initialState: {
      camera: { center: { x: 0, y: 0 }, zoom: 1 },
      windows: [
        createInfiniteCanvasWindow({
          id: "card",
          kind: "card",
          title: "Card",
          rect: { x: 800, y: 400, width: 400, height: 200 },
        }),
        createInfiniteCanvasWindow({
          id: "other",
          kind: "card",
          title: "Other",
          rect: { x: 1400, y: 400, width: 400, height: 200 },
        }),
      ],
    },
  });
  const tools = createCanvasTools({ store });
  const navigate = tools.find(({ name }) => name === "camera.navigate")!;
  const execute = tools.find(({ name }) => name === "command.execute")!;
  const context = { signal: new AbortController().signal };
  expect(await navigate.execute({ target: { type: "window", windowId: "card" } }, context)).toEqual(
    { center: { x: 1000, y: 500 }, zoom: 1 },
  );
  await execute.execute(
    {
      command: {
        type: "selection.set",
        selection: {
          anchorTarget: { type: "window" as const, id: "card" },
          targets: [
            { type: "window" as const, id: "card" },
            { type: "window" as const, id: "missing" },
          ],
        },
      },
    },
    context,
  );
  expect(store.getState().activeWindowId).toBe("card");
  expect(getSelectedWindowIds(store.getState().selection)).toEqual(["card"]);
  expect(
    await execute.execute(
      { command: { type: "window.nudge", direction: "right", amountPx: 75 } },
      context,
    ),
  ).toEqual({ executed: "window.nudge" });
  expect(store.getState().windows[0]?.rect.x).toBe(875);
  const before = store.snapshot();
  expect(
    await execute.execute(
      { command: { type: "window.nudge", direction: "right", amountPx: "invalid" } },
      context,
    ),
  ).toBeInstanceOf(Error);
  expect(
    await navigate.execute({ target: { type: "window", windowId: "missing" } }, context),
  ).toBeInstanceOf(Error);
  expect(store.snapshot()).toEqual(before);
  await execute.execute(
    {
      command: {
        type: "selection.set",
        selection: {
          anchorTarget: { type: "window" as const, id: "card" },
          targets: [
            { type: "window" as const, id: "card" },
            { type: "window" as const, id: "other" },
          ],
        },
      },
    },
    context,
  );
  await execute.execute({ command: { type: "selection.group", groupId: "cards" } }, context);
  const memberRects = structuredClone([...store.layout$.peek().windowRects]);
  const bounds = { x: 600, y: 200, width: 1200, height: 500 };
  expect(
    await execute.execute(
      { command: { type: "group.setBounds", groupId: "cards", bounds } },
      context,
    ),
  ).toEqual({ executed: "group.setBounds" });
  expect([...store.layout$.peek().windowRects]).toEqual(memberRects);
  expect(store.getState().groups[0]?.bounds).toEqual(bounds);
  await execute.execute(
    { command: { type: "window.nudge", direction: "right", amountPx: 20 } },
    context,
  );
  expect(store.getState().groups[0]?.bounds).toEqual({ ...bounds, x: 620 });
});
