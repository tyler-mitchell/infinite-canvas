import { expect, test } from "vite-plus/test";

import { mergeInfiniteCanvasSlotProps } from "./slot";

const syntheticEvent = () => ({ nativeEvent: {} }) as Record<string, unknown>;

test("both handlers run, consumer first", () => {
  const calls: string[] = [];
  const merged = mergeInfiniteCanvasSlotProps(
    { onPointerDown: () => calls.push("framework") },
    { onPointerDown: () => calls.push("consumer") },
  );

  (merged.onPointerDown as (event: unknown) => void)(syntheticEvent());

  expect(calls).toEqual(["consumer", "framework"]);
});

test("a consumer cannot disable framework behaviour just by passing the same prop", () => {
  let frameworkRan = false;
  const merged = mergeInfiniteCanvasSlotProps(
    {
      onPointerDown: () => {
        frameworkRan = true;
      },
    },
    { onPointerDown: () => undefined },
  );

  (merged.onPointerDown as (event: unknown) => void)(syntheticEvent());

  expect(frameworkRan).toBe(true);
});

test("preventInfiniteCanvasHandler is the supported way to decline it", () => {
  let frameworkRan = false;
  const merged = mergeInfiniteCanvasSlotProps(
    {
      onPointerDown: () => {
        frameworkRan = true;
      },
    },
    {
      onPointerDown: (event: { preventInfiniteCanvasHandler: () => void }) => {
        event.preventInfiniteCanvasHandler();
      },
    },
  );

  (merged.onPointerDown as (event: unknown) => void)(syntheticEvent());

  expect(frameworkRan).toBe(false);
});

test("a non-synthetic event runs both handlers with no opt-out", () => {
  const calls: string[] = [];
  const merged = mergeInfiniteCanvasSlotProps(
    { onCustom: () => calls.push("framework") },
    { onCustom: () => calls.push("consumer") },
  );

  (merged.onCustom as (value: unknown) => void)("not-an-event");

  expect(calls).toEqual(["consumer", "framework"]);
});

test("className concatenates consumer-first and style merges with the consumer last", () => {
  const merged = mergeInfiniteCanvasSlotProps(
    { className: "framework", style: { color: "red", position: "absolute" } },
    { className: "consumer", style: { color: "blue" } },
  );

  expect(merged.className).toBe("consumer framework");
  expect(merged.style).toEqual({ color: "blue", position: "absolute" });
});

test("data-slot is framework-owned and survives a consumer trying to set it", () => {
  const merged = mergeInfiniteCanvasSlotProps(
    { "data-slot": "window-header" },
    { "data-slot": "something-else" },
  );

  expect(merged["data-slot"]).toBe("window-header");
});

test("everything the framework has no opinion about is consumer-owned", () => {
  const ref = { current: null };
  const merged = mergeInfiniteCanvasSlotProps(
    { "data-slot": "window-body" },
    { "aria-describedby": "hint", id: "my-body", ref, tabIndex: 3 },
  );

  expect(merged.id).toBe("my-body");
  expect(merged["aria-describedby"]).toBe("hint");
  expect(merged.tabIndex).toBe(3);
  expect(merged.ref).toBe(ref);
});

test("an undefined consumer prop does not erase the framework's value", () => {
  const merged = mergeInfiniteCanvasSlotProps(
    { className: "framework", tabIndex: -1 },
    { className: undefined, tabIndex: undefined },
  );

  expect(merged.className).toBe("framework");
  expect(merged.tabIndex).toBe(-1);
});

test("a framework handler still runs when the consumer passes none", () => {
  let ran = false;
  const merged = mergeInfiniteCanvasSlotProps(
    {
      onPointerDown: () => {
        ran = true;
      },
    },
    { id: "x" },
  );

  (merged.onPointerDown as (event: unknown) => void)(syntheticEvent());

  expect(ran).toBe(true);
});
