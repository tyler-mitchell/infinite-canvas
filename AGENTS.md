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

- Working branch: `main`
- Integration branch: `release`
- Bumpy release branch: `bumpy/version-packages`

The human owns the checked-out branch. Agents never create, switch, rename,
delete, reset, or replace branches unless the human requests that exact
operation. If another branch is checked out, continue there and report the
difference.

Work and commit on the checked-out branch. Stage only task-owned files. If the
index already contains another agent’s files, commit task-owned paths only and
leave the other staged entries untouched. Never delete `.git/index.lock`; wait
for the other Git operation to finish.

`commit` authorizes a local commit only. `push` authorizes the checked-out
branch and includes every unpushed commit already on it; report that complete
commit set before pushing. Consumer-visible package changes include one
maintained Bumpy bump file. Agents never create task branches or worktrees.

Pushes to `develop` create or update the single `develop → main` pull request.
Required project and Bumpy checks gate auto-merge. They do not publish packages.

Only an explicit `release` request authorizes queuing
`bumpy/version-packages` with `pnpm run release:merge`. GitHub owns publication
and public verification. Never version packages, edit generated changelogs, publish
locally, dispatch release workflows, poll CI, or read successful-job logs.

Synchronize `main` from `release` only with a clean worktree and no parallel
uncommitted work. Fast-forward when possible; otherwise merge `origin/main`
without rebasing shared commits. If a queued PR is behind `main`, update that
PR branch once and let required checks rerun.
