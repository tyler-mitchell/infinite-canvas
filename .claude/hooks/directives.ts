#!/usr/bin/env node
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const interval = 15 * 60 * 1000;
const stamp = join(tmpdir(), "infinite-canvas-directives.stamp");
const last = existsSync(stamp) ? statSync(stamp).mtimeMs : 0;

const read = (name: string) => {
  const file = new URL(name, import.meta.url);
  return existsSync(file) ? readFileSync(file, "utf8") : "";
};

if (Date.now() - last >= interval) {
  writeFileSync(stamp, "");
  console.log(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        additionalContext: [read("directives.md"), read("session.md")].join("\n\n"),
      },
    }),
  );
}
