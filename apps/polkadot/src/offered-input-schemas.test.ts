import { expect, test } from "vite-plus/test";

import { APP_ACTIONS } from "./app-actions";

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
  expect(offered.length).toBeGreaterThan(APP_ACTIONS.length / 2);
});

test("every argument-taking verb advertises at least one property", () => {
  const advertisingNothing = offered
    .filter((entry) => Object.keys(entry.schema.properties ?? {}).length === 0)
    .map((entry) => entry.id);

  expect(advertisingNothing).toStrictEqual([]);
});

test("an advertised schema says which properties are required", () => {
  const allOptional = offered
    .filter((entry) => (entry.schema.required ?? []).length === 0)
    .map((entry) => entry.id)
    .sort();

  expect(allOptional).toStrictEqual([
    "canvas.create",
    "project.create",
    "view.save",
    "workspace.create",
  ]);
});
