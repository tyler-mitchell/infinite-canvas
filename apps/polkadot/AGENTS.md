# Working on Polkadot

Read `ROADMAP.md` first — it holds the bar, the order, and the framework gaps found so far.

## Hooks

You never disarm a hook. Not by sentinel file, not by settings, not by any workaround. If one
seems wrong, strengthen or repoint it and say why — tightening is fine, weakening is not. If the
work seems complete, say so in your reply and keep working. A disarmed hook fails silently, which
is how an entire mission once ran with no enforcement at all.

## Committing when another session is working in the same tree

This section previously blamed the pre-commit hook, and that was wrong. Recorded here rather than
quietly deleted, because the wrong mechanism sends the next agent to defend the wrong door.

**`vp staged` scopes to your index, not to the working tree.** Watched directly: two files staged
while another session had nine modified, and lint-staged reported `Config object — 2 files`,
`* — 2 files`, and the commit landed with exactly two. The hook's own comment says so, and it is
right. It also stashes everything unstaged for the duration of the run and restores it afterwards.

The real route needs no hook at all: **the index is one file that both sessions share.** Anything
you `git add` is visible to the other session's very next commit, whoever typed it — and any broad
add of your own (`git add -A`, `git add <dir>`, `git commit -a`) picks up whatever they have in
flight. That is almost certainly what both historical sweeps actually were, though neither was
diagnosed at the time and this is inference rather than something anyone watched.

Two habits, and the second is the one that actually holds:

- **Stage and commit in one command** — `git add <paths> && git commit …` — and never leave work
  in the index while you go and read something. Name paths; never `-A`, never a directory, never
  `-a`.
- **Bound the commit with a pathspec**: `git add <paths> && git commit -F - -- <paths>`. A pathspec
  commit is built from the named paths and HEAD, so anything else sitting in the shared index —
  staged by you or by them — stays staged and stays out of your commit. This is the form to use
  whenever `git status` shows work that is not yours.

One hazard the correction does not remove: the hook stashes the other session's unstaged work for
the length of the run, so a commit of yours and a write of theirs can overlap. It usually restores
cleanly. It does not always clean up after itself — `git stash list` currently holds two orphaned
`lint-staged automatic backup` entries whose contents have long since landed. Leave them; a stash
you did not create is not yours to drop, and they cost nothing but noise.

The two sweeps, for the record — opposite directions, neither noticed until afterwards. Once a
commit swept a staged deletion whose replacement was still untracked, which left `HEAD` naming a
SurQL file it did not contain and the database unable to open from a clean clone. Once a commit
about window summaries carried an entire unrelated conflict-notice feature.

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
- **Every rule in `src/styles.css` lives inside `@layer components`.** Only `:root` is exempt,
  because it declares custom properties and nothing else. An unlayered rule outranks every layered
  rule in the document, so one bare selector at the top level of that file is a ceiling over the
  whole of `@layer utilities` — which is not hypothetical: it has happened twice, most recently to
  the entire file. The layer order is declared on line 1, and `components` sits after the
  framework's `infinite-canvas` and before `utilities`, so a slot override still beats the
  framework's theme and a utility still beats a slot override.
- Depth comes from surface lightness and layered shadow, not from 1px borders.
- Tokens live in `src/styles.css` and are the only source of colour, elevation, and easing.

## Reading a window's data

**`window.data` is `unknown`. Read it through `getInfiniteCanvasWindowData(window, guard)`, never
with a property access or a cast.** The framework types it `unknown` on purpose and ships the guard
to close that boundary; reaching past it is the only way to get this wrong.

It has been got wrong four times, all the same way. `window.data.noteId` survived the day window
data became one `{ itemId }` for every kind — the cast still compiled, and the read simply matched
nothing forever. Consequences: every palette reach opened a window instead of revealing one, a
rename never reached `setWindowTitle` so the far-zoom summary kept the old name, open notes were
listed as closed, and the recent-notes dedup never fired. Not one of them errored.

Through the guard, a shape that no longer validates fails at the boundary, loudly, where the
mismatch is. Past it, `undefined === "x"` is false and the app carries on being subtly wrong.

## Agents are a consumer, not an afterthought

**WebMCP is a requirement, so every capability has to exist somewhere an agent can call.** A page
registers tools an agent invokes directly; anything reachable only by clicking is invisible to it.

The architectural consequence: a capability lives in the command vocabulary or a module function
first, and a control calls it. Not the reverse. An `onClick` that builds an argument and dispatches
is the shape to avoid — it is a capability that exists only for a pointer, and it cannot be
described, enabled, or invoked.

Two live examples of the wrong shape, both written this session: the selection rail's group verb
composes `getSelectedWindowBounds` with `createGroup` inside a click handler, and the palette's
collection rows compose a kind with `openNewCollection` in theirs. Neither is a command; neither
can be driven except by a person. `getContextualCommands` already returns label, description and
live enablement for everything the framework owns — that is the bar the app's own verbs should
meet. See `docs/research/spikes.md`.

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

### Measuring a style instead of looking at one

The most expensive defect class in this app is **a declaration that is present, generated, and
never wins** — four instances, no error, no failing typecheck, no obviously broken pixel. A
screenshot cannot find one. One of them was in fact read off a screenshot as correct and was not.
So after any visual change, read the computed value back and compare it against what you declared:

```js
getComputedStyle(el).fontWeight; // what actually happened
```

Two mechanisms produce this class, and knowing only the first will miss the second:

- **Cascade order.** An unlayered rule beats every layered one; a layer's position is fixed by
  where it is first established, so import order decides who wins.
- **Specificity origin.** An inline `style` beats every stylesheet rule at any layer. The framework
  writes several properties inline, and no amount of CSS reaches them — the fix is to move the
  property into `theme.css`, not to out-specify it.

**A probe that traverses the CSSOM wrongly reports the app clean.** This was got wrong three
separate times while writing one sweep, and every mistake produced a false all-clear:

- Rules inside `@layer` blocks are in `CSSLayerBlockRule.cssRules`. Iterating `sheet.cssRules`
  without recursing finds none of them, and the app has exactly one unlayered rule.
- A `CSSStyleRule` also has a `cssRules` list, usually empty. Recursing on `if (r.cssRules)` before
  checking `r.selectorText` walks past every style rule into its empty children and collects
  nothing.
- Tailwind v4 nests: `.group-hover\:opacity-100` is a rule whose _declarations_ live in a nested
  `&:is(:where(.group):hover *)` inside `@media (hover: hover)`. The outer rule declares nothing,
  so reading only `r.style` says the utility is empty when it is fine.

So: check `selectorText` first, recurse into everything that has `cssRules` including style rules,
and confirm the probe finds a rule you know exists before trusting it to say a rule is missing.

`document.styleSheets` is also empty mid-reload, which reads as "no rules at all". If a probe
returns zero of something, prove the page is loaded before believing it.

**Two traps specific to measuring a `:hover` rule**, both of which produced confident wrong
conclusions in one sitting:

- `getComputedStyle` reports the element's _current_ state. There is no second argument for
  `:hover`, so reading a button that nothing is pointing at returns its resting value and looks
  like the hover rule doing nothing. Actually hover it — `computer{action:"hover"}` — and assert
  `el.matches(":hover")` in the same call before believing the number.
- **`!important` does not win against a transition.** CSS Cascade 5 orders transition declarations
  _above_ author-important, so setting `background-color: red !important` and reading in the same
  tick returns the transition's start value, not red. This looked like "an inline important literal
  computes transparent, which is impossible" and sent three probes down a dead end. Suppress the
  transition first, or wait past its duration, before treating an inline write as ground truth.

**A hover measured in the automated pane is not evidence about the product.** Two sessions spent
real time on "no rail button shows hover feedback", measured properly — pointer on the element,
`matches(":hover")` asserted, waited well past the 150ms transition. Every hovered element in the
app returns a background parked at its transition's _start_: `oklab(0 0 0 / 0)` where the token
resolves to `oklch(0.268 0.011 265)`. It reproduces across three independent styling systems —
`packages/ui`'s `tv` variants, the framework's `theme.css`, and a rail row's arbitrary
`hover:bg-[var(--surface-hover)]` — which is far too broad to be a defect in any of them. The
oklab serialisation is the tell: Chrome serialises an in-flight transition in its interpolation
space, so a transition is running and never advancing, which is what a pane not producing frames
looks like. **Confirm a hover finding in a real browser window before acting on it**, and suspect
the instrument first when a defect spans systems that share nothing but the page.

### Clicking by coordinate

**A coordinate click is in the screenshot's pixels, not the page's.** The pane scales the viewport
— a 514×998 viewport photographs as 800×1553 — so a coordinate read from `getBoundingClientRect`
lands somewhere else entirely, usually on whatever the library rail has at that height. Multiply by
the screenshot's width over the viewport's width, both of which every `read_page` and screenshot
result prints.

This cost six attempts on one menu and produced a confident, wrong conclusion each time: the menu
opened, the click missed, and it read as "the item did not take" — a product defect that was not
there. Three cheap habits make it unmistakable:

- Ask `document.elementFromPoint(x, y)` whether the element you meant is actually on top. It answers
  in viewport pixels, so agreeing with your target proves the _target_, not the click.
- After a failed click, look at the screenshot for what highlighted instead. A hovered row
  elsewhere is the coordinate space telling you it disagrees.
- Check nothing is covering it. A conflict notice or a menu left open from a previous attempt sits
  above the canvas, and Base UI toggles — so a click on a trigger whose menu is already open closes
  it, and everything later in that batch lands on bare canvas.

For a Base UI menu specifically: `ref` clicks do not open one at all, and `element.click()` misses
because it opens on pointerdown. Screenshot, click the trigger, wait, screenshot again, then click
the item — all in one batch, starting from a closed menu, with both clicks in screenshot pixels.
