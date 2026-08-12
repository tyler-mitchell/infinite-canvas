import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test } from "vite-plus/test";

/**
 * One dispatcher for interaction steps, enforced rather than asserted in prose.
 *
 * The lesson is already in the friction backlog: *an interaction step carrying a modifier
 * must be dispatched from exactly one place — two dispatchers with different knowledge of
 * the same event is a race, and the one that knows less wins whenever it runs last.* The
 * fix that lesson produced removed the canvas root's handler and wrote a comment in
 * `infinite-canvas.tsx` saying the mount-scoped `window` listener was now "the single
 * source for interaction steps".
 *
 * It was not. Four React `onPointerMove` handlers survived — the window header, the window
 * resize handle, the group resize handle, and the group gutter — so every pointermove
 * during a drag dispatched `interaction.step` twice, on the hottest path in the
 * application. Three of the four omitted `dockIntent` entirely, which is the same race the
 * lesson describes, still loaded.
 *
 * Removing them is safe for a reason worth writing down: the duplicate firing *is* the
 * proof that the window listener already sees these events. `setPointerCapture` retargets
 * subsequent events to the capturing element, and those events still bubble to the document
 * and its `defaultView`. And the two coordinate conversions are the same conversion —
 * `getEventViewportPoint` resolves `closest("[data-infinite-canvas-viewport='true']")`,
 * which is the `<section>` that `rootRef` points at, so both produce a point in that
 * element's space.
 *
 * A comment could not keep this true; it had already failed to. This can.
 */

const sourceDirectory = dirname(fileURLToPath(import.meta.url));

/** The one module allowed to dispatch an interaction step. */
const SINGLE_DISPATCHER = "infinite-canvas.tsx";

/**
 * Not callers. `store.tsx` defines the facade method being called, and `types.ts` declares
 * its signature — naming a verb is not dispatching it.
 */
const DECLARATION_SITES = new Set(["store.tsx", "types.ts"]);

test("only the mount-scoped listener dispatches interaction steps", () => {
  const offenders = readdirSync(sourceDirectory)
    .filter(
      (file) =>
        (file.endsWith(".ts") || file.endsWith(".tsx")) &&
        !file.includes(".test.") &&
        file !== SINGLE_DISPATCHER &&
        !DECLARATION_SITES.has(file),
    )
    .filter((file) =>
      readFileSync(join(sourceDirectory, file), "utf8").includes("stepInteraction"),
    );

  expect(
    offenders,
    "A second dispatcher for interaction.step reintroduces the modifier race the friction " +
      "backlog already recorded: whichever handler runs last wins, and a handler that does " +
      "not read event.altKey wipes the dock preview the one that does just resolved. Route " +
      "the step through the mount-scoped window listener in infinite-canvas.tsx instead.",
  ).toEqual([]);
});

test("the one dispatcher carries the modifier", () => {
  // A single dispatcher that dropped `dockIntent` would satisfy the test above and lose
  // Alt+drag docking entirely, which is the failure the original lesson was about.
  const source = readFileSync(join(sourceDirectory, SINGLE_DISPATCHER), "utf8");

  expect(source).toContain("dockIntent: event.altKey");
});
