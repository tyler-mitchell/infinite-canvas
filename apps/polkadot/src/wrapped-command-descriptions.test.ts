import { DEFAULT_INFINITE_CANVAS_COMMAND_DESCRIPTORS } from "@hyphened/infinite-canvas";
import { expect, test } from "vite-plus/test";

import { APP_ACTIONS } from "./app-actions";

/**
 * A verb this app re-declares says what the framework says it does.
 *
 * Five framework descriptors are templates carrying an empty-string id, so `published-commands`
 * holds them back and each is re-declared as an `AppAction` with an `input`. Both layers then
 * describe one verb, and the copy is what a WebMCP caller actually reads — so when the two
 * disagree, the framework's sentence is the one nobody sees.
 *
 * That is not hypothetical. `workspace.moveActiveWindow` read "Move the active window to a
 * desktop." here while the framework's had grown "leaving the one it is on. A docked window takes
 * its whole group with it" — the caller-visible sentence was missing the only surprising part of
 * the verb.
 *
 * The rule is prefix rather than equality: the wrapper adds what its argument needs, which the
 * framework has no way to know.
 */

// Keyed by plain string, because an `AppAction` id is one — the framework's narrow union is what
// the lookup is being asked about, not what it is being given.
const FRAMEWORK_DESCRIPTIONS = new Map<string, string>(
  DEFAULT_INFINITE_CANVAS_COMMAND_DESCRIPTORS.map((descriptor) => [
    descriptor.id,
    descriptor.description,
  ]),
);

/**
 * Sharing an id is not being the same verb.
 *
 * The framework's `group.dissolve` breaks up the group holding the *active window* and takes no
 * argument; this app's dissolves whichever group an id names. Quoting the framework's sentence
 * there composes one that contradicts itself, so this id is held out — named rather than filtered
 * by a rule, because the next id that collides deserves the same deliberate look.
 */
const COLLIDING_IDS = new Set(["group.dissolve"]);

const findAction = (id: string) => APP_ACTIONS.find((action) => action.id === id);

const wrappedActions = APP_ACTIONS.filter(
  (action) => FRAMEWORK_DESCRIPTIONS.has(action.id) && !COLLIDING_IDS.has(action.id),
);

test("this app re-declares the framework verbs that take an argument", () => {
  // Guards the test itself. A filter that matched nothing would let every assertion below pass
  // while checking nothing at all.
  expect(wrappedActions.map((action) => action.id).sort()).toEqual([
    "window.reveal",
    "workspace.close",
    "workspace.create",
    "workspace.enter",
    "workspace.moveActiveWindow",
  ]);
});

test("a re-declared verb opens with the framework's own sentence", () => {
  for (const action of wrappedActions) {
    const framework = FRAMEWORK_DESCRIPTIONS.get(action.id) ?? "";

    expect(framework).not.toBe("");
    expect(action.description.startsWith(framework)).toBe(true);
  }
});

test("what a re-declared verb adds is about its argument, not about the verb", () => {
  for (const action of wrappedActions) {
    const added = action.description.slice((FRAMEWORK_DESCRIPTIONS.get(action.id) ?? "").length);

    // Something is added — the framework cannot know where an id comes from — and it reads as a
    // separate sentence rather than running on from the framework's.
    expect(added.startsWith(" ")).toBe(true);
    expect(added.trim().length).toBeGreaterThan(0);
  }
});

test("a verb that only shares an id with a framework command keeps its own sentence", () => {
  /*
   * The distinction this file exists to keep straight, asserted so it survives the next agent who
   * notices `group.dissolve` in both layers and "fixes" the inconsistency. Composing here produced
   * "Break up the group holding the active window... The id comes from `canvas.describe`.", which
   * tells a caller two incompatible things about what it acts on.
   */
  const dissolve = findAction("group.dissolve");

  expect(dissolve).toBeDefined();
  expect(FRAMEWORK_DESCRIPTIONS.has("group.dissolve")).toBe(true);
  expect(dissolve?.description.startsWith(FRAMEWORK_DESCRIPTIONS.get("group.dissolve") ?? "")).toBe(
    false,
  );
  // And it is genuinely id-taking, which is what makes it a different verb rather than a copy.
  expect(dissolve?.input).toBeDefined();
});
