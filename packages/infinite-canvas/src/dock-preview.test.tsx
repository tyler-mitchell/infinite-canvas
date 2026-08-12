import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vite-plus/test";

import { DEFAULT_INFINITE_CANVAS_SNAP_POLICY } from "./constants";
import {
  createInfiniteCanvasState,
  createInfiniteCanvasWindow,
  defineInfiniteCanvasWindowRegistry,
} from "./factory";
import { InfiniteCanvasViewport } from "./infinite-canvas";
import { beginWindowMove, finishCanvasInteraction, stepCanvasInteraction } from "./interaction";
import { InfiniteCanvasProvider } from "./store";
import type { InfiniteCanvasState } from "./types";

/**
 * FAIL-002 — "rapid hover between neighbouring docking targets doesn't flicker".
 *
 * The scenario reads like a timing problem and is not one. What makes flicker impossible is
 * structural: the dock preview is **resolved once into interaction state**, and both the
 * overlay and the release read that stored value rather than hit-testing again. Two
 * hit-tests for one pointer position is the shape that has produced three defects in this
 * codebase already — a duplicate `interaction.step` dispatcher, a dangling `aria-controls`,
 * and a doc entry spliced into its neighbour — so the property worth asserting is the single
 * source, not the frame rate.
 *
 * It stood at `built`: "docking exists ... Unasserted."
 */

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

/**
 * Camera at the origin, so world (0,0) sits at screen (600,400): `west` spans screen x
 * 200–500 and `east` spans 600–900, both fully in view.
 */
const twoPanes = (): InfiniteCanvasState<Kind> => ({
  ...createInfiniteCanvasState<Kind>({ windows: [paneAt("west", -400), paneAt("east", 0)] }),
  activeWindowId: "west",
  camera: { center: { x: 0, y: 0 }, zoom: 1 },
  viewport: { height: 800, width: 1200 },
});

const dragOnto = (point: Readonly<{ x: number; y: number }>) =>
  stepCanvasInteraction(
    beginWindowMove(twoPanes(), POINTER, "west", { x: 350, y: 500 }),
    POINTER,
    point,
    DEFAULT_INFINITE_CANVAS_SNAP_POLICY,
    { dockIntent: true },
  );

/**
 * A dock region is **not** a half. `getInfiniteCanvasGroupDockEdgeAtPoint` normalizes the
 * distance to each of the four edges, returns `center` when all four are at least 34% away
 * — that is the tab-merge zone — and otherwise takes the nearest edge. So a point can sit
 * in the left half and still resolve to `south` by being closer to the bottom.
 *
 * `east` spans screen x 600–900 and y 400–600. This point is 13% from its west edge and 50%
 * from north and south, so west is unambiguously nearest.
 */
const OVER_WEST_EDGE = { x: 640, y: 500 };

test("a drag with dock intent resolves a preview into interaction state", () => {
  const dragging = dragOnto(OVER_WEST_EDGE);
  const preview = dragging.interaction?.kind === "move" ? dragging.interaction.dockPreview : null;

  expect(preview?.targetId).toBe("east");
  expect(preview?.edge).toBe("west");
});

test("the overlay renders the stored preview rather than hit-testing again", () => {
  // The single-source claim, checked across the boundary: the overlay is a component reading
  // `interaction.dockPreview`, so the edge in the markup can only have come from the value
  // the release will use.
  const dragging = dragOnto(OVER_WEST_EDGE);
  const markup = renderToStaticMarkup(
    <InfiniteCanvasProvider initialState={dragging}>
      <InfiniteCanvasViewport<Kind> windowDefinitions={registry} />
    </InfiniteCanvasProvider>,
  );

  expect(markup).toContain('data-slot="dock-region"');
  expect(markup).toContain('data-edge="west"');
});

test("no preview, no overlay", () => {
  // A drag without dock intent must leave the canvas clean: docking is an explicit gesture,
  // and an overlay that appeared on any drag would claim otherwise.
  const plainDrag = stepCanvasInteraction(
    beginWindowMove(twoPanes(), POINTER, "west", { x: 350, y: 500 }),
    POINTER,
    OVER_WEST_EDGE,
    DEFAULT_INFINITE_CANVAS_SNAP_POLICY,
  );
  const markup = renderToStaticMarkup(
    <InfiniteCanvasProvider initialState={plainDrag}>
      <InfiniteCanvasViewport<Kind> windowDefinitions={registry} />
    </InfiniteCanvasProvider>,
  );

  expect(markup).not.toContain('data-slot="dock-region"');
});

test("moving within one dock region does not change the preview — this is the no-flicker property", () => {
  // Flicker would mean the preview churning while the pointer wanders inside a single
  // region. The region's rect is a property of the target and the edge, not of the pointer,
  // so positions spread through one region must all yield the same answer.
  //
  // Spread down the west zone at 7%, 13% and 20% across — the first draft put the third
  // point at 47% across and 90% down and got `south`, which was correct: nearest edge, not
  // nearest half. The fixture was wrong, not the resolver.
  const previews = [
    { x: 620, y: 450 },
    { x: 640, y: 500 },
    { x: 660, y: 550 },
  ].map((point) => {
    const dragging = dragOnto(point);

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
  // What the property is *for*. The release reads the same stored preview, so the group it
  // builds is the one the user was shown — not the result of a second hit-test at whatever
  // position the pointer happened to reach on the way up.
  const dragging = dragOnto(OVER_WEST_EDGE);
  const preview = dragging.interaction?.kind === "move" ? dragging.interaction.dockPreview : null;
  const dropped = finishCanvasInteraction(dragging, POINTER);

  expect(dropped.interaction).toBeNull();
  expect(dropped.groups).toHaveLength(1);
  // Docking onto a floating window wraps it in a group occupying the rect it already had,
  // so the shell lands where the target was standing (DOCK-001).
  expect(dropped.groups[0]!.rect).toEqual(twoPanes().windows[1]!.rect);
  expect(preview?.containerId).toContain("east");
});
