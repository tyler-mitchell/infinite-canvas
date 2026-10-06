import { expect, test } from "vite-plus/test";

import { getNextSpoke } from "./radial-menu";

const items = [false, true, false, true, false].map((isEnabled) => ({ isEnabled }));

test.each(["ArrowDown", "ArrowRight"])("%s skips disabled actions and wraps forward", (key) => {
  expect(getNextSpoke(key, 1, items)).toBe(3);
  expect(getNextSpoke(key, 3, items)).toBe(1);
});

test.each(["ArrowUp", "ArrowLeft"])("%s skips disabled actions and wraps backward", (key) => {
  expect(getNextSpoke(key, 3, items)).toBe(1);
  expect(getNextSpoke(key, 1, items)).toBe(3);
});

test("Home and End select enabled actions at the boundaries", () => {
  expect(getNextSpoke("Home", 3, items)).toBe(1);
  expect(getNextSpoke("End", 1, items)).toBe(3);
  expect(getNextSpoke("Escape", 1, items)).toBeNull();
});

test.each(["ArrowDown", "ArrowRight", "ArrowUp", "ArrowLeft", "Home", "End"])(
  "%s has no target without enabled actions",
  (key) => {
    expect(getNextSpoke(key, 0, [])).toBeNull();
    expect(getNextSpoke(key, 0, [{ isEnabled: false }])).toBeNull();
  },
);
