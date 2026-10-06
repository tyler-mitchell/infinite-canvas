import { expect, test } from "vite-plus/test";
import { timelineDuration } from "./timeline";

test("timeline duration includes overlapping effects in any order", () => {
  expect(
    timelineDuration([
      { at: 4, duration: 0.5 },
      { at: 1, duration: 5 },
      { at: 2, duration: 1 },
    ]),
  ).toBe(6);
  expect(timelineDuration([])).toBe(0);
});
