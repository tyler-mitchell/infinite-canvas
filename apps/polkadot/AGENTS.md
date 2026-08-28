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
- **No `backdrop-blur` behind an opaque fill.** Six slots and one CSS rule paired
  `bg-[var(--surface)]` — which has no alpha — with `backdrop-blur-2xl`, so every HUD rail, the
  library rail, the minimap, the conflict notice and the dock composited a 40px blur that is
  invisible by definition: nothing shows through an opaque background. Measured on four live
  surfaces, all reporting `backdrop-filter: blur(40px)` over `oklch(0.205 0.009 265)`. The frosted
  look those were reaching for needs a translucent surface, which is a real design decision — it
  makes text contrast depend on whatever canvas content is behind — not a class you add on top.
- **On this ground, the elevation model is thinner than it looks, and knowing the numbers stops you
  trusting it.** Measured: `--surface` against `--ground` is 1.09:1, the `--edge-light` inset ring
  composites to `rgb(37,39,43)` for 1.31:1, and `--lift-2`'s darkest stop lands on `rgb(6,7,9)` for
  1.03:1 — a black shadow cannot darken a near-black ground, so the shadows contribute almost
  nothing and the hairline ring is doing all the separating. That is fine for a panel over a busy
  canvas and not fine for a control that has to be found unaided, which is why the failure screen's
  only button is `--accent` rather than a surface.
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

`window-data-reads.test.ts` fails the build on a cast of a window payload anywhere in the app. It
bit on its first run and found two live instances nobody had noticed.

## When a framework field gains `null`

**The typechecker will not find the readers.** `InfiniteCanvasGroup.title` became `string | null`
on 2026-08-27 — `null` meaning "named after its members" — and two readers survived a clean
typecheck and a full suite:

- A template. `` `"${group.title}"` `` accepts `null` and renders the literal string `"null"`. This
  shipped in `describe-canvas.ts`, which is the half of the app's vocabulary an agent depends on
  entirely, so the wrong sentence was invisible to anyone who could see the screen.
- A `??` fallback. `group.title ?? "Group"` swallowed the `null` into the framework's placeholder,
  so every offscreen arrow pointing at an unnamed group read "Go to Group". Worse than the first
  for being plausible: `"null"` is obviously broken, a placeholder just looks like a label.

So after widening a type, find the readers by hand — `mcp__type-atlas__references` on the property
itself, not a text search — and read each one for interpolation and for a fallback that now
absorbs a meaningful value.

**There is no lint rule for this here, and that was checked rather than assumed.**
`typescript/restrict-template-expressions` is the typescript-eslint rule that would catch the
first case; this toolchain's oxlint does not implement it. Enabling it in `vite.config.ts` produced
no diagnostic on an isolated `string | null` interpolation and no complaint about an unknown rule
either — unknown names are ignored silently, so a rule listed in config is not evidence a rule
runs. Prove it fires on a case you construct before trusting it.

A text guard was considered for the read side and rejected: the palette legitimately interpolates
`.title` inside a null-checked branch, so a scan would flag correct code, and a guard that cries
wolf is worse than none.

## Verifying in the browser

Driving the running app is the only way to find most of what is wrong here, and the instruments
lie. Eleven did on 2026-08-26 alone. Each of these is a measured failure, not a caution:

**Read this list before driving, not after being confused by it.** On 2026-08-27 an agent built a
`requestAnimationFrame` retry loop to find an element, watched it silently never run, and shipped a
wrong number twice before checking `document.hidden` — which the rAF entry below has said to check
since the day it was written. The same session then spent two attempts on a tool-driven `Mod+K`
that the key-press entry says cannot reach the page. Neither was a new discovery; both were this
file going unread by someone who had already opened it for something else. The traps here are cheap
to read and expensive to rediscover, and the cost lands as a value that typechecks, passes review,
and is wrong.

- **A screenshot is authoritative about content and unreliable about layering.** Twice, from
  unrelated directions, a capture showed content that the DOM says is not in that element — a
  window's rows through an opaque rail, and one window's text inside another's frame. Window
  bodies composite through native html-in-canvas, and a GPU layer can flatten differently under
  capture than it paints. Ask `elementFromPoint` and computed backgrounds, not a picture.
- **`getComputedStyle` returns the value mid-transition, not the declared one.** `transition-all`
  sits in the shared Button base. Reading a hover gave `oklab(0 0 0 / 0)` — stable across 500ms of
  sampling and across reloads, with every property of a real finding, and entirely wrong. Move the
  pointer somewhere else first, then onto the target, or no transition is triggered to wait on.
- **The network panel records same-origin requests only.** A cross-origin iframe's document load is
  invisible to it, and a refused frame is indistinguishable from a loaded one — same `load`, same
  null `contentDocument`. You cannot tell whether an embedded page arrived.
- **`navigator.clipboard` is permission-denied.** Real copy formats cannot be observed; dispatch a
  synthetic `ClipboardEvent` with the formats you want to test instead.
- **`commands` take positional arguments.** `setSelection([id])`, not `setSelection({ windowIds })`.
  The object form throws or silently no-ops, and a "selection is 0" reading is usually the call.
- **The browser tool's key press does not reach the page.** A probe recording every `keydown` on
  `document`, in both phases, caught nothing at all from a tool-driven Escape. So "I pressed the key
  and nothing happened" is not evidence about the app — it is the default outcome. Dispatch a
  `KeyboardEvent` at the element you mean to test, and be exact about the target: an event aimed at
  `document` has `BODY` as its target, which is outside the React root, so no `onKeyDown` on any
  component can hear it. That difference is a finding in its own right, not an artefact to route
  around — a handler that only fires for a focused subtree is a handler most users never reach.
- **A background tab has a zero-size viewport.** `innerWidth` and `innerHeight` both read `0`, and
  every `elementFromPoint` returns `null`, so a probe looks like a page with nothing on it. Front
  the tab and set a viewport before measuring anything positional.
- **Animation driven by `requestAnimationFrame` does not run in this pane, and fronting the tab does
  not fix it.** `document.visibilityState` reports `hidden` even after `tabs_select` says the tab is
  fronted, so rAF is suspended: the radial menu's six items were measured at `0,0` — fully closed —
  on a menu whose buttons were present, focusable and clickable, and a screenshot showed a collapsed
  pill where a ring of six belonged. An earlier read caught frozen mid-flight offsets, which is
  worse, because partial values look like a layout bug rather than a stopped clock. Check
  `document.hidden` before believing any animated geometry, and treat spring or transition end
  states as unverifiable here. Behaviour that does not need a frame — focus, enablement, dispatch,
  hit-testing — measures fine.

- **Opening a focus-trapped surface from a probe wedges the pane, and the pane does not come back.**
  A loop that clicked each `[aria-haspopup="menu"]` trigger in turn — to walk the menus for unnamed
  controls — hung the evaluator: `javascript_tool` timed out after 30s reporting the pane stuck, and
  every later call in that tab failed the same way. Dispatching `Escape` did not release it, which
  follows from the key-press entry above. Recovery is `tabs_close` then a fresh `preview_start`; the
  tab is not salvageable. So a menu, dialog or palette cannot be audited by opening it here. Read its
  source instead — a static scan found two fields a runtime walk had missed anyway, because both
  render only while open.

- **A module observable read from a console probe is not a window onto the database.** Driving the
  relation verbs, four separate reads said the write had not happened; an explicit
  `loadRelations(projectId)` then showed it had, with exactly the value the verb wrote. Between
  probes the app clears and repopulates `relations$` — `loadRelations` empties it whenever the
  project id it holds differs — so a `peek()` can return `[]` moments after returning two rows,
  and "the verb did nothing" is the reading that produces. Verify a write by calling the loader and
  reading after it, never by watching the observable settle. The same probes also showed
  `setTimeout` throttled to roughly one tick per second in this hidden pane, which turns a "wait 3
  seconds" into a couple of ticks — do not build a verdict on a timed wait here.
- **The editor's DOM is not the editor's state, and synthetic typing separates them.** The tool's
  `type` action does not produce the `beforeinput` Lexical guards on, so text can land in the
  contenteditable that the editor then refuses. Driven on 2026-08-28: typing after a mention showed
  `@Untitled 1 x @Un` in the DOM while the stored state held one clean segmented `@Untitled 1` with
  its id — the state never changed, so no save fired, and the DOM simply stayed unreconciled. That
  was read as "typing is absorbed into the mention" and a defect was written into `mention-node.ts`
  and committed before the state was checked. Read the serialized state — `editor.getEditorState()`
  or the stored row — before believing anything about an editor, and never conclude a node's shape
  from `textContent`.
- **Import the app's own module URL, not the file path.** `import("/@fs/…/app-actions.ts")` resolves
  to a different module identity than the app's own `/src/app-actions.ts` and hands back a second,
  freshly-initialised copy: every observable on it reads empty, which looks exactly like an app with
  no data rather than like the wrong instance. Import `/src/…` to reach what is actually running.

- **A probe that mutates canvas state loses its own return value.** Every call that dispatched a
  command failed with `Promise was collected` — the canvas re-renders and the evaluation's promise
  is discarded before it resolves. The mutation lands; only the answer is thrown away, so this reads
  as "the call failed" when nothing failed. Dispatch in one probe and read the result in the next,
  and never conclude from the error alone that the command did not run.

**The probe discipline that would have prevented three of these.** Open the thing and read it in the
_same_ evaluation. Every split probe here produced a confident wrong answer: a second `contextmenu`
dispatched at an already-open wheel closed it, so focus was read on a menu that no longer existed —
and that reading was written into a source comment claiming auto-focus was impossible. It was not.
It worked on the first honest measurement.

The rule the day actually taught: **when two or three hypotheses fail in a row, stop theorising and
suspect the instrument.** A long stretch went into a hover "defect" that did not exist, and the
signal was there early — each explanation falsified, and a fourth reached for anyway.

## Agents are a consumer, not an afterthought

**WebMCP is a requirement, so every capability has to exist somewhere an agent can call.** A page
registers tools an agent invokes directly; anything reachable only by clicking is invisible to it.

The architectural consequence: a capability lives in the command vocabulary or a module function
first, and a control calls it. Not the reverse. An `onClick` that builds an argument and dispatches
is the shape to avoid — it is a capability that exists only for a pointer, and it cannot be
described, enabled, or invoked.

Both examples this section used to cite as live are now fixed and are kept as the shape to
recognise: the selection rail's group verb composed `getSelectedWindowBounds` with `createGroup`
inside a click handler, and the palette's collection rows composed a kind with `openNewCollection`
in theirs. Neither was a command; neither could be driven except by a person. `getContextualCommands`
returns label, description and live enablement for everything the framework owns — that is the bar
the app's own verbs meet in `app-actions.ts`. See `docs/research/spikes.md`.

**Arguments.** Prefer one entry per argument value while the values can be listed — `collection.create.link`
rather than a create-collection verb taking a kind, which is the framework's own shape
(`view.pan.right`, `group.setLayout.tabs`) and needs no schema at all. When the argument is drawn
from the document rather than a fixed set — a title, an id — the entry carries an ArkType `input`.
One declaration serves both halves: `toJsonSchema()` is what a caller is offered, and the same type
is what the verb narrows with, so the promised shape and the accepted shape cannot drift. Validate
inside the verb, not in the caller: a caller that checked first and handed over a trusted object
needs a cast at the other end, and the cast is where they start disagreeing silently.

**Which handle.** An id and a title are not interchangeable, and the choice follows the caller.
Reveal a _window_ by title, because a caller pointing at a window can see its title. Open a _stored
record_ by id, because titles do not distinguish stored items — a project holds five "Untitled"
notes without complaint — so whatever lists them must report the id it expects back.

**Reading is a capability too.** A verb-only vocabulary is complete for a pointer, which gets its
answer by looking, and half a vocabulary for anything that cannot see the screen: it can act and
never learn whether it worked. `describeCanvas` and `describeProjectContent` are the reporting
half. They are module functions rather than `AppAction`s deliberately — `APP_ACTIONS` is rendered as
palette rows, and a row that only returns text does nothing when picked. That is what the "or a
module function" in the rule above is for; it is not a loophole.

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
  domain content — notes, relations, regions — and stores the layout without modelling it, with one
  exception: `fn::canvas_removal_summary` does `array::len($source.layout.windows)` so a delete can
  say what it costs. That is SurQL reaching into a shape the framework owns, and a rename upstream
  would answer 0 with no error — a destructive confirmation reporting that nothing is lost.
  `canvas/layout-shape.test.ts` pins the path from this side, and was checked by breaking it.
- **The database is SurrealDB WASM** on `indxdb://`, vendored at `packages/surrealdb-wasm` because
  the published builds either lack IndexedDB or lack the Vite worker fix. It is imported lazily, by
  the route loaders that need it.
- **The canvas does not paint before the database resolves, and that is deliberate.** This said the
  opposite — "the canvas paints before it resolves and must keep doing so" — and no code has done
  that for as long as the routes have had loaders. Both `/` and `/canvas/$canvasId` `await` the
  client and then the read, and show `CanvasLoading` until it lands. `canvas.$canvasId.tsx` gives the
  reason: the loader hydrates as well as reads, so the component is handed valid state and nothing
  renders an empty canvas that fills in a moment later. Read from the routes on 2026-08-28; the old
  claim was structural, not a timing question, so no measurement was needed to refute it.
- **This is an SPA.** TanStack Start was removed: the data layer is client-only, so SSR renders
  nothing useful, and Start's dev middleware never mounted because `vite` here is aliased to
  `vite-plus-core`, whose version fails Start's peer range.
- **SurrealDB queries return one result per statement, and that means the top level of the query.**
  `LET $x = …; RETURN $x;` sent to `query()` gives two, and `[0]` is the `LET` — measured, it is
  `[null, 1]`. So a caller sends a single `RETURN`. A `LET` **inside a function body** is internal
  and adds no result: `fn::canvas_removal_summary` is `LET`-then-`RETURN` and answers with one.
  Measured 2026-08-28, because a comment in `002_content.surql` had argued the opposite and was
  shaping how functions there were written.

## Verifying

```sh
vp -C apps/polkadot check
vp -C apps/polkadot build
```

Framework changes also need the package's own check, its 691 tests, and both builds. (The app's own
suite is 215. Both numbers move; if one here is stale, the count in the run output is the truth.)

**Look at it.** This is a design-led product; a passing typecheck says nothing about whether the
thing is good. Open the preview, hover the canvas, drag a window, watch the field react. The one
defect that mattered most in this app's history — every workspace action being silently dropped —
survived a full test suite and died the first time someone loaded the page.

### Writing a source scan, and the way it goes wrong

Several rules here are enforced by tests that read source rather than run it — no Tailwind string in
JSX, every field named, nothing escaping its cascade layer, no timing function inlined. They earn
their place: two of them caught real defects the moment they were written, and one found fields a
runtime walk could not, because those fields render only while a menu is open.

**A scan's first run flagging code you believe is correct is evidence about the scan, not the code.**
Eight were written on 2026-08-27 and four were wrong on their first run — every time by being
incomplete, never by the source being at fault:

- **It knew one spelling of "correct".** A name check demanded `aria-label` and flagged the removal
  dialog, which is named by a visible `<label htmlFor>` — the better mechanism, since the name is on
  screen as well as in the tree. The same check later flagged Base UI's `render={<Button />}`
  composition, where the button is a prop value and the wrapper's children are merged onto it. This
  is the dangerous shape: the obvious response is to "fix" the source, and doing so damages it.
- **A fixed window instead of a real boundary.** Reading 120 characters after a tag to find its props
  cut off the same dialog's `id`, because `id` sorts after `className`. Read to the end of the
  construct.
- **A substring of a longer name.** `transition-duration` matches inside `--icx-transition-duration`,
  so a scan banning inlined timings flagged the token it exists to install. A guard reporting its own
  fix as the defect is worse than no guard.
- **The rendered value where the source interpolates.** Asserting `16px` failed against
  `${BARE_CORNER_PX}px`. Assert the constant's name; that also catches a number being inlined over
  it, which is what you actually care about.

Every scan needs its discrimination tests — one proving it fires on the thing, one proving it does
not fire on each shape that is legitimately different. Those are what caught three of the four
above, and they cost less than the ten minutes spent believing a false positive.

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

**A computed colour here is `oklch(…)`, and its numbers are not RGB.** Every ink and surface token
is authored in oklch and Chrome keeps it that way in `getComputedStyle`, so a probe that pulls the
first three numbers out and treats them as channels computes nonsense from valid input. A contrast
sweep written that way returned 2.28 for every string on the page — colours from lightness 0.55 to
0.96 reporting identical contrast, which is impossible and is the only reason it was caught.
Resolve through a canvas instead, and assert a known pair before believing any of it:

```js
ctx.fillStyle = "#000";
ctx.fillStyle = someComputedColor; // invalid input leaves the previous value
ctx.fillRect(0, 0, 1, 1);
ctx.getImageData(0, 0, 1, 1).data; // real channels
// then: white-on-black must be 21:1, or the instrument is wrong, not the app
```

**The frozen-transition value is not a hover problem — it is an HMR one.** The `oklab(…)`
serialisation described above turned up again on a plain `color`, nothing hovered: after a hot
style swap, elements carrying `transition-colors` reported the _old_ value while the custom
property above them already held the new one. It reads exactly like a token that did not apply, and
two of them survived a re-measure before a full reload resolved every one. **A computed style read
during or shortly after an HMR swap is not the style.** Reload before concluding anything about a
value that changed, and treat an `oklab(…)` serialisation of a colour you authored in oklch as the
tell that you are reading an interpolation rather than a result.

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
