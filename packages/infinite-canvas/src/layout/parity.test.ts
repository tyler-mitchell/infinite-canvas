import { expect, test } from "vite-plus/test";
import { StackedLayout } from "@hyphened/math/cpu";
import { arrangeWindows, bindLayout, type LayoutNode } from "./arrange";
import { lanes } from "./lanes";

test("lanes preserve StackedLayout placement with padding and translated origins", () => {
  const layouts = { lanes: bindLayout(lanes) };
  const random = (seed: number) => () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  for (const seed of Array.from({ length: 200 }, (_, index) => index + 1)) {
    const next = random(seed);
    const columns = 1 + Math.floor(next() * 6);
    const gap = Math.floor(next() * 16);
    const padding = Math.floor(next() * 12);
    const entries = Array.from({ length: Math.floor(next() * 10) }, (_, index) => ({
      id: `w${index}`,
      span: 1 + Math.floor(next() * columns),
      height: Math.floor(next() * 300),
      hidden: next() < 0.1,
    }));
    const rect = { x: 17, y: 23, width: 700, height: 10 };
    const nodes: Record<string, LayoutNode> = Object.fromEntries(
      entries.map((entry) => [
        entry.id,
        { item: { columnSpan: entry.span, hidden: entry.hidden } },
      ]),
    );
    const limits = Object.fromEntries(
      entries.map(({ id, height }) => [
        id,
        {
          ideal: { width: 0, height },
          min: { width: 0, height },
          max: { width: Infinity, height },
        },
      ]),
    );
    const actual = arrangeWindows({
      id: "root",
      rect,
      layouts,
      limits,
      nodes: {
        ...nodes,
        root: {
          layout: { type: "lanes", columns, gap, padding },
          children: entries.map(({ id }) => id),
        },
      },
    });
    const reference = new StackedLayout(null, 0, 0, columns, columns, 1, 0, 0);
    const pitch = (rect.width - 2 * padding + gap) / columns;
    for (const entry of entries) {
      expect(actual.visible[entry.id]).toBe(!entry.hidden);
      if (entry.hidden) continue;
      const box = reference.next([entry.span, entry.height + gap]);
      expect(actual.rects[entry.id].x, `seed ${seed}`).toBeCloseTo(
        rect.x + padding + box.x * pitch,
      );
      expect(actual.rects[entry.id].y).toBe(rect.y + padding + box.y);
      expect(actual.rects[entry.id].width).toBeCloseTo(entry.span * pitch - gap);
      expect(actual.rects[entry.id].height).toBe(entry.height);
    }
  }
});
