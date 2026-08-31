import { expect, test } from "vite-plus/test";

import { withNamingLock } from "./naming-lock";
import { getNextNumberedTitle } from "./titles";

const makeCreator = (store: string[]) => async () => {
  const seen = [...store];

  await Promise.resolve();

  const title = getNextNumberedTitle("Untitled", seen);

  await Promise.resolve();
  store.push(title);

  return title;
};

test("the race is real, which is what makes the lock worth having", async () => {
  const store: string[] = [];
  const create = makeCreator(store);
  const both = await Promise.all([create(), create()]);

  expect(both).toStrictEqual(["Untitled 1", "Untitled 1"]);
});

test("under the lock, concurrent creations take consecutive names", async () => {
  const store: string[] = [];
  const create = makeCreator(store);
  const both = await Promise.all([withNamingLock(create), withNamingLock(create)]);

  expect(both).toStrictEqual(["Untitled 1", "Untitled 2"]);
  expect(store).toStrictEqual(["Untitled 1", "Untitled 2"]);
});

test("a burst takes every name once, in order", async () => {
  const store: string[] = [];
  const create = makeCreator(store);
  const names = await Promise.all(Array.from({ length: 6 }, () => withNamingLock(create)));

  expect(names).toStrictEqual([
    "Untitled 1",
    "Untitled 2",
    "Untitled 3",
    "Untitled 4",
    "Untitled 5",
    "Untitled 6",
  ]);
  expect(new Set(names).size).toBe(6);
});

test("the caller gets its own promise back, not the queue's", async () => {
  await expect(withNamingLock(async () => "the result")).resolves.toBe("the result");
});

test("one failure does not poison the creations after it", async () => {
  const store: string[] = [];
  const create = makeCreator(store);
  const failed = withNamingLock(async () => {
    throw new Error("write failed");
  });

  await expect(failed).rejects.toThrow("write failed");
  await expect(withNamingLock(create)).resolves.toBe("Untitled 1");
});

test("a creation that never settles does not hold every later one behind it", async () => {
  const store: string[] = [];
  const create = makeCreator(store);

  void withNamingLock(() => new Promise<string>(() => undefined), 20);

  await expect(withNamingLock(create, 20)).resolves.toBe("Untitled 1");
});

test("the stalled caller is still waiting, because its work really did not finish", async () => {
  let settled = false;
  const stalled = withNamingLock(() => new Promise<string>(() => undefined), 20);

  void stalled.then(() => {
    settled = true;
  });
  await withNamingLock(async () => "moved on", 20);

  expect(settled).toBe(false);
});

test("a rejection reaches its own caller rather than being swallowed", async () => {
  await expect(
    withNamingLock(async () => {
      throw new Error("still mine");
    }),
  ).rejects.toThrow("still mine");
});
