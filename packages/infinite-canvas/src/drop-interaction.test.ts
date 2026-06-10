import { expect, test } from "vite-plus/test";

import {
  createInfiniteCanvasDropInteraction,
  isPointInsideInfiniteCanvasViewport,
} from "./drop-interaction";

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
