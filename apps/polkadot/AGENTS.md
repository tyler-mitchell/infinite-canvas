# Working on Polkadot

Read `ROADMAP.md` first — it holds the bar, the order, and the framework gaps found so far.

## Hooks

You never disarm a hook. Not by sentinel file, not by settings, not by any workaround. If one
seems wrong, strengthen or repoint it and say why — tightening is fine, weakening is not. If the
work seems complete, say so in your reply and keep working. A disarmed hook fails silently, which
is how an entire mission once ran with no enforcement at all.

## Committing when another session is working in the same tree

`git add <paths>` does not bound your commit. The pre-commit hook runs `vp staged`, whose scope
is the modified working tree rather than your index — commit two files while another session has
five uncommitted and you will commit seven, under your message.

There is a second route to the same place, and it needs no hook at all: **`git commit` commits the
index, and the index is one file that both sessions share.** Anything you `git add` is visible to
the other session's very next commit, whoever typed it. So the window between staging and
committing is the exposure, and it is the part you control.

**Stage and commit in one command** — `git add <paths> && git commit …` — and never leave work
sitting in the index while you go and read something. That does not close the hook's route above,
which is why the check below is still required, but it removes the case where your own half-staged
work is what gets carried off.

This has happened twice, in both directions, and neither time was noticed until afterwards. Once
a commit swept a staged deletion whose replacement was still untracked, which left `HEAD` naming
a SurQL file it did not contain and the database unable to open from a clean clone. Once a
commit about window summaries carried an entire unrelated conflict-notice feature.

So: **read `git show --stat HEAD` after every commit**, and if it names files you did not write,
say so to the other session immediately and precisely — which files, which commit. The tree stays
correct either way; what breaks is the other agent's picture of what they still have to land, and
that only breaks if nobody says anything.

Do not fix it by rewriting history. A rebase or an amend across a tree someone else is editing
costs more than a misattributed commit message, and rewriting shared history is the owner's call.

## The one rule that is not negotiable

**Check the framework first. This is a hard precondition on every capability, with no exception
and no judgment call.** It is the premise of the project, not a best practice: Polkadot exists to
find gaps in `@hyphened/infinite-canvas`, and that only works if the check happens every time,
before anything is written, with evidence recorded in `AFFORDANCE_AUDIT.md`.

It has already failed once, and the shape of the failure is worth knowing because it will look
identical next time. A HUD was written from scratch — zoom controls, camera controls, a button
primitive — while `InfiniteCanvasHud` and `ui`'s `Button` already existed and had been _seen
earlier in the same session_. Nothing errored. It compiled, rendered, and looked like progress.
The duplicate only became visible when both versions appeared on the canvas at once.

An agent under time pressure skips this check to produce visible output and does not notice it
skipped. Write the audit row first; that is the only reliable defence.

When you find something Polkadot cannot do:

1. Check whether `@hyphened/infinite-canvas` already does it. Use Type Atlas — `list_module_exports`
   on the barrel, then `inspect_symbol`. The surface is 199 exports and most guesses about what is
   missing are wrong.
2. If the framework owns it, consume it. Do not restate its model.
3. If it is genuinely missing, add it to the framework **generically**, then consume it from here.
   The test: could another consumer with a different product want this exact affordance? If the
   answer needs the word "Polkadot", the design is wrong.
4. Product code owns domain policy and composition. Nothing else.

## Styling

- Every class comes from a `tv` slot. There are no Tailwind strings in JSX. None.
- Global CSS is imports, tokens, and document-level resets.
- Depth comes from surface lightness and layered shadow, not from 1px borders.
- Tokens live in `src/styles.css` and are the only source of colour, elevation, and easing.

## Libraries

Never hand-roll what a maintained library owns. In practice: TanStack Router, Pacer, Hotkeys,
Form, Virtual, DB; Base UI and `cmdk` for modals, menus, and command surfaces; ArkType for runtime
validation; Legend State for ephemeral reactive state; `motion` for animation; `tailwind-variants`
for styling. Reach for the framework's own affordance before any of them for anything spatial.

Before writing infrastructure, read the library's current docs. Not its `dist`, not its types —
what its authors published, especially the examples.

## Architecture that is already decided

- **Canvas state, geometry, interaction, commands, focus, persistence, overlays** — the framework.
  The store is parent-owned; `createInfiniteCanvasHandle` is the external observation boundary.
- **Layout durability** is the framework's (`serializeInfiniteCanvasState`). The database owns
  domain content — notes, relations, regions — and never the layout.
- **The database is SurrealDB WASM** on `indxdb://`, vendored at `packages/surrealdb-wasm` because
  the published builds either lack IndexedDB or lack the Vite worker fix. It loads on demand; the
  canvas paints before it resolves and must keep doing so.
- **This is an SPA.** TanStack Start was removed: the data layer is client-only, so SSR renders
  nothing useful, and Start's dev middleware never mounted because `vite` here is aliased to
  `vite-plus-core`, whose version fails Start's peer range.
- **SurrealDB queries return one result per statement.** `LET $x = …; RETURN $x;` gives two, and
  `[0]` is the `LET`. Use a single `RETURN`.

## Verifying

```sh
vp -C apps/polkadot check
vp -C apps/polkadot build
```

Framework changes also need the package's own check, its 489 tests, and both builds.

**Look at it.** This is a design-led product; a passing typecheck says nothing about whether the
thing is good. Open the preview, hover the canvas, drag a window, watch the field react. The one
defect that mattered most in this app's history — every workspace action being silently dropped —
survived a full test suite and died the first time someone loaded the page.
