import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

if (execFileSync("git", ["branch", "--show-current"], { encoding: "utf8" }).trim() !== "main") {
  throw new Error("First publication requires the main branch.");
}
if (execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim() !== "") {
  throw new Error("First publication requires a clean worktree.");
}
execFileSync(process.execPath, ["scripts/verify-package.ts"], { stdio: "inherit" });
const manifest = JSON.parse(
  readFileSync(new URL("../packages/infinite-canvas/package.json", import.meta.url), "utf8"),
) as { name: string; version: string };
const published = (() => {
  try {
    execFileSync("npm", ["view", `${manifest.name}@${manifest.version}`, "version"], {
      stdio: "ignore",
    });
    return true;
  } catch {
    return false;
  }
})();

if (!published) {
  try {
    execFileSync("npm", ["whoami"], { stdio: "ignore" });
  } catch {
    execFileSync("npm", ["login"], { stdio: "inherit" });
  }
  execFileSync(
    "pnpm",
    ["--filter", manifest.name, "publish", "--access", "public", "--no-git-checks"],
    { stdio: "inherit" },
  );
}

const trust = execFileSync("npm", ["trust", "list", manifest.name, "--json"], {
  encoding: "utf8",
}).trim();

if (trust === "" || trust === "[]" || trust === "{}" || trust === "null") {
  execFileSync(
    "npm",
    [
      "trust",
      "github",
      manifest.name,
      "--file",
      "release.yml",
      "--repository",
      "tyler-mitchell/infinite-canvas",
      "--environment",
      "publish",
      "--allow-publish",
      "--yes",
    ],
    { stdio: "inherit" },
  );
}

execFileSync("npm", ["trust", "list", manifest.name], { stdio: "inherit" });
