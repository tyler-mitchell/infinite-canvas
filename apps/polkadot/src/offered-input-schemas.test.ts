import { expect, test } from "vite-plus/test";

import { APP_ACTIONS } from "./app-actions";

/**
 * A verb that takes an argument offers a schema a caller can actually fill in.
 *
 * `model-context.tsx` registers `action.input?.toJsonSchema()` as the tool's `inputSchema`, on the
 * stated ground that "what a caller is offered and what the verb accepts are one thing rather than
 * two that have to be kept in step". That holds only while `toJsonSchema()` returns something
 * describing the argument. If it ever returned an empty object — an ArkType shape it cannot express,
 * a type built from a morph — the verb would still be offered, a caller would send `{}`, and the
 * verb would refuse every call for a field it never advertised.
 *
 * Nothing would error. The tool is registered, the schema is valid JSON Schema, and the refusal
 * string is correct; the only symptom is a verb nobody can successfully call.
 *
 * The count these assertions imply is deliberately not written down. `ROADMAP.md` carried "108
 * tools" long enough for it to become 112, and a number asserted in one place and prose in another
 * drifts the same way descriptions did.
 */

/**
 * Paired with its schema once, so no assertion below has to re-derive it through an optional chain
 * whose `undefined` branch is unreachable but not provably so.
 */
const offered = APP_ACTIONS.flatMap((action) =>
  action.input === undefined
    ? []
    : [
        {
          id: action.id,
          schema: action.input.toJsonSchema() as Readonly<{
            properties?: object;
            required?: readonly string[];
          }>,
        },
      ],
);

test("most of this app's own verbs take an argument", () => {
  /*
   * Guards the filter, and records which way round it is. The argument-less bulk of the WebMCP
   * vocabulary is the *framework's* — those verbs act on the active window or the camera and need
   * nothing. What this app adds is mostly the opposite: a note, an item, a canvas, a project or a
   * group named by id, which is why `input` is the common case here and the rare one there.
   */
  expect(offered.length).toBeGreaterThan(APP_ACTIONS.length / 2);
});

test("every argument-taking verb advertises at least one property", () => {
  const advertisingNothing = offered
    .filter((entry) => Object.keys(entry.schema.properties ?? {}).length === 0)
    .map((entry) => entry.id);

  expect(advertisingNothing).toStrictEqual([]);
});

test("an advertised schema says which properties are required", () => {
  /*
   * A schema listing properties and requiring none tells a caller every field is optional, and the
   * verb then refuses for a missing one.
   */
  const allOptional = offered
    .filter((entry) => (entry.schema.required ?? []).length === 0)
    .map((entry) => entry.id)
    .sort();

  // Exactly the three that make a new named thing. Each names what it falls back to when no title
  // arrives, so an empty call is a real call rather than a refusal waiting to happen — which is
  // what makes them the only defensible members of this list.
  expect(allOptional).toStrictEqual(["canvas.create", "project.create", "workspace.create"]);
});
