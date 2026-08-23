import { execFileSync } from "node:child_process";

execFileSync(process.execPath, ["scripts/validate-package-contract.ts"], { stdio: "inherit" });
execFileSync("npm", ["login"], { stdio: "inherit" });
execFileSync(
  "pnpm",
  ["--filter", "@hyphened/infinite-canvas", "publish", "--access", "public", "--no-git-checks"],
  { stdio: "inherit" },
);
execFileSync(
  "npm",
  [
    "trust",
    "github",
    "@hyphened/infinite-canvas",
    "--file",
    "release.yml",
    "--repository",
    "tyler-mitchell/infinite-canvas",
    "--allow-publish",
    "--yes",
  ],
  { stdio: "inherit" },
);
