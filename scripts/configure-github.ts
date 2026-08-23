import { execFileSync } from "node:child_process";

const token = execFileSync("gh", ["auth", "token"], { encoding: "utf8" }).trim();
execFileSync("gh", ["secret", "set", "BUMPY_GH_TOKEN", "--body", token], {
  stdio: "inherit",
});
