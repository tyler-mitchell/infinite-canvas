/**
 * Comment gate: no new comment over the limit `AGENTS.md` sets.
 *
 * **This exists because the prose rule provably does not work.** The global instructions have
 * carried a comment-brevity rule the whole time, in its strongest wording — "caveman prose", "no
 * novel, no essay", ALL-CAPS — and this codebase filled with fifteen-sentence docstrings anyway,
 * written by the agent reading that rule. Rewording it a fourth time would change nothing. A gate
 * is the only instruction in this repository that has never been argued past.
 *
 * **A ratchet, not a cleanup.** Every existing long comment is recorded in `comment-budget.json`
 * as a per-file count. The gate fails when a file's count *rises*, so the standing debt does not
 * block a commit and no new debt can be added beside it. Per file rather than a total, so adding
 * one here and deleting one there does not net out to "unchanged".
 *
 * Re-baseline with `--update` after a real comment pass, which is what drives the numbers down.
 *
 * Reads source, needs no build, resolves its own paths.
 *
 * Run: node ./scripts/verify-comment-budget.mjs [--update]
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const baselinePath = join(repoRoot, "scripts", "comment-budget.json");

/** `AGENTS.md`: "NO NEW COMMENTS greater than 100 characters are allowed." */
const LIMIT = 100;

const SCAN_ROOTS = ["apps", "packages"];
const SKIP_DIRECTORIES = new Set(["node_modules", "dist", "build", ".vite", "coverage"]);

const listSourceFiles = (directory) => {
  const found = [];

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);

    if (entry.isDirectory()) {
      if (!SKIP_DIRECTORIES.has(entry.name)) found.push(...listSourceFiles(path));
      continue;
    }

    if (/\.tsx?$/.test(entry.name)) found.push(path);
  }

  return found;
};

/**
 * Comments, by walking characters rather than matching patterns.
 *
 * A regex cannot do this: `"https://x"` and a template holding `/*` both read as comment openers,
 * and this repository is full of both. The scanner tracks string and template state so a marker
 * inside one is just text.
 *
 * Consecutive `//` lines are one comment. They are written as one paragraph and have to be
 * measured as one, or a long comment escapes the limit by wearing line breaks.
 */
const scanComments = (source) => {
  const comments = [];
  let index = 0;
  let line = 1;
  let quote = null;
  let pendingRun = null;

  const closeRun = () => {
    if (pendingRun !== null) comments.push(pendingRun);
    pendingRun = null;
  };

  while (index < source.length) {
    const character = source[index];

    if (character === "\n") line += 1;

    if (quote !== null) {
      if (character === "\\") index += 2;
      else {
        if (character === quote) quote = null;
        index += 1;
      }
      continue;
    }

    if (character === '"' || character === "'" || character === "`") {
      quote = character;
      index += 1;
      continue;
    }

    if (character === "/" && source[index + 1] === "/") {
      const end = source.indexOf("\n", index);
      const stop = end === -1 ? source.length : end;
      const text = source.slice(index + 2, stop).trim();

      pendingRun =
        pendingRun === null
          ? { line, text }
          : { line: pendingRun.line, text: `${pendingRun.text} ${text}` };

      index = stop;
      continue;
    }

    if (character === "/" && source[index + 1] === "*") {
      closeRun();

      const end = source.indexOf("*/", index + 2);
      const stop = end === -1 ? source.length : end;
      const body = source.slice(index + 2, stop);

      comments.push({
        line,
        text: body
          .split("\n")
          .map((row) => row.trim().replace(/^\*+\s?/, ""))
          .join(" ")
          .replace(/\s+/g, " ")
          .trim(),
      });

      line += body.split("\n").length - 1;
      index = stop + 2;
      continue;
    }

    // A run ends at the first thing that is not another `//` line. Whitespace between them is not
    // that thing, or every blank line inside a block would split it into separate comments.
    if (pendingRun !== null && character.trim() !== "") closeRun();

    index += 1;
  }

  closeRun();

  return comments;
};

const countOverLimit = (source) =>
  scanComments(source).filter((comment) => comment.text.length > LIMIT);

const counts = {};
const worst = {};

for (const root of SCAN_ROOTS) {
  for (const file of listSourceFiles(join(repoRoot, root))) {
    const over = countOverLimit(readFileSync(file, "utf8"));

    if (over.length === 0) continue;

    const path = relative(repoRoot, file);
    counts[path] = over.length;
    worst[path] = over;
  }
}

if (process.argv.includes("--update")) {
  writeFileSync(baselinePath, `${JSON.stringify({ counts, limit: LIMIT }, null, 2)}\n`);
  const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
  console.log(
    `Comment budget re-baselined — ${total} over ${LIMIT} chars across ${Object.keys(counts).length} files`,
  );
  process.exit(0);
}

const baseline = JSON.parse(readFileSync(baselinePath, "utf8"));
const failures = [];

for (const [path, count] of Object.entries(counts)) {
  const allowed = baseline.counts[path] ?? 0;

  if (count > allowed) {
    /*
     * Every offender in the file, not the longest one. The longest is usually old, so naming it
     * points at a comment nobody touched while the one just written goes unmentioned. Whoever is
     * committing knows which lines are theirs.
     */
    const where = worst[path]
      .map((comment) => `line ${comment.line} (${comment.text.length})`)
      .join(", ");

    failures.push(`${path}: ${count} over ${LIMIT} chars, budget ${allowed} — ${where}`);
  }
}

if (baseline.limit !== LIMIT) {
  failures.push(
    `the baseline was recorded at a ${baseline.limit}-char limit and this gate uses ${LIMIT} — ` +
      "re-baseline with --update so the numbers mean the same thing",
  );
}

if (failures.length > 0) {
  console.error(`Comment budget FAILED — ${failures.length} file(s) gained long comments:\n`);
  for (const failure of failures) console.error(`  ✗ ${failure}`);
  console.error(
    "\nShorten them, or run `node scripts/verify-comment-budget.mjs --update` if a real\n" +
      "comment pass lowered the numbers elsewhere and you mean to record the new floor.",
  );
  process.exit(1);
}

const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
const budget = Object.values(baseline.counts).reduce((sum, count) => sum + count, 0);

console.log(
  `Comment budget OK — ${total} comments over ${LIMIT} chars against a budget of ${budget}`,
);
