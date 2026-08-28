# Polkadot roadmap

Polkadot is a spatial workbench on `@hyphened/infinite-canvas`. It is a real product — local-first,
open source — and the framework's incubator, where a missing affordance shows up as something a real
app cannot do.

**One rule.** A gap Polkadot finds is fixed in the framework generically, or not in the framework at
all. `renderBackdrop` exists because the affordance is "replace the ground", which is
product-neutral. A `dotField` prop would have been the same feature and the wrong one.

## Pacing

Every item below is a sprint, not a checkbox. A session delivers one properly or none. Three
delivered badly is worse than none — a half-built surface reads as finished, so nobody revisits it
and the next person builds on a foundation that was never poured. This has happened twice here: the
dot field was written in one pass and had to be deleted, and the first design pass was a token swap
presented as an identity. The cost was not the wasted time, it was that the slot looked occupied.

## The bar

Not "a working canvas app". The reference points are Linear, Raycast, and Arc. Enforced in review:

- **Depth from light, never lines.** No `border: 1px solid white/8%`. Surfaces separate by being
  lighter than the ground, casting a layered shadow, and carrying a specular hairline on the top
  edge.
- **Warm ink on a cool ground.** Pure grey on pure black is the default nobody chose.
- **Motion has weight.** Springs, not linear ramps. `--ease-settle` and `--ease-swift` exist so this
  is not decided per site. Spatial motion uses springs, not CSS transitions.
- **The ground is alive.** The dot field responds to the pointer and is displaced by windows.
  **Not currently met** — see the open item below.
- **Every class comes from a `tv` slot.** No Tailwind strings in JSX. Global CSS is tokens, resets
  and imports only, and every rule lives inside a layer. Only `:root` is exempt.
- **Every declaration must be shown to win.** This app's most expensive defect class is a
  declaration that is present, generated, and never wins. It emits no error, fails no typecheck, and
  produces no obviously broken pixel. Four instances so far — three cascade-layer, one inline style
  the framework writes. A screenshot finds none of them. Read the computed value back with
  `getComputedStyle` and compare it against what was declared, once per visual change.
- **Nothing hand-rolled that a maintained library owns.** TanStack (Router, Pacer, Hotkeys, Form,
  Virtual, DB), Base UI, cmdk, ArkType, Legend State, motion, tailwind-variants.

Swept 2026-08-28: every arbitrary `text-[Npx]`, `justify-*` and `font-*` compared against its
computed value, zero mismatches. Semantic zoom driven at its boundary the same day and it holds.

**A new window kind that declares a summary must set a minimum short axis above 160.** The detail
band is `summaryBelowPx: 120` / `fullAbovePx: 160` on the smaller on-screen axis, and restore is
strictly greater than 160 — a kind sitting exactly on it demotes and never returns. `note` and
`collection` use 200 and 220. `link` and `image` declare no summary, which leaves the lane inert.

## Open

- **The living field.** Built in `canvas/field.tsx` and deliberately unmounted —
  `workspace-canvas.tsx` passes no `renderBackdrop`, so the app runs on the framework's default
  grid. The three known costs were fixed (idle gate at 0 draw calls at rest, one rect walk, one
  device pixel per CSS pixel), and it went off again at the owner's call on two grounds: those
  numbers came from the dev browser pane rather than the real display, and the field belongs in the
  compositor the scene layer is heading toward rather than bolted to the backdrop slot.
  **Remounting is the owner's decision, not a defect to fix.** The code runs — a shader import throw
  was fixed and the pipeline was built in a real browser.
  Two things are unfinished in the field itself, whenever it comes back: the lattice ignores zoom
  entirely — spacing is screen-space and only the phase follows the camera, so the ground never gets
  finer and the field has no sense of scale — and a window being dragged should pull harder than one
  at rest, for which the rect velocities are already computed and unused.

- **Agent confirmation for consequential WebMCP calls.** The spec has no `destructiveHint` and no
  elicitation mechanism, so `selection.close` and `canvas.describe` are indistinguishable to a
  caller. This app renders third-party content and registers verbs that close windows. That pairing
  wants a decision before any agent beyond a developer's own DevTools client is pointed at it.
  Still unverified: the declarative (`<form>`-annotation) half of WebMCP, cross-origin `exposedTo`,
  and behaviour under a real browser-integrated agent.

- **Deleting a canvas or project is still pointer-only, and should stay that way for now.**
  Archiving landed: `canvas.archive` / `restore` / `listArchived` and the project triple, driven end
  to end. The database had all six since the switchers were built; only the verbs were missing.
  Delete is the other half and is genuinely destructive — `deleteProject` cascades and destroys
  writing, which is why its surface asks for the project's name to be typed. A verb has no
  equivalent of typing a name, and WebMCP has no elicitation mechanism to build one, so this is
  blocked on the confirmation item above rather than on effort.

- **Reframe has no surface.** `fn::reframe_saved_view` exists and is driven; nothing calls it.
  Delete-and-re-save covers it, so the capability is whole rather than half-built — but reframe is
  the verb that keeps a name attached to a framing that has drifted.

- **Whether a reversible cut still needs its confirmation dialog.** `disconnectItems` registers its
  own reversal now, so cutting a connection is undoable. Undo is one step and expires when the next
  reversible act replaces it, where the archive list is permanent. Nobody has made this judgement —
  named in `connection-removal-dialog.tsx`.

- **The light on a note's own body is flat.** Fixed the surfaces: every inset shadow in the app now
  measures `oklch(1 0 0 / 0.07) 0 1px 0 0 inset`, one rule across window frames, Polkadot's rails
  and the framework's HUD groups. The claim this item used to make — that the rails had _no shadow_
  — was wrong; they carried `--lift-2` all along, and the defect was only the hairline being a
  four-sided ring, which `material.ts` had described correctly and emitted incorrectly since it was
  written. What remains unexamined is the interior: a note body is one flat fill from title to
  bottom edge, where the bar's own logic would give it the same top-down light its frame has.

- **Rich text and code blocks in notes.** Lexical is behind a `{ value, onChange }` boundary and
  mentions have landed. These have not.

- **Two things are confirmed present and correctly weighted, not confirmed good.** Window grain
  measures 8.93/255 mean alpha — the 3.5% intended — and 3.5% noise does not survive a downscaled
  screenshot. The warm ink change is hue-only, so contrast is provably unchanged, but no before-and-
  after comparison was obtainable in the dev pane. Both want an eye on a real display.

- **Writes cannot be asserted outside a browser.** The WASM engine does not start under `vp test` —
  `connect("mem://")` hangs rather than rejecting, and the non-worker engine rules out the Worker as
  the cause. Recorded as a skipped test in `database/in-memory-engine.test.ts`. The refusal suite's
  own comment used to claim a `void`ed write "fails harmlessly against an engine no test starts";
  it did not fail, it dangled forever, and the suite called that passing. Node tests assert
  decisions and rules; a write is a browser's question.

- **Two HUD surfaces shipped tuned by one look.** The offscreen chips are peripheral by design and
  deliberately quiet; nobody has watched anyone use them. And the minimap's close-and-reopen was
  never witnessed — the app remounted under another session's HMR reload mid-click. `docs/API.md`
  should also move `minimap` off _unobserved_ now that it is drawn, which is the framework's edit.

- **An occluded connector is effectively unselectable on the canvas.** Two windows that nearly touch
  hide almost all of the line between them; windows resolve before edges, which is correct. At one
  measured arrangement the exposed run was 30px with its midpoint inside a window. The marker anchors
  on the longest clear run or draws nothing. **This is a decision, not a gap** — the rail lists every
  connection whether or not either end is open and cuts it in one click. Inventing a hit area that
  floats free of the line would be drawing something that is not there.

## Framework gaps

The list is the incubator's output. Landed rows live in `docs/API.md` and the changelog; these are
the open ones.

| Gap                                                                                                    | Generic affordance                                              |
| ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------- |
| A selected scene object carries identity and no geometry, so nothing spatial downstream can act on one | a bounds provider keyed by selection target, answered on demand |
| The camera frames a target once and cannot follow a moving one                                         | a sustained follow with a release rule                          |
| A selected scene object that no longer exists is never pruned, and `selection` is a durable field      | the same consumer-knowledge surface the rows above want         |

**Both remaining rows are one architectural fact.** The framework's pure surface takes `state`, and
`state` is serializable. Consumer knowledge is not — an object's bounds and whether it still exists
both live in props, as closures. Every gap where the framework must ask the consumer something lands
on that boundary. Storing the answers in state is the tempting shortcut and is wrong: a rect copied
onto a selection target is stale the moment the object moves. The answer is a lookup the framework
can call, not a value it can hold.

**Discovery landed and is the worked example.** `getInfiniteCanvasContextualEntries` merges both
vocabularies into one uniform list with a bound `run`, so a consumer verb reaches contextual
discovery without widening the command union. The shape that made it work: the framework's own verbs
keep `group`, a consumer verb has none, and the merge — not the caller — decides what `run` means.
Callers branch on nothing. `published-commands.ts` is now the filter it was always meant to be.
What it did **not** do is shrink `app-actions.ts`, which is still ~1400 lines: the argument schema
and the refusal string are this app's own, and no framework affordance is asking for them.

**Bounds is cheaper than it looks and is still not being built.**
`createInfiniteCanvasEdgeTargetResolver` and `…SceneObjectTargetResolver` take a `targets` source
whose entries carry their own geometry, and both real consumers supply it reading nothing but state —
so the framework can already enumerate every registered target's geometry. The only blocker is that
the source's context type demands a pointer position no consumer uses. The concrete need is one
command: select a connector, press fit-selection, nothing happens. Nobody has reported it. Building
an enumeration API so the minimap and the offscreen ring could consume it later is speculative
machinery. It gets built when a second consumer needs it.

**Existence: the framework prunes what it can verify and keeps what it cannot.** A selection target
naming nothing survives `normalizeSelection` and a hydrate round trip, while a dead window id in the
same selection is dropped. Polkadot is not exposed — every reader of edge selection resolves target
ids against live relations, so a dead one contributes nothing. Derive on read.

## Later, deliberately

- **Tours.** `getInfiniteCanvasWorldPath` and `…PointAtProgress` are built for guided paths. Nothing
  consumes them.
- **The 3D layer.** Window proxies and frustum culling exist behind `/scene`. Far-zoom overview is
  the honest use, not decoration.
- **Sync.** Local-first is the whole product until it is not. SurrealDB is the choice when it becomes
  a real need.
