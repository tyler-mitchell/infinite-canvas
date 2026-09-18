import { expect, test } from "vite-plus/test";
import * as api from "./index";

// What vite/client declares. This package does not depend on vite, and the call has to appear
// literally for Vite to replace it, so a cast at the call site would break the transform.
declare global {
  interface ImportMeta {
    glob: (
      pattern: string,
      options: { query: string; import: string; eager: true },
    ) => Record<string, string>;
  }
}

const suites = import.meta.glob("./*.test.ts", {
  query: "?raw",
  import: "default",
  eager: true,
});

const body = Object.entries(suites)
  .filter(([path]) => !path.endsWith("export-coverage.test.ts"))
  .map(([, source]) => source)
  .join("\n");

test("every runtime export is named by a test, so none ships unexercised", () => {
  expect(Object.keys(suites).length).toBeGreaterThan(10);
  const names = Object.keys(api);
  expect(names.length).toBeGreaterThan(50);

  const unnamed = names.filter((name) => !new RegExp(`\\b${name}\\b`).test(body));
  expect(unnamed).toEqual([]);
});
