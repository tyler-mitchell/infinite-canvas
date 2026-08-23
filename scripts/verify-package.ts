import { execFile } from "node:child_process";
import { copyFile, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const run = promisify(execFile);
const workspace = fileURLToPath(new URL("..", import.meta.url));
const manifest = JSON.parse(
  await readFile(new URL("../packages/infinite-canvas/package.json", import.meta.url), "utf8"),
) as { name: string; repository?: string | { url?: string }; scripts?: { prepack?: string } };
const repository =
  typeof manifest.repository === "string" ? manifest.repository : manifest.repository?.url;

if (manifest.name !== "@hyphened/infinite-canvas") throw new Error("Package name mismatch.");
if (!repository?.includes("tyler-mitchell/infinite-canvas")) {
  throw new Error("repository.url mismatch.");
}
if (!manifest.scripts?.prepack) throw new Error("scripts.prepack is required.");

const directory = await mkdtemp(join(tmpdir(), "infinite-canvas-preflight-"));
const tarball = join(directory, "package.tgz");
try {
  await run("pnpm", ["--filter", manifest.name, "pack", "--out", tarball], { cwd: workspace });
  await writeFile(
    join(directory, "package.json"),
    `${JSON.stringify({ name: "infinite-canvas-preflight", private: true, type: "module" })}\n`,
  );
  await run("npm", ["install", tarball, "--no-audit", "--no-fund"], { cwd: directory });
  await copyFile(new URL("./verify-published.mjs", import.meta.url), join(directory, "probe.mjs"));
  await run(process.execPath, ["probe.mjs"], { cwd: directory });
} finally {
  await rm(directory, { recursive: true, force: true });
}
