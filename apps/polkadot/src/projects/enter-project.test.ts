import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { expect, test } from "vite-plus/test";

import { getProjectEntryCanvas } from "./enter-project";

/**
 * Going where you already are is not a navigation.
 *
 * The rule "a project is entered through its most recent canvas" was written twice and the copies
 * disagreed. The project switcher returned early when you picked the project you were in; the
 * palette's project rows did not, and `fn::list_canvases` orders by `updated_at` — the last time a
 * canvas was written, not the last time it was seen. So with two projects open and a canvas you had
 * not typed in, choosing your own project in the palette moved you to a different document.
 */

test("entering the project you are already in is not a move", async () => {
  /*
   * Also the proof that the answer costs no query. `operations` reaches the database through a lazy
   * `import("./database.client")`, which pulls an 11 MB WebAssembly engine that has no business
   * loading under a unit test — so if the guard stopped short-circuiting, this would not quietly
   * return the wrong value, it would fail trying to open a database.
   */
  await expect(
    getProjectEntryCanvas({ openProjectId: "project:a", projectId: "project:a" }),
  ).resolves.toBeNull();
});

test("both surfaces ask for the entry canvas rather than working it out again", () => {
  /*
   * The rule's whole failure mode was existing twice, so the regression to guard is a caller going
   * back to listing canvases and picking the first itself. Asserted by name because that is the
   * thing that would be deleted.
   */
  const callers = ["../hud/command-palette.tsx", "../workspace/project-switcher.tsx"];

  for (const caller of callers) {
    const source = readFileSync(fileURLToPath(new URL(caller, import.meta.url)), "utf8");

    expect(source, `${caller} no longer asks where a project opens`).toContain(
      "getProjectEntryCanvas",
    );
  }
});
