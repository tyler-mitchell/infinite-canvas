import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { expect, test } from "vite-plus/test";

/**
 * The failure screen reads as one sentence, whoever wrote the first half.
 *
 * `RootFailure` continues the error's message — "…did not respond within 10 seconds" becomes
 * "…10 seconds. Your work is stored in this browser…" — so the message must not end its own
 * sentence. `database.client.ts` asks its throwers for that in a docstring, and it is the right
 * rule asked of the wrong people: three of the five errors reaching this screen end in
 * `getErrorMessage(error)`, which is the SurrealDB driver's words. Nobody here writes those, and a
 * driver that punctuates produced a doubled period on the one screen a person sees when the app
 * will not open.
 *
 * A cosmetic defect, and worth a test for where it appears rather than for what it costs: the
 * failure screen is the surface nobody looks at until it is the only thing on screen.
 */

const source = readFileSync(fileURLToPath(new URL("index.tsx", import.meta.url)), "utf8");

/** The composition itself, since `asClause` is local to the route module. */
const asClause = (message: string) => message.replace(/[\s.!?]+$/u, "");
const detail = (message: string) => `${asClause(message)}. Your work is stored in this browser`;

test("a message that ends its own sentence does not double the period", () => {
  // The shape a driver produces. `getErrorMessage` passes it through untouched, by design.
  expect(detail("Failed to open indxdb://polkadot: connection refused.")).toContain(
    "connection refused. Your work",
  );
  expect(detail("Something broke.")).not.toContain("..");
});

test("a message written to be continued is left exactly as it is", () => {
  // What this repo's own errors look like — `LocalDatabaseUnavailableError` among them.
  const written = "The local workspace did not respond within 10 seconds";

  expect(detail(written)).toContain("within 10 seconds. Your work");
  expect(asClause(written)).toBe(written);
});

test("only terminal punctuation goes, and only from the end", () => {
  // A message naming a file or a version must keep its dots.
  expect(asClause("Missing SurQL manifest entry: functions/002_content.surql")).toBe(
    "Missing SurQL manifest entry: functions/002_content.surql",
  );
  expect(asClause("Engine 1.2.3 refused")).toBe("Engine 1.2.3 refused");
  expect(asClause("Trailing whitespace then a stop .  ")).toBe("Trailing whitespace then a stop");
});

test("the route still composes through the trim rather than interpolating raw", () => {
  /*
   * Guards the guard: the rule above is a copy of the route's expression, so it would keep passing
   * if the route went back to `${error.message}.`. This asserts the route actually calls it.
   */
  expect(source).toContain("asClause(error.message)");
  expect(source).not.toContain("${error.message}.");
});
