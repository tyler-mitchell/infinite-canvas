import { expect, test } from "vite-plus/test";
import { getCameraTrack, getRoute } from "./route";

const insets = { top: 0, right: 0, bottom: 0, left: 0 };
const limits = { minZoom: 0.1, maxZoom: 4, padding: 0 };

test("the route is the reading order of the layout: rows top to bottom, left to right, into containers", () => {
  const route = getRoute({
    windows: {
      board: { children: ["b", "a", "row"] },
      a: {},
      b: {},
      row: { children: ["d", "c"] },
      c: {},
      d: {},
      note: {},
    },
    rects: {
      board: { x: 0, y: 0, width: 400, height: 300 },
      a: { x: 0, y: 0, width: 200, height: 100 },
      b: { x: 200, y: 0, width: 200, height: 100 },
      row: { x: 0, y: 100, width: 400, height: 100 },
      c: { x: 0, y: 100, width: 200, height: 100 },
      d: { x: 200, y: 100, width: 200, height: 100 },
      note: { x: 0, y: 500, width: 200, height: 100 },
    },
    roots: ["note", "board"],
  });
  expect(route.map((section) => section.id)).toEqual(["a", "b", "c", "d", "note"]);
});

test("a window that is not a section leaves the route and takes its children with it", () => {
  const windows = {
    board: { children: ["a", "icon", "row"] },
    a: {},
    icon: {},
    row: { children: ["c", "d"] },
    c: {},
    d: {},
  };
  const rects = {
    board: { x: 0, y: 0, width: 400, height: 200 },
    a: { x: 0, y: 0, width: 200, height: 100 },
    icon: { x: 200, y: 0, width: 200, height: 100 },
    row: { x: 0, y: 100, width: 400, height: 100 },
    c: { x: 0, y: 100, width: 200, height: 100 },
    d: { x: 200, y: 100, width: 200, height: 100 },
  };
  const ids = (sections: Record<string, boolean>) =>
    getRoute({ windows, rects, roots: ["board"], sections }).map((section) => section.id);
  expect(ids({})).toEqual(["a", "icon", "c", "d"]);
  expect(ids({ icon: false })).toEqual(["a", "c", "d"]);
  expect(ids({ row: false })).toEqual(["a", "icon"]);
});

test("the track fits the route's width once and is long enough to reach every section", () => {
  const track = getCameraTrack({
    sections: [
      { id: "a", rect: { x: 100, y: 50, width: 800, height: 400 } },
      { id: "b", rect: { x: 100, y: 450, width: 800, height: 400 } },
    ],
    viewport: { width: 400, height: 300 },
    insets,
    limits,
  });
  expect(track).not.toBeNull();
  expect(track!.zoom).toBe(0.5);
  expect(track!.length).toBe(200);
  expect(track!.sections).toEqual([
    { id: "a", offset: 0 },
    { id: "b", offset: 200 },
  ]);
  expect(track!.stops).toEqual([0, 200]);
  expect(track!.at(0)).toEqual({ zoom: 0.5, center: { x: 500, y: 350 } });
  expect(track!.at(200)).toEqual({ zoom: 0.5, center: { x: 500, y: 750 } });
  expect(track!.at(999).center.y).toBe(750);
  expect(track!.offsetAt(track!.at(200))).toBe(200);
});

test("a horizontal track is the same track transposed: it fits the height and pans sideways", () => {
  const track = getCameraTrack({
    axis: "horizontal",
    sections: [
      { id: "a", rect: { x: 50, y: 100, width: 400, height: 800 } },
      { id: "b", rect: { x: 450, y: 100, width: 400, height: 800 } },
    ],
    viewport: { width: 300, height: 400 },
    insets,
    limits,
  });
  expect(track!.zoom).toBe(0.5);
  expect(track!.length).toBe(200);
  expect(track!.sections).toEqual([
    { id: "a", offset: 0 },
    { id: "b", offset: 200 },
  ]);
  expect(track!.at(0)).toEqual({ zoom: 0.5, center: { x: 350, y: 500 } });
  expect(track!.at(200)).toEqual({ zoom: 0.5, center: { x: 750, y: 500 } });
  expect(track!.at(999).center.x).toBe(750);
  expect(track!.offsetAt(track!.at(200))).toBe(200);
});

test("a route that fits the viewport has no length and snaps at zero; insets shift the frame", () => {
  const track = getCameraTrack({
    sections: [{ id: "a", rect: { x: 0, y: 0, width: 200, height: 100 } }],
    viewport: { width: 400, height: 300 },
    insets: { ...insets, top: 100 },
    limits,
    maxZoom: 1,
  });
  expect(track!.zoom).toBe(1);
  expect(track!.length).toBe(0);
  expect(track!.at(0).center).toEqual({ x: 100, y: 50 });
  expect(
    getCameraTrack({ sections: [], viewport: { width: 400, height: 300 }, insets, limits }),
  ).toBeNull();
});

test("sections that share a row keep their own entries and share one scroll stop", () => {
  const track = getCameraTrack({
    sections: [
      { id: "left", rect: { x: 0, y: 0, width: 200, height: 100 } },
      { id: "right", rect: { x: 200, y: 0, width: 200, height: 100 } },
      { id: "below", rect: { x: 0, y: 100, width: 400, height: 100 } },
    ],
    viewport: { width: 400, height: 100 },
    insets,
    limits,
    maxZoom: 1,
  });
  expect(track!.sections).toEqual([
    { id: "left", offset: 0 },
    { id: "right", offset: 0 },
    { id: "below", offset: 100 },
  ]);
  expect(track!.stops).toEqual([0, 100]);
});
