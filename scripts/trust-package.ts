import { execFileSync } from "node:child_process";

execFileSync("npm", ["login"], { stdio: "inherit" });
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
