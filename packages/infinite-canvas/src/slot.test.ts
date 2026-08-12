import { expect, test } from "vite-plus/test";

import { mergeInfiniteCanvasSlotProps } from "./slot";

/**
 * The merge rules are the whole contract. A slot that let consumer props win outright would
 * silently disable window dragging the first time someone passed `onPointerDown`; one that let
 * framework props win would be an escape hatch that escapes nothing.
 *
 * Semantics are Base UI's `mergeProps`, transplanted — see `slot.ts` for why they are copied
 * rather than imported, and for the rule this file's first draft got backwards.
 */

/** A stand-in for a React synthetic event: the `nativeEvent` field is what marks it as one. */
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
  // The regression that would be invisible in review: passing onPointerDown to a header and
  // discovering later that windows no longer drag.
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
  // Deliberately not `preventDefault`, which means "skip the browser's default" and would
  // conflate two different intentions.
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
  // Overriding one declaration must not discard the geometry the framework computed.
  expect(merged.style).toEqual({ color: "blue", position: "absolute" });
});

test("data-slot is framework-owned and survives a consumer trying to set it", () => {
  // It is the styling contract's only anchor; losing it detaches the stylesheet from the element
  // while everything still looks wired.
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
