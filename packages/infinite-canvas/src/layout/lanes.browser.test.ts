import { expect, test } from "vite-plus/test";

test("the test browser has no grid lanes layout yet; when this fails, replace the transcribed lanes oracle with the browser", () => {
  expect([
    CSS.supports("display", "masonry"),
    CSS.supports("display", "grid-lanes"),
    CSS.supports("grid-template-rows", "masonry"),
  ]).toEqual([false, false, false]);
});
