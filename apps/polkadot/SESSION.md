# Polkadot session state

Goal status: active. `ROADMAP.md` is the bar and the order; `AFFORDANCE_AUDIT.md` is the
framework-first record. This file holds only what those two cannot: how work is actually running
right now.

## This file was months out of date, and every line of it was load-bearing

It is named "session state" and sits beside `AGENTS.md`, so it is one of the first things a new
agent reads — and until this rewrite it would have sent that agent to redo work that was finished
weeks earlier, against a dependency that has been deleted, with the one verification method the
project now requires switched off. Recorded rather than quietly overwritten, because the same drift
will happen again and the shape of it is worth recognising:

- It said the current stage was **"Phase 1 database admission"** and that the exit condition was
  IndexedDB admission "under the compatible 2.6.1 worker engine". Phase 1 closed long ago, and
  2.6.1 is gone — `@surrealdb/wasm` 3.0.4 is vendored at `packages/surrealdb-wasm` and the 2.6.1
  patch was deleted. An agent following this file would have reinstalled a removed dependency.
- It described a **TanStack Start scaffold** and a "production client/server build". Start was
  removed; this is an SPA on TanStack Router, and there is no server build.
- It said **"browser automation is paused"**. It is not paused — driving the real path in a browser
  is the verification standard the whole project now turns on, and a green suite explicitly does
  not substitute for it.

## How work is running

Several Claude sessions work `apps/polkadot` **in one shared working tree**, not in separate
worktrees. That is an operating constraint, not a detail:

- Files change under you mid-task. Re-read immediately before editing anything you did not just
  write, and never `git add -A` — stage explicit paths.
- Your uncommitted work can be committed by another session before you reach it. Check
  `git log --oneline -5` before writing a commit message.
- Another session's half-saved file reaches your dev server through HMR. An error page or a blank
  render is often theirs. Read the console before diagnosing your own change, and check
  `vp -C apps/polkadot check` — a type error in a file you never touched is the usual cause.
- Port 3000 is normally taken. Add a `.claude/launch.json` entry on another port; a different port
  is a different origin, so you also get your own IndexedDB and cannot corrupt anyone's canvas.

A coordinating session hands out file boundaries. Ask it rather than guessing when two tasks look
like they touch the same files — two agents rewriting one file costs one of them the work.

## Authorities

- The bar, the order, and the framework gaps found so far: `ROADMAP.md`
- Framework-first admission, one row per capability, written **before** the code: `AFFORDANCE_AUDIT.md`
- Rules that are not negotiable — `tv` slots, library-first, framework-first: `AGENTS.md`
- Framework behaviour: `packages/infinite-canvas` source and tests, and `docs/API.md`
- Repository workflow: root `AGENTS.md`

`PRODUCT_PLAN.md` and `IMPLEMENTATION_PHASES.md` describe a phase sequence the project has since
departed from — Phase 3's note body landed early and is recorded as such in the audit. Read them as
history and intent, not as the current order.

## Constraints that are still true

- The framework owns windows, groups, workspaces, geometry, and layout durability. The database
  owns domain content — notes, relations, regions — and never the layout.
- The editor is browser-rendered because IndexedDB and the WASM engine are client-only.
- Remote features may never weaken the complete local-only product.
- Shared live layout stays frontier work until personal view state and ordered document mutations
  are proven.
