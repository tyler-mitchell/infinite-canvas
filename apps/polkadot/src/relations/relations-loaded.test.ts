import { expect, test } from "vite-plus/test";

import { getLoadedRelations, relations$ } from "./relation-store";

test("before anything has asked, the answer is null rather than no connections", () => {
  expect(getLoadedRelations("project:anything")).toBeNull();
});

test("a project nobody asked about is null even while another project's edges are held", () => {
  relations$.set([]);

  expect(getLoadedRelations("project:other")).toBeNull();
});
