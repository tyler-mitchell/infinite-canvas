import { d, std, tgpu } from "typegpu";
import { describe, expect, test } from "vite-plus/test";
import {
  View,
  cameraShowing,
  panCamera,
  screenToClip,
  screenToWorld,
  viewportRect,
  visibleWorldRect,
  worldToScreen,
  zoomCameraAbout,
} from "./gpu";
import { centerOfRect, Insets, Rect } from "./rect";

const camera = View({
  center: d.vec2f(120, -40),
  viewport: d.vec2f(800, 600),
  zoom: 1.5,
});
const insets = Insets({ top: 48, right: 16, bottom: 0, left: 220 });
const none = Insets({ top: 0, right: 0, bottom: 0, left: 0 });

// The shape this package replaces: packages/infinite-canvas/legacy/geometry.ts, restated rather than
// imported, so the test does not make that package a dependency of this one.
const incumbent = {
  worldToScreen: (
    centre: { x: number; y: number },
    viewport: { width: number; height: number },
    zoom: number,
    point: { x: number; y: number },
  ) => ({
    x: (point.x - centre.x) * zoom + viewport.width / 2,
    y: (point.y - centre.y) * zoom + viewport.height / 2,
  }),
  screenToWorld: (
    centre: { x: number; y: number },
    viewport: { width: number; height: number },
    zoom: number,
    point: { x: number; y: number },
  ) => ({
    x: centre.x + (point.x - viewport.width / 2) / zoom,
    y: centre.y + (point.y - viewport.height / 2) / zoom,
  }),
};

const asPlain = (camera: View) => ({
  centre: { x: camera.center.x, y: camera.center.y },
  viewport: { width: camera.viewport.x, height: camera.viewport.y },
});

describe("this camera reproduces the rule it is replacing, in three places at once", () => {
  const { centre, viewport } = asPlain(camera);

  test("worldToScreen agrees with the DOM function for ordinary coordinates", () => {
    [d.vec2f(0, 0), d.vec2f(120, -40), d.vec2f(-900, 640), d.vec2f(12.5, 0.25)].forEach((world) => {
      const mine = worldToScreen(world, camera);
      const theirs = incumbent.worldToScreen(centre, viewport, camera.zoom, {
        x: world.x,
        y: world.y,
      });
      expect(mine.x).toBeCloseTo(theirs.x, 3);
      expect(mine.y).toBeCloseTo(theirs.y, 3);
    });
  });

  test("screenToWorld agrees with the DOM function too", () => {
    [d.vec2f(0, 0), d.vec2f(400, 300), d.vec2f(-50, 780)].forEach((screen) => {
      const mine = screenToWorld(screen, camera);
      const theirs = incumbent.screenToWorld(centre, viewport, camera.zoom, {
        x: screen.x,
        y: screen.y,
      });
      expect(mine.x).toBeCloseTo(theirs.x, 3);
      expect(mine.y).toBeCloseTo(theirs.y, 3);
    });
  });

  test("the two disagree far from the origin, which is why one owner is the point", () => {
    const far = View({ center: d.vec2f(1e7, 0), viewport: d.vec2f(800, 600), zoom: 1 });
    const world = d.vec2f(1e7 + 0.1, 0);
    const mine = worldToScreen(world, far);
    const theirs = incumbent.worldToScreen({ x: 1e7, y: 0 }, { width: 800, height: 600 }, 1, {
      x: 1e7 + 0.1,
      y: 0,
    });
    // The f64 copy keeps the tenth of a pixel; f32 storage cannot, and the shader agrees with f32.
    expect(theirs.x).toBeCloseTo(400.1, 4);
    expect(mine.x).toBe(400);
    expect(mine.x).not.toBe(theirs.x);
  });
});

describe("the two directions of one mapping", () => {
  test("invert each other", () => {
    [d.vec2f(310, 95), d.vec2f(0, 0), d.vec2f(800, 600)].forEach((point) => {
      const back = worldToScreen(screenToWorld(point, camera), camera);
      expect(back.x).toBeCloseTo(point.x, 3);
      expect(back.y).toBeCloseTo(point.y, 3);
    });
  });

  test("put the camera centre at the middle of the viewport", () => {
    const middle = worldToScreen(camera.center, camera);
    expect(middle.x).toBeCloseTo(400, 4);
    expect(middle.y).toBeCloseTo(300, 4);
  });

  test("agree with the formula the compositor backend writes by hand", () => {
    const point = d.vec2f(310, 95);
    const compositorWorldToScreen = std.add(
      std.mul(std.sub(point, camera.center), camera.zoom),
      std.mul(camera.viewport, 0.5),
    );
    const compositorScreenToWorld = std.add(
      std.div(std.sub(point, std.mul(camera.viewport, 0.5)), camera.zoom),
      camera.center,
    );
    expect(worldToScreen(point, camera)).toEqual(compositorWorldToScreen);
    expect(screenToWorld(point, camera)).toEqual(compositorScreenToWorld);
  });

  test("screenToClip maps the viewport corners to the clip cube, y flipped", () => {
    expect(screenToClip(d.vec2f(0, 0), camera)).toEqual(d.vec4f(-1, 1, 0, 1));
    expect(screenToClip(d.vec2f(800, 600), camera)).toEqual(d.vec4f(1, -1, 0, 1));
  });
});

describe("cameraShowing is the single conversion boundary", () => {
  test("puts the world point at the screen point", () => {
    const worldPoint = d.vec2f(-13, 210);
    const screenPoint = d.vec2f(640, 120);
    const placed = cameraShowing(worldPoint, screenPoint, 0.8, camera.viewport);
    const shown = worldToScreen(worldPoint, placed);
    expect(shown.x).toBeCloseTo(screenPoint.x, 3);
    expect(shown.y).toBeCloseTo(screenPoint.y, 3);
  });

  test("reproduces the framing the canvas computes by hand for a navigation target", () => {
    const rect = Rect({ x: -200, y: 60, width: 400, height: 150 });
    const position = d.vec2f(0.5, 0.35);
    const zoom = 0.9;
    const width = 800 - insets.left - insets.right;
    const height = 600 - insets.top - insets.bottom;
    const byHand = d.vec2f(
      rect.x + rect.width / 2 - (insets.left + width * position.x - 400) / zoom,
      rect.y + rect.height / 2 - (insets.top + height * position.y - 300) / zoom,
    );
    const placed = cameraShowing(
      centerOfRect(rect),
      d.vec2f(insets.left + width * position.x, insets.top + height * position.y),
      zoom,
      camera.viewport,
    );
    expect(placed.center.x).toBeCloseTo(byHand.x, 2);
    expect(placed.center.y).toBeCloseTo(byHand.y, 2);
  });
});

describe("zoomCameraAbout and panCamera", () => {
  test("zoom leaves the world point under the screen point where it was", () => {
    const screenPoint = d.vec2f(210, 470);
    const before = screenToWorld(screenPoint, camera);
    [0.25, 0.9, 1, 3.75].forEach((zoom) => {
      const after = screenToWorld(screenPoint, zoomCameraAbout(camera, screenPoint, zoom));
      expect(after.x).toBeCloseTo(before.x, 2);
      expect(after.y).toBeCloseTo(before.y, 2);
    });
  });

  test("zoom reproduces the wheel formula the canvas computes by hand", () => {
    const screenPoint = d.vec2f(210, 470);
    const zoom = 2.25;
    const offset = d.vec2f(screenPoint.x - 400, screenPoint.y - 300);
    const byHand = d.vec2f(
      camera.center.x + offset.x / camera.zoom - offset.x / zoom,
      camera.center.y + offset.y / camera.zoom - offset.y / zoom,
    );
    const zoomed = zoomCameraAbout(camera, screenPoint, zoom);
    expect(zoomed.center.x).toBeCloseTo(byHand.x, 2);
    expect(zoomed.center.y).toBeCloseTo(byHand.y, 2);
  });

  test("pan reproduces the drag the canvas computes by hand", () => {
    const grabbed = d.vec2f(300, 200);
    const pointer = d.vec2f(260, 245);
    const byHand = d.vec2f(
      camera.center.x - (pointer.x - grabbed.x) / camera.zoom,
      camera.center.y - (pointer.y - grabbed.y) / camera.zoom,
    );
    const panned = panCamera(camera, std.sub(grabbed, pointer));
    expect(panned.center.x).toBeCloseTo(byHand.x, 3);
    expect(panned.center.y).toBeCloseTo(byHand.y, 3);
  });
});

describe("visibleWorldRect and viewportRect", () => {
  test("cover the whole viewport when there are no insets", () => {
    const visible = visibleWorldRect(camera, none);
    expect(visible.width).toBeCloseTo(800 / 1.5, 2);
    expect(visible.height).toBeCloseTo(600 / 1.5, 2);
    expect(viewportRect(camera, none)).toEqual(Rect({ x: 0, y: 0, width: 800, height: 600 }));
  });

  test("shrink to the part the insets leave uncovered", () => {
    const visible = visibleWorldRect(camera, insets);
    const topLeft = screenToWorld(d.vec2f(insets.left, insets.top), camera);
    expect(visible.x).toBeCloseTo(topLeft.x, 3);
    expect(visible.y).toBeCloseTo(topLeft.y, 3);
    expect(visible.width).toBeCloseTo((800 - 220 - 16) / 1.5, 2);
    expect(viewportRect(camera, insets)).toEqual(
      Rect({ x: 220, y: 48, width: 800 - 236, height: 552 }),
    );
  });
});

describe("the camera functions resolve to WGSL", () => {
  test("so the compositor backend can call these instead of redefining them", () => {
    const wgsl = tgpu.resolve([worldToScreen, screenToWorld, screenToClip, cameraShowing]);
    expect(wgsl).toContain("fn worldToScreen");
    expect(wgsl).toContain("fn screenToWorld");
    expect(wgsl).toContain("fn screenToClip");
    expect(wgsl).toContain("fn cameraShowing");
  });
});
