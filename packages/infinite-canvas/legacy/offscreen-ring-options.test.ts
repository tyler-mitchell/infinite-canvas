import { expect, test } from "vite-plus/test";

import { createInfiniteCanvasState, createInfiniteCanvasWindow } from "./factory";
import { getInfiniteCanvasOffscreenIndicators } from "./offscreen";

const farAway = createInfiniteCanvasState<"note">({
  camera: { center: { x: 20000, y: 20000 }, zoom: 1 },
  viewport: { height: 900, width: 1440 },
  windows: [
    createInfiniteCanvasWindow<"note">({
      id: "a",
      kind: "note",
      rect: { height: 200, width: 300, x: -3000, y: 1000 },
      title: "Far away",
    }),
  ],
});

test("ring options tune where an arrow sits, not whether there is one", () => {
  const tuned = getInfiniteCanvasOffscreenIndicators(farAway, { insetPx: 26, limit: 5 });
  const defaults = getInfiniteCanvasOffscreenIndicators(farAway);

  expect(defaults).toHaveLength(1);
  expect(tuned).toHaveLength(1);
  expect(tuned[0]?.id).toBe(defaults[0]?.id);
  expect(tuned[0]?.point).not.toStrictEqual(defaults[0]?.point);
});
