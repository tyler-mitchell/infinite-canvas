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

- **A canvas or project cannot be renamed or archived by an agent.** Both are pointer-only in the
  switchers. `canvas.create` and `project.create` take an optional title, so a caller can name what
  it makes and cannot rename what it already made.

- **Reframe has no surface.** `fn::reframe_saved_view` exists and is driven; nothing calls it.
  Delete-and-re-save covers it, so the capability is whole rather than half-built — but reframe is
  the verb that keeps a name attached to a framing that has drifted.

- **Whether a reversible cut still needs its confirmation dialog.** `disconnectItems` registers its
  own reversal now, so cutting a connection is undoable. Undo is one step and expires when the next
  reversible act replaces it, where the archive list is permanent. Nobody has made this judgement —
  named in `connection-removal-dialog.tsx`.

- **HUD surfaces do not follow the bar's own surface rule.** Window frames separate by light —
  measured at `oklch(0 0 0 / 0.44) 0 2px 4px` plus `oklch(0 0 0 / 0.36) 0 12px 32px`. The library
  rail and the overview sit on `--surface` with a full `inset-ring-1` at `oklch(1 0 0 / 0.07)` and no
  shadow: a ring on four sides rather than a hairline on one, which is nearer the treatment the bar
  forbids than the one it prescribes. That may be a deliberate screen-space versus world-space
  distinction. Nothing writes it down either way.

- **Rich text and code blocks in notes.** Lexical is behind a `{ value, onChange }` boundary and
  mentions have landed. These have not.

- **Two things are confirmed present and correctly weighted, not confirmed good.** Window grain
  measures 8.93/255 mean alpha — the 3.5% intended — and 3.5% noise does not survive a downscaled
  screenshot. The warm ink change is hue-only, so contrast is provably unchanged, but no before-and-
  after comparison was obtainable in the dev pane. Both want an eye on a real display.

- **A write verb answers "done" before it has written.** `AppAction.run` returns
  `string | undefined` synchronously, so every database write in the vocabulary is `void`-ed —
  `void connectItems(...)` is the measured case. Driven: `relation.connect` answered
  "Connect two items done." and `relates_to` was empty; the row appeared a moment later.
  A pointer does not care, because the store updates reactively and a person is looking at the
  screen. A caller with no second source does: it reads back and gets a listing that disagrees with
  what it was just told, several steps from the cause. That is the failure `AppAction.run`'s own
  docstring exists to prevent, and returning the refusal fixed only half of it.
  The fix is to let `run` return a promise and have `app-tools` await it. It wants doing in one
  pass across every write verb — a vocabulary where some verbs await and some do not is worse than
  one where none do, because nothing tells a caller which it is holding.

- **Driving the palette needs JS, and that is worth writing down.** Neither coordinate nor `ref`
  clicks from the browser tooling fire cmdk's `onSelect`, and `Cmd+K` sent as a synthetic key only
  works when a real click has already focused the canvas. Both have working substitutes, found by
  elimination: `element.click()` on a `[cmdk-item]` runs the row, and dispatching a
  `KeyboardEvent("keydown", { key: "k", metaKey: true })` at
  `[data-infinite-canvas-command-scope="surface"]` opens the palette without touching the canvas —
  which matters because clicking empty canvas clears the selection most rows depend on.
  The measurement that separated them: `Select All Windows` clicked by the tool leaves
  `selection.windowIds` empty, while the same row clicked from JS selects both. Two claims were
  filed against the product on the strength of tool clicks and both were false — connect writes
  correctly, and the row fires correctly.

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

| Gap                                                                                                     | Generic affordance                                              |
| ------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| A consumer's verbs reach the keyboard and nothing else: `hotkeyActions` never join contextual discovery | consumer verbs enter the same list the framework's do           |
| A selected scene object carries identity and no geometry, so nothing spatial downstream can act on one  | a bounds provider keyed by selection target, answered on demand |
| The camera frames a target once and cannot follow a moving one                                          | a sustained follow with a release rule                          |
| A selected scene object that no longer exists is never pruned, and `selection` is a durable field       | the same consumer-knowledge surface the rows above want         |

**Three of these are one architectural fact.** The framework's pure surface takes `state`, and
`state` is serializable. Consumer knowledge is not — a consumer's verbs, its objects' bounds, and
whether one of its objects still exists all live in props, as closures. Every gap where the framework
must ask the consumer something lands on that boundary. Storing the answers in state is the tempting
shortcut and is wrong: a rect copied onto a selection target is stale the moment the object moves.
The answer is a lookup the framework can call, not a value it can hold.

**Discovery is the largest and has evidence rather than an argument.** `app-actions.ts` is roughly
1400 lines that exist because the framework has no consumer-verb registry, and it reinvents
description, label, live enablement, an argument schema and a refusal string before
`published-commands.ts` and `model-context.tsx` merge the two vocabularies and police name collisions.
It is not a slice: `InfiniteCanvasContextualCommand` is a `CommandDescriptor` plus `enabled` and
`group`, and a descriptor is keyed on a `command` from the framework's own union, from which `group`
is derived. A consumer verb has a `run` closure and no command, so joining that list means either
widening the union or making it a union of two entry types. Both are real design decisions.
`InfiniteCanvasHotkeyAction` already carries `id`, `label`, `description`, `isEnabled` and `run`.

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
