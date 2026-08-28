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
  produces no obviously broken pixel. Seven instances so far — three cascade-layer, one inline style
  the framework writes, and three found on 2026-08-28: `material.ts` describing a hairline and
  emitting a four-sided ring, the minimap's plate occluding both the fill and the hairline of its
  own frame, and `--icx-header-active` declared twice on one selector so the later won and dropped
  the grain. A screenshot finds none of them. Read the computed value back with `getComputedStyle`
  and compare it against what was declared, once per visual change.
  **Two of the three were duplicates of a property, not a losing cascade.** `awk` over `styles.css`
  for custom properties declared more than once is a cheap sweep and currently reports one survivor,
  `--icx-surface-shadow`, whose two declarations are genuinely different selectors.
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

- **Every document a caller can make, it can now name.** Saved views got both halves — `Reframe a
view` as a menu mode, and `view.save` / `list` / `open` / `reframe` / `remove` as verbs, all five
  driven, with the numbering carried across from the menu's own helper so a verb-saved view and a
  pointer-saved one land in one sequence. `workspace.rename` closed the last gap; driven, and its
  blank refusal matches the rule `useInlineRename` enforces for the pointer.
  What is left pointer-only is deletion, which is the item above, and the two removal _dialogs_,
  which are confirmations rather than capabilities.

- **Reversibility is legible now; whether eight seconds is the right window is not measured.**
  `undoableAction$` existed since archiving became reversible and its only surface was a palette
  row, so the doctrine "no dialog, because it is reversible" rested on a recovery nobody could see.
  `UndoNotice` puts it above the selection rail — driven, archiving surfaced
  `Undo archiving "Untitled 1"` and pressing it put the note back. Eight seconds is a guess nobody
  has watched anyone use, and it is the only number in that surface.
  The cut dialog was decided rather than left open: it stays, because it quotes the claim, and a
  person can reach that act by Backspace or by a palette row with the label nowhere on screen. Undo
  restores the edge only for someone who already knew there was something to restore. Written where
  it applies.

- **Surfaces are one rule now, and the interior is not a defect.** Every inset shadow in the app
  measures `oklch(1 0 0 / 0.07) 0 1px 0 0 inset` — window frames, Polkadot's rails, the framework's
  HUD groups, the minimap. This item twice claimed something that measurement did not support: that
  the rails had _no shadow_ (they carried `--lift-2` throughout; only the hairline was wrong), and
  that a note's body was a flat fill wanting top-down light. The body is `var(--grain),
var(--surface)` — the same material as its frame and its idle header, uniform on purpose.
  Lighting it from within would be decoration, not depth, so nothing here is owed.

- **The note editor is two generations behind Lexical, and nobody had read its docs.** Established
  2026-08-28 by cloning `facebook/lexical` into `reference/` and reading the docs tree. Everything
  below is from the shipped docs rather than from an API listing.

  Rich text is **not** the gap this item used to claim. Typed into a live note: `# ` produced `<h1>`,
  `- ` produced `<ul><li>`, and ` ```js ` produced a `CodeNode`. Headings, lists, links, quotes and
  markdown shortcuts all work.

  **The measured defect.** A code block computes `display: inline` with pill padding — the
  `[&_code]` rule for inline code landing on a code block. Lexical keys `code` and `text.code`
  separately because they are different nodes. `EDITOR_THEME = {}` and styling by tag cannot express
  that. The comment defending the empty theme produced a place that cannot say what the editor says.

  **Theme keys nobody knew existed**, from the theming doc: `list.olDepth` (per-depth ordered
  markers), `list.nested.listitem`, `listitemChecked` / `Unchecked`, `hr` / `hrSelected`,
  `blockCursor`, `text.highlight`, `text.capitalize` / `lowercase` / `uppercase`, `codeHighlight`
  (a Prism token map), `tableSelection`.

  **`@lexical/tailwind` exists** (experimental) and answers the 804-char class string directly: it is
  a theme whose values _are_ Tailwind class strings, keyed per node. That is the shape ours should
  take — node-keyed, not tag-keyed — and it keeps one place deciding what a note looks like.

  **`MentionNode` is the documented "before" example.** The nodes doc says outright that on v0.26+
  you should prefer `NodeState` to properties on subclasses. `$config()` with
  `stateConfigs: [{flat: true, stateConfig}]` gives byte-identical wire JSON with no hand-written
  `clone` / `importJSON` / `exportJSON` / `updateFromJSON` — ours has all four plus `__noteId`. The
  doc recommends ArkType for the `parse` function, which this repo already uses. The migration
  guide's Keyword example is the same shape as our mention (TextNode, `isTextEntity`,
  `canInsertTextBefore`), and its all-in version drops React entirely via `registerLexicalTextEntity`
  from `@lexical/text`. It also moves the class name into extension `config`, which gets the
  hardcoded Tailwind string out of `mention-node.ts`'s `createDOM` — a `tv`-slot violation that had
  no fix until now.

  **Highlighting moved packages.** `registerCodeHighlighting`, `PrismTokenizer` and the language
  helpers are deprecated at 0.49. It is `CodePrismExtension` (`@lexical/code-prism`) or
  `CodeShikiExtension` (`@lexical/code-shiki`) now, neither installed.

  **Markdown: do not move yet.** `@lexical/mdast` is spec-compliant CommonMark+GFM with one grammar
  shared by import and typing shortcuts, and syntax preserved through `NodeState`. The doc is
  explicit that `@lexical/markdown` remains the supported default for apps not tracking an
  experimental API, and mdast costs ~26 kB. Track it; do not adopt it.

  **The Extension API supersedes `LexicalComposer`.** The docs and Lexical's own `AGENTS.md` both say
  migrate. `defineExtension` and `configExtension` are in `lexical` core, so no new dependency.
  Installed at 0.49: `RichTextExtension`, `ListExtension`, `CheckListExtension`, `LinkExtension`,
  `AutoLinkExtension`, `ClickableLinkExtension`, `CodeExtension`, `CodeIndentExtension`,
  `HistoryExtension`, `TabIndentationExtension`, `LexicalExtensionComposer`. The migration guide's
  minimal form is a drop-in: `LexicalExtensionComposer` with `contentEditable={null}` and every
  existing plugin still a child. Extensions also carry `conflictsWith`, optional `peerDependencies`,
  and `config` / `build` / `register` / `afterRegistration` phases.

  **Packages worth evaluating that we do not use.** `@lexical/a11y` — `FocusManagerExtension`
  (Alt+F10 to a toolbar, Escape back), `RovingTabIndexExtension`, `AriaLiveRegionExtension`,
  `HistoryAnnounceExtension`; a canvas of floating editors has real focus-management needs and none
  of this is built. `SelectBlockExtension` — Cmd+A selects the nearest block first and the document
  on a second press, which matters in a note living inside a canvas that has its own select-all.
  `ClickAfterLastBlockExtension`, `EditorStateExtension` (a signal instead of `OnChangePlugin`),
  `RootElementExtension`, `WatchEditableExtension`, `IMEExtension`. `@lexical/headless` may replace
  `note-text.ts`, which hand-parses serialized JSON structurally. `@lexical/eslint-plugin` lints
  `$`-function misuse.

  **Correctness notes from the concepts docs, unverified against our code.** Nested updates are
  "very strongly discouraged" and run deferred. `editor.read` takes
  `'force-commit' | 'pending' | 'latest'` and the default is not always what a reader wants. A text
  node must never contain `'\n'` — that is `LineBreakNode`, which `note-text.ts`'s block-type split
  should be checked against.

  Order: theme keys first — fixes the code block, reversible, no new dependency. Then
  `LexicalExtensionComposer` in its minimal form, which the guide shows as a drop-in. Then
  dependencies one at a time. Then `MentionNode` onto `$config` + `NodeState`. Highlighting last,
  since it needs a package that is not installed.

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

- **The offscreen chips shipped tuned by one look.** Peripheral by design and deliberately quiet;
  nobody has watched anyone use them. The minimap's half of this is closed: close-and-reopen is
  witnessed at 1440x900 — the map goes, `Show the map` takes its place, reopening restores it with
  its plate and hairline intact, and the framework's zoom rail top stays at 113px from the bottom
  across the toggle, so "reserves no band" holds through a real one. `docs/API.md` had already moved
  `minimap` off _unobserved_ on 2026-08-26; this item was stale on that half too.

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
