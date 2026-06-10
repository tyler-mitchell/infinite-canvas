import { expect, test } from "vite-plus/test";

import {
  createInfiniteCanvasDropInteraction,
  getInfiniteCanvasDropPlacement,
  isPointInsideInfiniteCanvasViewport,
} from "./drop-interaction";
import { createInfiniteCanvasState, createInfiniteCanvasWindow } from "./factory";

test("drop interaction maps viewport points into world points", () => {
  const interaction = createInfiniteCanvasDropInteraction({
    camera: {
      center: {
        x: 200,
        y: 100,
      },
      zoom: 2,
    },
    clientPoint: {
      x: 550,
      y: 260,
    },
    id: "asset-note",
    originClientPoint: {
      x: 540,
      y: 250,
    },
    payload: {
      kind: "note",
    },
    pointerId: 7,
    viewport: {
      height: 400,
      width: 600,
    },
    viewportPoint: {
      x: 450,
      y: 260,
    },
  });

  expect(interaction.status).toBe("dragging");
  if (interaction.status !== "dragging") {
    throw new Error("Expected drag interaction.");
  }

  expect(interaction.isOverViewport).toBe(true);
  expect(interaction.dropTarget).toMatchObject({
    status: "valid",
    target: {
      type: "empty-world",
    },
  });
  expect(interaction.worldPoint).toEqual({
    x: 275,
    y: 130,
  });
});

test("drop interaction carries target validation", () => {
  const interaction = createInfiniteCanvasDropInteraction({
    camera: {
      center: {
        x: 0,
        y: 0,
      },
      zoom: 1,
    },
    clientPoint: {
      x: 20,
      y: 20,
    },
    id: "asset-note",
    originClientPoint: {
      x: 20,
      y: 20,
    },
    payload: {
      kind: "note",
    },
    pointerId: 7,
    validation: {
      accepted: false,
      reason: "Window body rejects this payload.",
    },
    viewport: {
      height: 100,
      width: 100,
    },
    viewportPoint: {
      x: 20,
      y: 20,
    },
  });

  expect(interaction.status).toBe("dragging");
  if (interaction.status !== "dragging") {
    throw new Error("Expected drag interaction.");
  }

  expect(interaction.dropTarget).toMatchObject({
    reason: "Window body rejects this payload.",
    status: "invalid",
  });
});

const placementNeighborState = createInfiniteCanvasState({
  windows: [
    createInfiniteCanvasWindow({
      id: "neighbor",
      kind: "note",
      rect: {
        height: 100,
        width: 200,
        x: 0,
        y: 0,
      },
      title: "Neighbor",
    }),
  ],
});

test("drop placement anchors the rect on the pointer", () => {
  const placement = getInfiniteCanvasDropPlacement({
    size: {
      height: 80,
      width: 100,
    },
    state: createInfiniteCanvasState({ windows: [] }),
    worldPoint: {
      x: 500,
      y: 500,
    },
  });

  expect(placement.rect).toEqual({
    height: 80,
    width: 100,
    x: 450,
    y: 460,
  });
  expect(placement.preview).toBeNull();
});

test("drop placement respects a custom pointer anchor", () => {
  const placement = getInfiniteCanvasDropPlacement({
    anchor: {
      x: 0,
      y: 0,
    },
    size: {
      height: 80,
      width: 100,
    },
    state: createInfiniteCanvasState({ windows: [] }),
    worldPoint: {
      x: 500,
      y: 500,
    },
  });

  expect(placement.rect.x).toBe(500);
  expect(placement.rect.y).toBe(500);
});

test("drop placement snaps against visible windows like a window move", () => {
  const placement = getInfiniteCanvasDropPlacement({
    size: {
      height: 80,
      width: 100,
    },
    state: placementNeighborState,
    worldPoint: {
      // Unsnapped left edge lands at 203, within the 10px threshold of the
      // neighbor's right edge at 200.
      x: 253,
      y: 200,
    },
  });

  expect(placement.rect.x).toBe(200);
  expect(placement.preview).not.toBeNull();
  expect(placement.preview?.guides.length).toBeGreaterThan(0);
});

test("drop placement skips snapping when disabled", () => {
  const placement = getInfiniteCanvasDropPlacement({
    size: {
      height: 80,
      width: 100,
    },
    snapPolicy: false,
    state: placementNeighborState,
    worldPoint: {
      x: 253,
      y: 200,
    },
  });

  expect(placement.rect.x).toBe(203);
  expect(placement.preview).toBeNull();
});

test("drop interaction marks pointer positions outside the viewport", () => {
  expect(
    isPointInsideInfiniteCanvasViewport(
      {
        height: 400,
        width: 600,
      },
      {
        x: 601,
        y: 200,
      },
    ),
  ).toBe(false);
});
