<!--VITE PLUS START-->

# Using Vite+, the Unified Toolchain for the Web

This project is using Vite+, a unified toolchain built on top of Vite, Rolldown, Vitest, tsdown, Oxlint, Oxfmt, and Vite Task. Vite+ wraps runtime management, package management, and frontend tooling in a single global CLI called `vp`. Vite+ is distinct from Vite, and it invokes Vite through `vp dev` and `vp build`. Run `vp help` to print a list of commands and `vp <command> --help` for information about a specific command.

Docs are local at `node_modules/vite-plus/docs` or online at https://viteplus.dev/guide/.

## Review Checklist

- [ ] Run `vp install` after pulling remote changes and before getting started.
- [ ] Run `vp check` and `vp test` to format, lint, type check and test changes.
- [ ] Check if there are `vite.config.ts` tasks or `package.json` scripts necessary for validation, run via `vp run <script>`.
- [ ] If setup, runtime, or package-manager behavior looks wrong, run `vp env doctor` and include its output when asking for help.

<!--VITE PLUS END-->

## Shared Agent Workflow

- Daily and Bumpy base branch: `main`
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

Pushing `main` makes Bumpy create or update `bumpy/version-packages`; it does not
publish.

If the push is rejected because the remote advanced, never force-push or rebase.
When the worktree is clean and no parallel agent has uncommitted work, merge
`origin/main` into the checked-out `main`, then push once.

Only an explicit `release` request authorizes queuing `bumpy/version-packages`
with `pnpm run release:merge`. GitHub owns publication and public verification.
Never version packages, edit generated changelogs, publish locally, dispatch
release workflows, poll CI, read successful-job logs, or merge with `--admin`.

Run `pnpm run release:pr` once. If the PR is absent, return to useful work;
GitHub owns the pending workflow. If it is behind `main`, run
`pnpm run release:update` once and let required checks rerun.

Synchronize `main` from `origin/main` only with a clean worktree and no parallel
uncommitted work. Fast-forward only. Never rebase or force-push shared commits.
