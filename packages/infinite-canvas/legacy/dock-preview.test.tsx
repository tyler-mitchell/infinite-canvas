import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vite-plus/test";

import { DEFAULT_INFINITE_CANVAS_SNAP_POLICY } from "./constants";
import {
  createInfiniteCanvasState,
  createInfiniteCanvasWindow,
  defineInfiniteCanvasWindowRegistry,
} from "./factory";
import { InfiniteCanvasViewport } from "./infinite-canvas";
import { finishCanvasInteraction } from "./interaction";
import { InfiniteCanvasProvider } from "./react/store";
import { createInfiniteCanvasStore } from "./store";
import type { InfiniteCanvasState } from "./types";

type Kind = "note";

const POINTER = 1;

const registry = defineInfiniteCanvasWindowRegistry<Kind>({
  note: { kind: "note", renderBody: ({ window }) => <p>{window.title}</p> },
});

const paneAt = (id: string, x: number) =>
  createInfiniteCanvasWindow<Kind>({
    id,
    kind: "note",
    rect: { height: 200, width: 300, x, y: 0 },
    title: id,
  });

const twoPanes = (): InfiniteCanvasState<Kind> => ({
  ...createInfiniteCanvasState<Kind>({ windows: [paneAt("west", -400), paneAt("east", 0)] }),
  activeWindowId: "west",
  camera: { center: { x: 0, y: 0 }, zoom: 1 },
  viewport: { height: 800, width: 1200 },
});

const dragOnto = ({
  dockIntent = true,
  ...point
}: Readonly<{ x: number; y: number; dockIntent?: boolean }>) => {
  const store = createInfiniteCanvasStore({
    initialState: twoPanes(),
    snapPolicy: DEFAULT_INFINITE_CANVAS_SNAP_POLICY,
  });
  store.dispatch({
    type: "interaction.startMove",
    pointerId: POINTER,
    target: { type: "window", id: "west" },
    point: { x: 350, y: 500 },
  });
  store.dispatch({ type: "interaction.step", pointerId: POINTER, point, dockIntent });
  return store;
};

const OVER_WEST_EDGE = { x: 640, y: 500 };

test("a drag with dock intent resolves a preview into interaction state", () => {
  const dragging = dragOnto(OVER_WEST_EDGE).getState();
  const preview = dragging.interaction?.kind === "move" ? dragging.interaction.dockPreview : null;

  expect(preview?.targetId).toBe("east");
  expect(preview?.edge).toBe("west");
});

test("the overlay renders the stored preview rather than hit-testing again", () => {
  const store = dragOnto(OVER_WEST_EDGE);
  store.windowDefinitions$.set(registry);
  const markup = renderToStaticMarkup(
    <InfiniteCanvasProvider store={store}>
      <InfiniteCanvasViewport<Kind> />
    </InfiniteCanvasProvider>,
  );

  expect(markup).toContain('data-slot="dock-region"');
  expect(markup).toContain('data-edge="west"');
});

test("no preview, no overlay", () => {
  const store = dragOnto({ ...OVER_WEST_EDGE, dockIntent: false });
  store.windowDefinitions$.set(registry);
  const markup = renderToStaticMarkup(
    <InfiniteCanvasProvider store={store}>
      <InfiniteCanvasViewport<Kind> />
    </InfiniteCanvasProvider>,
  );

  expect(markup).not.toContain('data-slot="dock-region"');
});

test("moving within one dock region does not change the preview — this is the no-flicker property", () => {
  const previews = [
    { x: 620, y: 450 },
    { x: 640, y: 500 },
    { x: 660, y: 550 },
  ].map((point) => {
    const dragging = dragOnto(point).getState();

    return dragging.interaction?.kind === "move" ? dragging.interaction.dockPreview : null;
  });

  expect(previews.every((preview) => preview !== null)).toBe(true);
  expect(previews.map((preview) => `${preview?.targetId}:${preview?.edge}`)).toEqual([
    "east:west",
    "east:west",
    "east:west",
  ]);
  expect(previews.map((preview) => JSON.stringify(preview?.rect))).toEqual([
    JSON.stringify(previews[0]?.rect),
    JSON.stringify(previews[0]?.rect),
    JSON.stringify(previews[0]?.rect),
  ]);
});

test("releasing docks exactly where the overlay said it would", () => {
  const dragging = dragOnto(OVER_WEST_EDGE).getState();
  const preview = dragging.interaction?.kind === "move" ? dragging.interaction.dockPreview : null;
  const dropped = finishCanvasInteraction(dragging, POINTER);

  expect(dropped.interaction).toBeNull();
  expect(dropped.groups).toHaveLength(1);
  expect(dropped.groups[0]!.rect).toEqual(twoPanes().windows[1]!.rect);
  expect(preview?.containerId).toContain("east");
});
