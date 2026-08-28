import { expect, test } from "vite-plus/test";

import { getLoadedRelations, relations$ } from "./relation-store";

/**
 * "Nobody has asked yet" is not "there are none", for edges as well as for items.
 *
 * `relations$` is an array and starts empty, so those two facts share one value. That is the right
 * answer for a reader that draws — a connector layer showing nothing for a frame is corrected by
 * the next one — and wrong the moment something turns it into a sentence. `describeProjectContent`
 * said "No connections." to a caller that cannot see the screen and has no next frame, and
 * `loadRelations` runs from an effect that nothing awaits, so asking straight after opening a
 * project lands inside that window.
 *
 * `project-content` draws the same distinction with a nullable observable. Doing that here would
 * mean changing twelve readers, eleven of which are drawing or resolving a click and want the
 * interim empty. So the store answers the extra question instead of changing its shape.
 *
 * **The half this cannot reach.** Whether the flag flips when a query lands needs `loadRelations`,
 * which needs the database, and the WASM engine does not start under `vp test` —
 * `in-memory-engine.test.ts` records that as a skip. What is pinned here is the initial answer and
 * that it is keyed to the project.
 */

test("before anything has asked, the answer is null rather than no connections", () => {
  expect(getLoadedRelations("project:anything")).toBeNull();
});

test("a project nobody asked about is null even while another project's edges are held", () => {
  /*
   * The guard that matters on navigation: `relations$` still holds the previous project's array
   * until the new query lands, and a reporter asking about the new one must not be handed it.
   */
  relations$.set([]);

  expect(getLoadedRelations("project:other")).toBeNull();
});
