import { observable } from "@legendapp/state";
import { expect, test } from "vite-plus/test";

import { createInfiniteCanvasState, createInfiniteCanvasWindow } from "./factory";
import { getFramedWindows, type InfiniteCanvasVisibilityState } from "./visibility";

type Kind = "note";

const windowAt = (id: string, x: number, mode: "minimized" | "normal" = "normal") =>
  createInfiniteCanvasWindow<Kind>({
    id,
    kind: "note",
    mode,
    rect: { height: 200, width: 300, x, y: 0 },
  });

const canvasWith = (...windows: readonly ReturnType<typeof windowAt>[]) =>
  createInfiniteCanvasState<Kind>({
    viewport: { height: 800, width: 1200 },
    windows: [...windows],
  });

test("framing covers the windows the viewport shows and omits the minimized ones", () => {
  const framed = getFramedWindows(
    canvasWith(windowAt("near", 0), windowAt("far", 40_000), windowAt("tray", 0, "minimized")),
  );

  expect(framed).toEqual({ far: false, near: true });
});

// The probe writes the whole record on every store change. These three tests
// pin the Legend-State behaviour that lets it do so without any change
// tracking of its own. If one fails, the probe needs that tracking back.
test("writing an equal record notifies nobody", () => {
  const visibility$ = observable<InfiniteCanvasVisibilityState>({});
  const notifications = { count: 0 };

  visibility$.onChange(() => {
    notifications.count += 1;
  });

  visibility$.set({ far: false, near: true });
  visibility$.set({ far: false, near: true });

  expect(notifications.count).toBe(1);
});

test("writing the whole record drops a window that has closed", () => {
  const visibility$ = observable<InfiniteCanvasVisibilityState>({ far: false, near: true });

  visibility$.set({ near: true });

  expect(visibility$.get()).toEqual({ near: true });
});

test("one window's reader is untouched when another window's framing changes", () => {
  const visibility$ = observable<InfiniteCanvasVisibilityState>({ far: false, near: true });
  const nearNotifications = { count: 0 };

  visibility$["near"].onChange(() => {
    nearNotifications.count += 1;
  });

  visibility$.set({ far: true, near: true });

  expect(nearNotifications.count).toBe(0);
});
