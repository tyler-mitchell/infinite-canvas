# Polkadot session state

Goal status: active.

`ROADMAP.md` defines the quality bar and work order.
`AFFORDANCE_AUDIT.md` records the framework-first evidence.
This file describes the current work process that those files do not contain.

## This file was months out of date, and every line of it was load-bearing

This file is named "session state" and is next to `AGENTS.md`.
New agents read it early.

Before this revision, its content was several months old.
It directed agents toward completed work, a deleted dependency, and a disabled verification method.
This section records that drift because the same type of drift can occur again.

- The file named **"Phase 1 database admission"** as the current stage.
  It named IndexedDB admission "under the compatible 2.6.1 worker engine" as the exit condition.
  Phase 1 ended weeks before this revision.
  The repository vendors `@surrealdb/wasm` 3.0.4 at `packages/surrealdb-wasm`.
  The repository deleted the 2.6.1 patch.
  The old instruction can make an agent install the deleted dependency again.
- The file described a **TanStack Start scaffold** and a "production client/server build".
  The application is an SPA on TanStack Router because the project removed Start.
  The project has no server build.
- The file said **"browser automation is paused"**.
  Browser automation is active.
  The project requires browser operation of the real path as its verification standard.
  A passing suite does not replace this browser evidence.

## How work is running

Several Claude sessions edit `apps/polkadot` in one shared working tree.
They do not use separate worktrees.

Apply these rules:

- Files can change during a task.
  Before you edit a file that you did not write, read it again.
  Stage explicit paths and never use `git add -A`.
- Another session can commit your uncommitted work first.
  Before you write a commit message, run `git log --oneline -5`.
- HMR can load a partially saved file from another session into your development server.
  An error page or blank render can come from that file.
  Before you diagnose your change, read the console.
  Then run `vp -C apps/polkadot check`.
  A type error in an untouched file is the usual cause.
- Port 3000 is normally in use.
  Add a `.claude/launch.json` entry that uses another port.
  Each port is a different origin and gets a separate IndexedDB database.
  This separation prevents corruption of another session's canvas.

A coordinating session assigns file boundaries.
If two tasks can edit the same files, ask that session for the boundary.
Two agents that rewrite one file cause one agent to lose its work.

## Authorities

- `ROADMAP.md` defines the quality bar, work order, and known framework gaps.
- `AFFORDANCE_AUDIT.md` records one framework-first admission row for each capability before implementation.
- `AGENTS.md` defines the required `tv` slot, library-first, and framework-first rules.
- The source and tests in `packages/infinite-canvas` define framework behavior with `docs/API.md`.
- The root `AGENTS.md` defines the repository workflow.

`PRODUCT_PLAN.md` and `IMPLEMENTATION_PHASES.md` describe the original phase sequence.
The project later changed that sequence.
Phase 3 note-body work arrived early, and the audit records this fact.
Use these two files as history and intent.
Use the roadmap for the current order.

## Constraints that are still true

- The framework owns windows, groups, workspaces, geometry, and durable layout.
- The database owns domain content, including notes, relations, and regions.
- The database does not own layout.
- The browser renders the editor because IndexedDB and the WASM engine are client-only.
- Remote features must preserve the completed local-only product.
- Shared live layout remains frontier work until personal view state and ordered document changes have proof.
