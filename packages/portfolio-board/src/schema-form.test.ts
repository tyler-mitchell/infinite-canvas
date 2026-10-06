import { createHeadlessForm } from "@remoteoss/json-schema-form";
import { type } from "arktype";
import { expect, test } from "vite-plus/test";

test("an array of objects lists its item fields under their own names", () => {
  const schema = type({
    "breakpoints?": type({ minWidth: "number >= 0", columns: "number.integer > 0" }).array(),
  });
  const json = schema.toJsonSchema({
    dialect: null,
    fallback: { predicate: (context) => context.base },
  });
  const [breakpoints] = createHeadlessForm(
    json as never,
    {
      initialValues: { breakpoints: [{ minWidth: 640, columns: 12 }] },
    } as never,
  ).fields;
  expect(breakpoints?.inputType).toBe("group-array");
  expect(breakpoints?.fields?.map((child) => child.name)).toEqual(["columns", "minWidth"]);
});
