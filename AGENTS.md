<!--VITE PLUS START-->

# Using Vite+, the Unified Toolchain for the Web

This project is using Vite+, a unified toolchain built on top of Vite, Rolldown, Vitest, tsdown, Oxlint, Oxfmt, and Vite Task. Vite+ wraps runtime management, package management, and frontend tooling in a single global CLI called `vp`. Vite+ is distinct from Vite, and it invokes Vite through `vp dev` and `vp build`. Run `vp help` to print a list of commands and `vp <command> --help` for information about a specific command.

Docs are local at `node_modules/vite-plus/docs` or online at https://viteplus.dev/guide/.

## Built-in Commands vs Scripts

`vp <name>` runs a built-in command. `vp run <name>` runs a `package.json` script or a `vite.config.ts` task. Scripts cannot overwrite built-ins, so `vp dev` and `vp run dev` may do different things. Check `package.json` and `vite.config.ts` first, and run `vp run <name>` when the project defines a script or task with that name.

## Tool Versions

Run `vp toolchain` to show versions and relationships in the active Vite+
release. Add a tool name to select part of the graph. For example, run
`vp toolchain vite`. Use `--global` to ignore the local `vite-plus` package. Use
`vp why <package>` to show the package-manager dependency graph.

## Review Checklist

- [ ] Run `vp install` after pulling remote changes and before getting started.
- [ ] Run `vp check` and `vp test` to format, lint, type check and test changes.
- [ ] Check if there are `vite.config.ts` tasks or `package.json` scripts necessary for validation, run via `vp run <script>`.
- [ ] If setup, runtime, or package-manager behavior looks wrong, run `vp env doctor` and include its output when asking for help.

<!--VITE PLUS END-->

## Configurability in `infinite-canvas`

**Anything that can be made configurable in `@hyphened/infinite-canvas` should be made
configurable.** It is a library: every hardcoded size, colour, label, threshold, policy or
behaviour is a decision taken on behalf of every consumer that will ever exist, and it reads as
correct right up until one of them needs it to be different. Give it a default, expose it as an
input, and document it in `docs/API.md`.

A value that is only correct because the consumer accepted the whole default look is not
configurable — it is coincidentally right. Consumers find these by diverging; the framework's job
is to have already asked.

**The worst case is an inline style, and it is worth knowing why.** An inline style outranks every
stylesheet rule in every layer, so a property written there is not merely defaulted — a consumer's
rule for it is present, generated, and beaten on every render, with nothing to see and nothing
logged. `theme.css` draws the line: treatments belong in the stylesheet, and what the framework
_computes_ stays in the component because its own layout and hit-testing read it back.

**Do not expect a lint to find these.** A check keyed on property names was tried and deleted: it
flagged twenty lines that were almost all correct. `cursor: "ns-resize"` on a resize handle is not a
preference, it says which way that handle resizes; the HUD's flex row is load-bearing; `transparent`
on the raster surface means "do not paint"; and one match was a lookup table, not a style at all.
The distinction is whether a value is a treatment or is bound to what the element does, and that is
not decidable from a property name. Read for it instead — three real instances were found that way,
and each took one look at a file nobody had audited.

## Comments / Documentation

- ALL prose (docs, comments) MUST be terse and use the bare minumum number of words required to explain.
  **No new comment may exceed 100 characters.** Whole comment, not per line — a docblock counts as
  one. Longer than that means it belongs in `docs/`, a bump file, or nowhere.

A comment states what the code does, or why a non-obvious choice was made, in the plainest
sentence that carries it. If it is not a fact about the code, delete it.

Banned outright, because these are the forms the drift takes:

- Headline openers that name a theme instead of describing behaviour — "What the schema could not
  stop", "The database, drivable from a console".
- Aphorisms and value judgements — "a report that cannot tell those apart is worse than no report".
- Sentences about how a reader will feel or what they will do — "a panel people learn to avoid".
- Personification and metaphor — code does not learn, know, want, remember, or decide.
- Narrating the next statement, which the statement already says.
- Incident history and rationale essays. Those belong in a bump file, a commit body, or `docs/`.

Length is a signal, not a rule: a docblock past six lines is usually carrying something that
belongs elsewhere. Default to no comment. Type names and function names are the documentation, and
a comment that repeats them is noise in every search result and symbol lookup that returns it.

This applies to prose in tests exactly as it does to source.

## Reporting

Never announce a passing test count, a clean typecheck, or "green". Run them — they are a floor,
not a result — and say nothing unless something failed. A count reads as "this works" when it means
"the assertions that executed held", which is a false sense of security about unverified behaviour.

Report what was witnessed running, and name separately what was not.

## Naming

A parameter, property or local takes its name from its type or from the prop that already carries
the same value. `readonly InfiniteCanvasHotkeyAction[]` is `hotkeyActions`, which is what the
viewport prop is called. Never coin a new word for a thing already named.

## Commit messages

[Conventional Commits](https://www.conventionalcommits.org/), read as written.

The subject states what the change does. This repo has drifted into metaphor and personification
that names no change — "the vocabulary learns to name the canvas it is standing in" — which is the
one thing to avoid.

Most commits need no body. Add one only for what the diff cannot show, in a sentence or two, and
never to enumerate the changes.

## Driving the app

Every contributor drives Polkadot the same way: through the WebMCP tools the
app publishes. Not the DOM, not synthetic events, not a console global.

Chrome needs `--enable-blink-features=WebMCP` (not `--enable-features`). Load a
canvas route first — the tools register inside the canvas provider, so the
index answers "no WebMCP tools available".

- `command.list` says what can run right now. Ask it before invoking, rather
  than invoking and reading "is not available right now".
- Verbs return once their write lands, so the answer can be trusted
  immediately. `note.write` is the stated exception and says so in place.
- `database.query` confirms what a verb actually wrote. Development only, along
  with `database.report` — it runs arbitrary SurQL and bypasses every schema,
  refusal and revision guard, so it is gated in `getAppTools`.

If you find yourself clicking a `[cmdk-item]`, dispatching a `KeyboardEvent`,
hand-building a selection target, or waiting on a `setTimeout` for a write,
stop: that is a missing affordance, not a technique. Add the tool.

Writes cannot be driven from a node test — the WASM engine does not start under
`vp test` at all, so an awaited write hangs rather than failing. See
`apps/polkadot/src/database/in-memory-engine.test.ts`. Assert decisions and
rules there; assert writes in a browser.

## Shared Agent Workflow

- Daily branch: `main`
- Bumpy base branch: `release`
- Generated version PR: `bumpy/version-packages`

The human owns the checked-out branch. Agents never create, switch, rename,
delete, reset, or replace branches unless the human requests that exact
operation. If another branch is checked out, continue there and report the
difference.

Work and commit on the checked-out branch. Stage only task-owned files. If the
index already contains another agent’s files, commit task-owned paths only and
leave the other staged entries untouched with
`git commit --only -- <task-owned paths>`. Never delete `.git/index.lock`; wait
for the other Git operation to finish.

`commit` authorizes a local commit only. `push` authorizes the checked-out
branch and includes every unpushed commit already on it; report that complete
commit set before pushing. Consumer-visible package changes include one
maintained Bumpy bump file. Agents never create task branches or worktrees.

### Bump lifecycle

Bumps are authored during change development, never reconstructed just before
release. The first consumer-visible commit for a logical change creates one
bump file through `pnpm run release:add -- ...`; later commits for that same
change update the same file. An unrelated logical change gets its own bump
file.

Commit the implementation, tests, generated consumer docs, and bump file
together. Follow `node_modules/@varlock/bumpy/skills/add-change/SKILL.md` for
the exact command, bump level, package attribution, and changelog text. Use
patch for compatible fixes, minor for compatible capabilities, and major for
breaking public contracts. Name only directly changed packages; Bumpy owns
fixed-group and dependency propagation. Root shared changes name every affected
public package explicitly.

Before every commit, decide whether the task-owned diff changes published
behavior, API, runtime dependencies, executables, generated artifacts, or
consumer documentation. If it does, the bump belongs in that commit. A release
request consumes pending bump files; it never creates them retroactively.

Bump files accumulate on `main`; pushing it does not invoke Bumpy's release
workflow.

If the push is rejected because the remote advanced, never force-push or rebase.
When the worktree is clean and no parallel agent has uncommitted work, merge
`origin/main` into the checked-out `main`, then push once.

Only an explicit `release` request authorizes merging `main → release`, then
queuing `bumpy/version-packages` with `pnpm run release:merge`. GitHub owns
publication and public verification.
Never version packages, edit generated changelogs, publish locally, dispatch
release workflows, poll CI, or read successful-job logs.

Run `pnpm run release:pr` once. If the PR is absent, return to useful work;
GitHub owns the pending workflow. If it is behind `release`, run
`pnpm run release:update` once and let required checks rerun.

After publication, synchronize `main` forward from `release` only with a clean
worktree and no parallel uncommitted work. Never rebase or force-push shared
commits.

Complete that synchronization before the next daily change and confirm Bumpy's
consumed bump files are absent. Address review findings in code; resolve the
thread only after the correction makes it outdated.
