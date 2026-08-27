import { expect, test } from "vite-plus/test";

import { withNamingLock } from "./naming-lock";
import { getNextNumberedTitle } from "./titles";

/**
 * Two creations cannot choose the same default name.
 *
 * The defect this pins was observed rather than imagined: two notes made in quick succession left
 * the library reading "Untitled 2", "Untitled 2", "Untitled 1". Both creations read the same list
 * before either had written, so both computed the same next name.
 *
 * The fixture below is the shape of the real bug rather than a mock of it — `store` stands in for
 * the project's titles, `create` does the same read-compute-write `openNewNote` does, and the awaits
 * are where the database round trips are. Run the two concurrently without the lock and they
 * collide; that is asserted, so the guard cannot pass by testing nothing.
 */

/** The read-compute-write that every default-named creator performs. */
const makeCreator = (store: string[]) => async () => {
  const seen = [...store];

  // The gap. In the app this is `noteGateway.list` resolving before `content.create` is called.
  await Promise.resolve();

  const title = getNextNumberedTitle("Untitled", seen);

  await Promise.resolve();
  store.push(title);

  return title;
};

test("the race is real, which is what makes the lock worth having", async () => {
  /*
   * Asserting the bug against an unlocked creator, so this file cannot quietly become a test of
   * nothing if the lock is removed from the callers. Two overlapping creations, one name.
   */
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
  // An agent firing `note.create` repeatedly is the case that found this, and it is not two.
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
  // What `AsyncQueuer` could not give: every caller here awaits creation, so the value has to
  // arrive at the caller rather than through a callback.
  await expect(withNamingLock(async () => "the result")).resolves.toBe("the result");
});

test("one failure does not poison the creations after it", async () => {
  /*
   * The chain swallows rejections for itself only. Without that, a single failed create would
   * leave `tail` rejected and every later creation would reject for a reason that had nothing to
   * do with it — turning a transient database error into a permanently broken button.
   */
  const store: string[] = [];
  const create = makeCreator(store);
  const failed = withNamingLock(async () => {
    throw new Error("write failed");
  });

  await expect(failed).rejects.toThrow("write failed");
  await expect(withNamingLock(create)).resolves.toBe("Untitled 1");
});

test("a creation that never settles does not hold every later one behind it", async () => {
  /*
   * The regression the lock itself introduced, and the reason for the timeout.
   *
   * Unchained, a hung create costs one dead click. Chained without a bound, it holds the tail
   * forever and the button is dead for the rest of the session. A short timeout is passed here so
   * the test measures the mechanism rather than waiting ten seconds for it.
   */
  const store: string[] = [];
  const create = makeCreator(store);

  // Never resolves. Its own caller is left waiting, correctly — it genuinely did not finish.
  void withNamingLock(() => new Promise<string>(() => undefined), 20);

  await expect(withNamingLock(create, 20)).resolves.toBe("Untitled 1");
});

test("the stalled caller is still waiting, because its work really did not finish", async () => {
  // The other half: the chain gives up, the caller does not get a fabricated answer.
  let settled = false;
  const stalled = withNamingLock(() => new Promise<string>(() => undefined), 20);

  void stalled.then(() => {
    settled = true;
  });
  await withNamingLock(async () => "moved on", 20);

  expect(settled).toBe(false);
});

test("a rejection reaches its own caller rather than being swallowed", async () => {
  // The other half: silencing the chain must not silence the person who asked.
  await expect(
    withNamingLock(async () => {
      throw new Error("still mine");
    }),
  ).rejects.toThrow("still mine");
});
