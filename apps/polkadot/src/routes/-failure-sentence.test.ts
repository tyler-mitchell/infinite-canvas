import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { expect, test } from "vite-plus/test";

/**
 * `RootFailure` continues the error's message rather than printing it alone, so a message that
 * ends its own sentence would produce a doubled period. Three of the five errors reaching this
 * screen end in `getErrorMessage(error)`, which is the driver's wording, not this repo's — so the
 * route trims terminal punctuation instead of asking throwers to omit it.
 *
 * Named with a leading `-` so the router does not treat it as a route.
 */

const source = readFileSync(fileURLToPath(new URL("index.tsx", import.meta.url)), "utf8");

/** Copies the route's composition, since `asClause` is local to that module. */
const asClause = (message: string) => message.replace(/[\s.!?]+$/u, "");
const detail = (message: string) => `${asClause(message)}. Your work is stored in this browser`;

test("a message that ends its own sentence does not double the period", () => {
  // The shape a driver produces. `getErrorMessage` passes it through unchanged.
  expect(detail("Failed to open indxdb://polkadot: connection refused.")).toContain(
    "connection refused. Your work",
  );
  expect(detail("Something broke.")).not.toContain("..");
});

test("a message written to be continued is left exactly as it is", () => {
  // The shape this repo's own errors take, including `LocalDatabaseUnavailableError`.
  const written = "The local workspace did not respond within 10 seconds";

  expect(detail(written)).toContain("within 10 seconds. Your work");
  expect(asClause(written)).toBe(written);
});

test("only terminal punctuation goes, and only from the end", () => {
  // A message naming a file or a version keeps its dots.
  expect(asClause("Missing SurQL manifest entry: functions/002_content.surql")).toBe(
    "Missing SurQL manifest entry: functions/002_content.surql",
  );
  expect(asClause("Engine 1.2.3 refused")).toBe("Engine 1.2.3 refused");
  expect(asClause("Trailing whitespace then a stop .  ")).toBe("Trailing whitespace then a stop");
});

test("the route composes through the trim rather than interpolating raw", () => {
  // `asClause` above is a copy, so it would keep passing if the route reverted. This reads the
  // route source to confirm it still calls it.
  expect(source).toContain("asClause(error.message)");
  expect(source).not.toContain("${error.message}.");
});
