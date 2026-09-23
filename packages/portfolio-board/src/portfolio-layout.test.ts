import { expect, test } from "vite-plus/test";
import { createCanvas } from "../portfolio/canvas.ts";
import documentSource from "../portfolio/document.json?raw";

test.each([880, 800, 740, 700, 660, 640, 639, 480, 360])(
  "the portfolio preserves its authored layout at viewport width %s",
  (width) => {
    const canvas = createCanvas(JSON.parse(documentSource));
    canvas.state.input.viewport.set({ width, height: 800 });
    const rect = (id: string) => canvas.computed.windowRect[id].peek()!;
    const main = rect("main");
    const left = rect("type-atlas");
    const right = rect("hyphened");
    const large = rect("typescript");
    const small = rect("surrealdb");
    expect(main.width).toBe(880);
    expect(rect("profile").height).toBeLessThan(400);
    expect(large.width).toBeCloseTo(large.height);
    expect(small.width).toBeCloseTo(small.height);
    expect(large.width).toBeCloseTo(small.width * 2 + 12);
    expect(rect("nodedotjs").x).toBeCloseTo(large.x + large.width + 12);
    expect(right.y).toBe(left.y);
    expect(right.x).toBeCloseTo(left.x + left.width + 12);
    expect(right.x + right.width).toBeCloseTo(main.x + main.width);
  },
);
