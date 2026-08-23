import { existsSync, readFileSync } from "node:fs";

const manifest = JSON.parse(readFileSync("packages/infinite-canvas/package.json", "utf8")) as {
  name?: string;
  repository?: string | { url?: string };
  scripts?: { prepack?: string };
};
const repository =
  typeof manifest.repository === "string" ? manifest.repository : manifest.repository?.url;

if (manifest.name !== "@hyphened/infinite-canvas") throw new Error("Package name mismatch.");
if (!repository?.includes("tyler-mitchell/infinite-canvas")) {
  throw new Error("repository.url mismatch.");
}
if (!manifest.scripts?.prepack) throw new Error("scripts.prepack is required.");
if (!existsSync("scripts/verify-published.mjs")) throw new Error("Published probe is required.");
