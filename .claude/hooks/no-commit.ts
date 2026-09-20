#!/usr/bin/env node
import { readFileSync } from "node:fs";

const session = "cbfdb7ff-9fc8-4de7-a106-5955358d344e";
const banned =
  /\bgit\s+(commit|merge|rebase|cherry-pick|revert|am|tag|push|stash\s+(save|push|pop|apply))\b/;

const input = (() => {
  try {
    return JSON.parse(readFileSync(0, "utf8")) as {
      session_id?: string;
      tool_input?: { command?: string };
    };
  } catch {
    return {};
  }
})();

const command = input.tool_input?.command ?? "";

if (input.session_id === session && banned.test(command)) {
  console.log(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason:
          "Commits are banned in this session. The manager session owns every commit. Report the work to the manager and leave the changes in the working tree.",
      },
    }),
  );
}
