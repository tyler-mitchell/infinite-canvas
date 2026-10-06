import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { expect, test } from "vite-plus/test";

const source = readFileSync(fileURLToPath(new URL("index.tsx", import.meta.url)), "utf8");

const asClause = (message: string) => message.replace(/[\s.!?]+$/u, "");
const detail = (message: string) => `${asClause(message)}. Your work is stored in this browser`;

test("a message that ends its own sentence does not double the period", () => {
  expect(detail("Failed to open indxdb://polkadot: connection refused.")).toContain(
    "connection refused. Your work",
  );
  expect(detail("Something broke.")).not.toContain("..");
});

test("a message written to be continued is left exactly as it is", () => {
  const written = "The local workspace did not respond within 10 seconds";

  expect(detail(written)).toContain("within 10 seconds. Your work");
  expect(asClause(written)).toBe(written);
});

test("only terminal punctuation goes, and only from the end", () => {
  expect(asClause("Missing SurQL manifest entry: functions/002_content.surql")).toBe(
    "Missing SurQL manifest entry: functions/002_content.surql",
  );
  expect(asClause("Engine 1.2.3 refused")).toBe("Engine 1.2.3 refused");
  expect(asClause("Trailing whitespace then a stop .  ")).toBe("Trailing whitespace then a stop");
});

test("the route composes through the trim rather than interpolating raw", () => {
  expect(source).toContain("asClause(error.message)");
  expect(source).not.toContain("${error.message}.");
});
