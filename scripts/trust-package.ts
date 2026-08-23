import { execFileSync } from "node:child_process";

try {
  execFileSync("npm", ["whoami"], { stdio: "ignore" });
} catch {
  execFileSync("npm", ["login"], { stdio: "inherit" });
}

const trust = execFileSync("npm", ["trust", "list", "@hyphened/infinite-canvas", "--json"], {
  encoding: "utf8",
}).trim();

if (trust === "" || trust === "[]" || trust === "{}" || trust === "null") {
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
      "--environment",
      "publish",
      "--allow-publish",
      "--yes",
    ],
    { stdio: "inherit" },
  );
}

execFileSync("npm", ["trust", "list", "@hyphened/infinite-canvas"], { stdio: "inherit" });
