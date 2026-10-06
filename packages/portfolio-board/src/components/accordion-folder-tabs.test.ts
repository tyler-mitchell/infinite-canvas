import { expect, test } from "vite-plus/test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  AccordionFolderTabs,
  liquidTabPath,
  tabWidthForRail,
  type AccordionFolderTabsGeometry,
} from "./accordion-folder-tabs.tsx";

const geometry: AccordionFolderTabsGeometry = {
  dragThreshold: 5,
  maxTabWidth: 160,
  minTabWidth: 112,
  tabHeight: 40,
  tabRadius: 18,
  railHeight: 64,
  surfaceInset: 12,
  join: 16,
  panelRadius: 16,
};

const numbers = (command: string) =>
  Array.from(command.matchAll(/-?\d+(?:\.\d+)?/g), (match) => Number(match[0]));

test("tabs keep a minimum width when labels and actions exceed the rail", () => {
  expect(
    tabWidthForRail({
      surfaceWidth: 360,
      count: 5,
      actionsWidth: 24,
      hasActions: true,
      tabGap: 12,
      geometry,
    }),
  ).toBe(112);
  expect(
    tabWidthForRail({
      surfaceWidth: 880,
      count: 3,
      actionsWidth: 24,
      hasActions: true,
      tabGap: 12,
      geometry,
    }),
  ).toBe(160);
});

test("the panel corners and tab joins keep the same tangent near both edges", () => {
  for (const [width, tabWidth] of [
    [360, 112],
    [800, 160],
  ] as const) {
    const panelLeft = geometry.surfaceInset;
    const panelRight = width - geometry.surfaceInset;

    for (const distance of [24, 28, 32, 36]) {
      const leftCommands =
        liquidTabPath(panelLeft + distance, width, 320, tabWidth, geometry).match(
          /[A-Z][^A-Z]*/g,
        ) ?? [];
      const leftCorner = numbers(leftCommands[1]);
      const leftJoin = numbers(leftCommands[3]);
      const leftJoinX = numbers(leftCommands[2])[0];
      const leftCornerTangent = [leftCorner[4] - leftCorner[2], leftCorner[5] - leftCorner[3]];
      const leftJoinTangent = [leftJoin[0] - leftJoinX, leftJoin[1] - geometry.railHeight];

      expect(
        Math.abs(
          leftCornerTangent[0] * leftJoinTangent[1] - leftCornerTangent[1] * leftJoinTangent[0],
        ),
      ).toBeLessThan(1e-6);
      expect(
        leftCornerTangent[0] * leftJoinTangent[0] + leftCornerTangent[1] * leftJoinTangent[1],
      ).toBeGreaterThan(0);

      const rightCommands =
        liquidTabPath(panelRight - tabWidth - distance, width, 320, tabWidth, geometry).match(
          /[A-Z][^A-Z]*/g,
        ) ?? [];
      const rightJoin = numbers(rightCommands[9]);
      const rightCorner = numbers(rightCommands[11]);
      const rightCornerX = numbers(rightCommands[10])[0];
      const rightJoinTangent = [rightJoin[4] - rightJoin[2], rightJoin[5] - rightJoin[3]];
      const rightCornerTangent = [
        rightCorner[0] - rightCornerX,
        rightCorner[1] - geometry.railHeight,
      ];

      expect(
        Math.abs(
          rightJoinTangent[0] * rightCornerTangent[1] - rightJoinTangent[1] * rightCornerTangent[0],
        ),
      ).toBeLessThan(1e-6);
      expect(
        rightJoinTangent[0] * rightCornerTangent[0] + rightJoinTangent[1] * rightCornerTangent[1],
      ).toBeGreaterThan(0);
    }

    for (const left of [panelLeft, panelRight - tabWidth]) {
      expect(liquidTabPath(left, width, 320, tabWidth, geometry)).not.toMatch(/NaN|Infinity/);
    }

    const leftEdge = liquidTabPath(panelLeft + 4, width, 320, tabWidth, geometry);
    const rightEdge = liquidTabPath(panelRight - tabWidth - 4, width, 320, tabWidth, geometry);
    const leftJoin = numbers(leftEdge.match(/[A-Z][^A-Z]*/g)?.[3] ?? "");
    const rightJoin = numbers(rightEdge.match(/[A-Z][^A-Z]*/g)?.[9] ?? "");
    expect(leftJoin[0]).toBe(panelLeft);
    expect(leftJoin[1]).toBeLessThan(geometry.railHeight);
    expect(rightJoin[2]).toBe(panelRight);
    expect(rightJoin[3]).toBeLessThan(geometry.railHeight);
  }
});

test("an empty folder remains visible with or without an action", () => {
  const withoutAction = renderToStaticMarkup(createElement(AccordionFolderTabs, { items: [] }));
  const html = renderToStaticMarkup(
    createElement(AccordionFolderTabs, {
      items: [],
      actions: createElement("button", { type: "button" }, "Add tab"),
    }),
  );

  expect(withoutAction).toContain("No tabs yet");
  expect(withoutAction).toContain('role="status"');
  expect(withoutAction).not.toContain('role="tablist"');
  expect(html).toContain("Add tab");
  expect(html).toContain("No tabs yet");
  expect(html).not.toContain('role="tabpanel"');
});

test("the caller can replace the empty content", () => {
  const html = renderToStaticMarkup(
    createElement(AccordionFolderTabs, {
      items: [],
      emptyState: createElement("p", null, "Create your first folder"),
    }),
  );

  expect(html).toContain("Create your first folder");
  expect(html).not.toContain("No tabs yet");
});

test("the rail snaps by default and accepts a softer policy", () => {
  const items = [{ id: "one", label: "One", content: "Content" }];
  const defaultHtml = renderToStaticMarkup(createElement(AccordionFolderTabs, { items }));
  const proximityHtml = renderToStaticMarkup(
    createElement(AccordionFolderTabs, { items, scrollSnap: "proximity" }),
  );

  expect(defaultHtml).toContain("scroll-snap-type:x mandatory");
  expect(proximityHtml).toContain("scroll-snap-type:x proximity");
});
