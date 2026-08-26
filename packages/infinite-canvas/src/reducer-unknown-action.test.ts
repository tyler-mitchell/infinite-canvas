import { expect, test } from "vite-plus/test";

import { createInfiniteCanvasState } from "./factory";
import { reduceInfiniteCanvasState } from "./reducer";
import type { InfiniteCanvasAction, InfiniteCanvasState } from "./types";

/**
 * What happens when an action arrives that the reducer has never heard of.
 *
 * The switch is exhaustive and TypeScript enforces it, so this can never happen in typed code — and
 * that is exactly why it went unnoticed. The callers who hit it are the untyped ones: a document
 * replayed from another version of the schema, a consumer not written in TypeScript, an agent or a
 * console driving the canvas through the handle.
 *
 * Before this, such an action fell out of the switch, the reducer returned `undefined`, and the
 * first thing to touch the result read `.groups` off it. The developer got "Cannot read properties
 * of undefined (reading 'groups')" — a field unrelated to the mistake, reported below the layer
 * that made it.
 *
 * The cast is the point of the test rather than a shortcut around it: it is the only way to
 * construct the input, because the input is by definition one the type system rejects.
 */

const STATE: InfiniteCanvasState<"note"> = createInfiniteCanvasState<"note">({
  viewport: { height: 800, width: 1200 },
  windows: [],
});

const unknownAction = (type: string) => ({ type }) as unknown as InfiniteCanvasAction<"note">;

test("an unknown action names itself rather than failing somewhere else", () => {
  expect(() => reduceInfiniteCanvasState(STATE, unknownAction("window.teleport"))).toThrow(
    /window\.teleport/,
  );
});

test("the failure says what kind of thing went wrong", () => {
  expect(() => reduceInfiniteCanvasState(STATE, unknownAction("nonsense"))).toThrow(
    /Unknown infinite canvas action type/,
  );
});

/**
 * The regression this replaces, asserted directly.
 *
 * `groups` was the field the old crash named, and it is nowhere in the actual problem. If the
 * `default` arm is ever removed, the reducer returns `undefined` again and this reads `.groups` off
 * it — so this test fails on the exact message it exists to prevent.
 */
test("the failure does not blame an unrelated field", () => {
  expect(() => reduceInfiniteCanvasState(STATE, unknownAction("nonsense"))).not.toThrow(/groups/);
});

/** A near miss — a real prefix with a wrong verb — is still reported as the whole string given. */
test("a plausible-looking action type is reported verbatim", () => {
  expect(() => reduceInfiniteCanvasState(STATE, unknownAction("view.zoomIn"))).toThrow(
    /view\.zoomIn/,
  );
});

/**
 * The guard has to let real actions through, and "real" is narrower than it looks.
 *
 * `view.zoomBy` is a *command*, not an action — commands reach the reducer wrapped in
 * `command.execute`, which translates them. Writing this test with `view.zoomBy` made it throw,
 * which is correct behaviour and was my own confusion: I had taken a command straight off
 * `getContextualCommands()` and handed it to the reducer. Worth leaving in the record, since that
 * is exactly the mistake the new message now names instead of hiding.
 */
test("a known action still reduces normally", () => {
  const panned = reduceInfiniteCanvasState(STATE, {
    delta: { x: 40, y: 0 },
    type: "camera.panBy",
  });

  expect(panned.camera.center).not.toEqual(STATE.camera.center);
});
