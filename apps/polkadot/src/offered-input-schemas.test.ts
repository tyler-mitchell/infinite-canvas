import { expect, test } from "vite-plus/test";

import { APP_ACTIONS } from "./app-actions";

/**
 * A verb taking an argument must advertise a schema a caller can fill in. An empty one still
 * registers, still validates, and refuses every call for a field it never named.
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
  // Guards the filter. The argument-less bulk of the vocabulary is the framework's, not this app's.
  expect(offered.length).toBeGreaterThan(APP_ACTIONS.length / 2);
});

test("every argument-taking verb advertises at least one property", () => {
  const advertisingNothing = offered
    .filter((entry) => Object.keys(entry.schema.properties ?? {}).length === 0)
    .map((entry) => entry.id);

  expect(advertisingNothing).toStrictEqual([]);
});

test("an advertised schema says which properties are required", () => {
  // Properties with nothing required tells a caller every field is optional; the verb then refuses.
  const allOptional = offered
    .filter((entry) => (entry.schema.required ?? []).length === 0)
    .map((entry) => entry.id)
    .sort();

  // The four that make a named thing and name their own fallback, so an empty call is a real one.
  // `view.save` joins them by the same rule: the framing is read from the camera, never passed in,
  // so the only argument it could take is the name it already numbers for you.
  expect(allOptional).toStrictEqual([
    "canvas.create",
    "project.create",
    "view.save",
    "workspace.create",
  ]);
});
