# Polkadot backlog

Captured work, enriched past the one-line version so it can be picked up cold. Nothing here is in
flight — `ROADMAP.md` holds what is being built now, and `docs/research/spikes.md` holds
investigations whose outcome is a decision rather than a feature.

---

## feature: mentions, via Lexical

Type `@` in a note and reach for another note. The mention renders inline as a live chip carrying
the referenced note's current title, and following it navigates the canvas to that note.

**Why this is the keystone feature rather than a nicety.** Polkadot's schema already models
`relates_to` as a typed `RELATION IN content_item OUT content_item` with `kind` and `label`. A
mention is the most natural way a person creates one of those edges — you do not stop writing to
draw a line, you just refer to the thing. That means mentions are the authoring surface for the
knowledge graph, and connectors on the canvas become the _visualisation_ of the same edges rather
than a separate feature with its own model.

**Why Lexical makes this right**, and part of why it was chosen over Tiptap: a mention is a
`DecoratorNode` — arbitrary React rendered inside the document. The chip can subscribe to the
referenced note and re-render when its title changes, which a serialized text token cannot do.
`@lexical/react/LexicalTypeaheadMenuPlugin` supplies the trigger, query, and keyboard handling, so
the typeahead is composed rather than written.

**Shape**

- `MentionNode extends DecoratorNode<ReactNode>` holding the `content_item` record id, never the
  title — the title is looked up, so renames propagate and a stale copy is impossible.
- `MentionsPlugin` on `LexicalTypeaheadMenuPlugin`, querying `fn::list_notes` filtered by
  `search_text`, which already exists and is already lowercased on write.
- Selecting a result writes the `relates_to` edge as well as inserting the node, so the graph and
  the prose never disagree.
- Deleting the node removes the edge. This is the part most implementations get wrong.

**The trap to plan for.** The typeahead is a floating surface inside a `transform: scale()`
subtree, so it will resolve `position: fixed` against the scaled window frame and land in the
wrong place at the wrong size. It must mount through `InfiniteCanvasPortal` with `scope="window"`,
which exists precisely for this. Do not discover this by building it twice.

**Open questions**

- Creating a note that does not exist yet from the typeahead ("＋ New note called …"), which is
  where this becomes a thinking tool rather than a linking tool.
- Whether a mention should also be creatable _from_ the canvas — dragging one window onto another
  — and if so, whether both paths produce the same edge.
- Whether mentioning implies a spatial relationship the layout should reflect, or stays purely
  semantic. Probably semantic; a canvas that rearranges itself when you type is hostile.

---

## feature: paste an image, as a canvas primitive

Paste or drop an image and get a first-class object on the canvas — not an `<img>` dropped into
prose.

**Why a primitive rather than an inline image.** An image on a spatial canvas wants things prose
images do not: its own rect that survives independently of any note, a natural aspect ratio the
resize should respect, a caption, and the ability to be the _subject_ of a mention or a connector.
Rendering it inside a note's paragraph flow forecloses all of that, and converting later means
migrating content.

So: an `image` window kind alongside `note`, backed by a `content_item` with `kind: "image"`. The
window registry already types payloads per kind, so this costs no new machinery.

**Storage.** SurrealDB 3 has `DEFINE BUCKET` and file values, which is the native answer and keeps
bytes out of the layout document. The fallback — base64 in the record — is not acceptable past a
few hundred kilobytes and would bloat every canvas read. Worth checking what the vendored 3.0.4
WASM build actually supports before committing, since buckets are one of the drift-sensitive
SurrealDB 3 surfaces.

**Shape**

- Paste and drop both land in the same place. The framework already owns drop:
  `getInfiniteCanvasDropPlacement` gives pointer-anchored, snap-integrated placement, and
  `dropPolicy.placement` makes the preview show the real landing size. Paste has no pointer, so it
  uses `getInfiniteCanvasWindowPlacementRect` against the visible rect, like `New note`.
- Initial rect derives from the image's intrinsic aspect ratio, clamped to a sane maximum, so a
  4000px screenshot does not arrive filling the world.
- `minSize` and resize should preserve aspect by default, with a modifier to override. **This may
  be a framework gap** — window resize is currently free-form, and "this window has an intrinsic
  aspect ratio" is a generic property, not a Polkadot one. Check before building it locally.
- A summary rendering for far zoom: the framework swaps to `renderSummary` below the detail
  threshold, and an image's summary should be the image itself, downscaled — which is the one case
  where the summary is _more_ faithful than the body, not less.

**Open questions**

- Whether pasting into an open note should embed inline instead, and how the user chooses. Likely:
  pasting with a caret in prose embeds, pasting onto the canvas creates a primitive.
- Whether an image primitive and a note should be the same record kind with different content, or
  genuinely different kinds. Different kinds, most likely — their editors share nothing.
- Cropping, and whether it is destructive.

---

## feature: projects

More than one workbench. A project is the top-level container: its own canvases, its own content,
its own graph.

**It is already half-modelled.** The schema has a `project` table, and `canvas_document` and
`content_item` both carry a `project` record link with an index on it. Everything today hardcodes
`project:default` and `canvas_document:main`. So this is less "build a feature" than "stop
pretending there is one of everything", which is why it should happen before too much code assumes
the singleton.

**Why it matters beyond organisation.** A project is the natural unit of the things a product
eventually needs: export, import, share, archive, and — if sync ever happens — sync. Every one of
those is painful to add later against a schema that assumed one project, and nearly free against
one that did not. The schema already got this right; the app has not caught up.

**Where it collides with canvas routing**, which is being designed now and should account for it:

- The route is `/p/$projectId/c/$canvasId/…`, not `/c/$canvasId`. Deciding that now costs nothing
  and avoids a migration of every link.
- Switching projects is a _different_ motion from switching workspaces. A workspace switch is a
  filter on one canvas and keeps the camera; a project switch tears down the canvas store, the note
  store, and the persistence loop and builds new ones. They should not look alike in the UI, and
  the HUD should make the difference legible.
- Projects need a picker, and it should not be a dropdown in a corner. This is a candidate for the
  first _real_ use of a command surface — `Mod+P` over projects and canvases, the way an editor
  switches workspaces.

**Shape**

- `fn::list_projects`, `fn::create_project`, `fn::open_canvas($project, $canvasId)` replacing the
  hardcoded `fn::open_default_canvas`.
- The note store is keyed by record id and needs no change; the records already carry `project`.
- Deleting a project must be a real decision — archive first (`archived_at` already exists on all
  three tables and nothing reads it yet), destructive delete behind a confirmation that names what
  is being destroyed.

**Open questions**

- Whether a canvas belongs to exactly one project. The schema says yes; a "reference this canvas
  from another project" wish would break that and should be resisted early.
- Whether content can be shared across projects. The `relates_to` relation is `IN content_item OUT
content_item` with no project constraint, so cross-project edges are currently _possible_ and
  probably should not be.
- What the empty state is. A workbench with no projects is the true first-run experience and it is
  currently unimagined.

---

## bug: resize handle hit area is too small

Reported from use: "I can barely hover over them to drag to resize."

**Diagnosed, not fixed.** `resizeHandleSize` is 16 and the handle straddles the frame edge
(`RESIZE_HANDLE_OVERHANG = extent / -2`), so the whole grab target is 8px outside the window and
8px inside — the bottom of what a pointer reliably hits. Two things compound it: edge handles are
inset by a full extent at each end so corners can own the corners, and the window surface now has
a 12px radius, so near a corner the visible edge curves away from the square handle and the aim
point diverges from the target exactly where the target is smallest.

**Why this is not a one-number change.** Raising the size symmetrically steals from the header's
drag area — a spatial-target test caught that immediately. The right shape is to weight the band
_outward_: outside the window is empty canvas nothing else claims, inside competes with the header
and the body, and a pointer approaches an edge from outside anyway.

**And the reason that alone is not enough:** the rendered handle geometry
(`RESIZE_HANDLE_DESCRIPTORS` in `window-frame.tsx`, expressed in CSS) and the hit classification
(`getWindowResizeHandleAtPoint` in `spatial-target.ts`, computed in TypeScript) are **two separate
implementations of the same geometry**. Changing the CSS overhang did not move the classification
at all. Any real fix has to make one of them the source of truth, which is a framework change with
its own tests — a sprint, not a drive-by.

---

## feature: command prompt / launcher bar (cmdk)

`Mod+K`. The full canvas vocabulary, plus content, in one surface.

**Most of it already exists and must not be rebuilt.**
`getInfiniteCanvasContextualCommands` returns the commands with their labels, descriptions,
groups, hotkeys, and — critically — their _enablement_ for the current state.
`getAvailableInfiniteCanvasContextualCommands` returns only the enabled ones. The framework owns
the vocabulary; the launcher renders it. Restating any of that here creates a second source of
truth that drifts, which the playground palette already proves unnecessary — it is built entirely
on these and gets new commands for free.

`cmdk` supplies filtering, roving selection, and grouping. Base UI supplies the dialog, focus
trap, and restore. Both are already project dependencies and neither should be hand-rolled.

**What makes it _spatial_ rather than a generic palette**, and the reason this is worth doing
properly: results are not only commands. Searching should also return notes, and choosing one
should **navigate the camera to it** rather than open a dialog — `navigateCameraToWindow` and
`getCameraNavigationFrame` exist for this. A launcher that can only run commands is half the
feature; the half that matters on an infinite canvas is _going somewhere_.

**Shape**

- One surface, three result kinds: commands (from the framework), notes (from `fn::list_notes`,
  which already lowercases `search_text` on write), and navigation targets (windows, workspaces).
- Enablement comes from the framework. Disabled commands stay visible and dimmed rather than being
  filtered out, so the vocabulary is discoverable rather than appearing to change.
- Closing must return focus to the canvas command surface via
  `focusInfiniteCanvasCommandSurface`, or every hotkey silently stops working — the framework
  documents this trap and Base UI's focus restore does not know about it.
- `Mod+P` for projects and canvases later, once projects exist.

---

## refactor: one ordered writer, not two

`canvas-persistence.ts` and `note-store.ts` each hand-compose the same three parts:

1. `Debouncer` to collapse a burst — a drag, a sentence — into one write.
2. `AsyncQueuer` at concurrency one to keep writes **ordered**.
3. A revision-guarded save, with the returned revision folded back.

Step 2 is the one that is easy to omit and expensive to get wrong. Both stores guard writes with a
revision, so two saves in flight together race: the second reads a revision the first has not yet
incremented and the database rejects it as a conflict on a change the same user just made.
Ordering is what makes optimistic concurrency usable instead of a source of spurious conflicts —
and it is currently asserted twice, by hand, in two files.

TanStack Pacer ships `Debouncer` and `AsyncQueuer` separately and has no combined primitive, so
composing them is genuinely ours. Two concrete call sites is the threshold where extracting is
consolidation rather than speculation.

**Shape:** `createOrderedWriter({ save, wait, onError, onStarted, onSettled })` returning
`{ write, stop }`. Reading and folding the revision stays inside each caller's `save` — the canvas
holds its revision in a closure, a note reads its own from the store, and pulling that in would be
abstracting over the difference rather than the shared mechanism.

**Status:** written once during an unrelated correction and removed rather than landed, because it
was started mid-course-correction. The duplication is real and still there.

---

## spike: an icon set that is not `lucide-react`

Lucide is the default in every shadcn-derived product, which makes it invisible in the wrong way:
it reads as "a React app" rather than as this product. The ask is a set that carries some
identity of its own.

**What the canvas actually needs from icons**, which narrows the field more than coverage counts do:

- **State expression.** Half the HUD verbs are toggles — pinned, locked, snapped, minimized. A set
  with a paired line/fill weight expresses those states with the same glyph instead of two
  different glyphs, which is the difference between reading a rail and decoding it. Lucide has
  effectively one weight, so today `Pin` looks the same pinned or not.
- **Optical size at 14px.** HUD glyphs render at 14px on a dark, blurred surface. Sets drawn on a
  24px grid with 1.5px strokes go muddy there; sets with a small-size variant do not.
- **Spatial vocabulary.** Align, distribute, group, fit, layer, and lasso are unusual verbs. Most
  sets cover them thinly.

**Candidates, in the order they are worth trying:**

1. **Phosphor** (`@phosphor-icons/react`) — six weights including `fill` and `duotone`, ~9,000
   glyphs, per-icon ESM. The weight axis is the reason it leads: `<Pin weight={pinned ? "fill" :
"regular"} />` is one component expressing a state. Visually distinct from Lucide.
2. **Solar** or **Iconoir** via `unplugin-icons` — compiled to inline SVG at build time, so no
   runtime and no bundle cost per set. Lets several sets be trialled without committing.
3. **Untitled UI icons** — drawn for product UI at small sizes specifically.

Explicitly not: **Tabler** and **Feather**, which share Lucide's 24px/2px stroke lineage and would
be a lateral move.

**Migration surface is small and now is the cheap moment:** eight glyphs across two files
(`Plus`, `AlignStartVertical`, `AlignHorizontalSpaceAround`, `Pin`, `Scan`, `Trash2`,
`TriangleAlert`, `X`).

**Framework-first question that has to be answered first (icons):** `InfiniteCanvasHud` renders its own
zoom and camera controls, and if it ships its own glyphs then a product-side set change produces a
canvas with two icon languages on it. Check what the framework draws before choosing. If it does
ship glyphs, the generic fix is for the framework to accept icon slots rather than for Polkadot to
match whatever the framework happens to use — a framework should not dictate a consumer's icon
set. That is the real framework gap this spike is likely to surface.

---

## feature: code blocks with syntax highlighting

**Editing and displaying code are different problems, and the answer is probably both engines.**

`@lexical/code` is already a dependency and already ships `CodeNode`, `CodeHighlightNode`, and a
Prism tokenizer wired for **incremental** re-highlighting on keystroke. That incremental property
is the whole reason it exists: re-tokenizing a whole block per character is what makes naive
editor highlighting janky. Replacing it wholesale with Shiki means reimplementing that, which is
the expensive half.

Shiki's advantage is fidelity — TextMate grammars and real VS Code themes, so a block looks the
way the same code looks in an editor rather than approximately. That matters most where the text
is _read_, not typed: the far-zoom summary rendering, and eventually export.

**Likely shape:** keep `@lexical/code`'s Prism tokenizer for the live editing surface, add Shiki
for read-only rendering. Revisit only if the two look different enough to be jarring.

**Constraints that will decide the integration:**

- **No second WASM blob on the critical path.** The app already loads an 11 MB SurrealDB engine.
  Use `shiki/core` with `createHighlighterCore`, explicit language and theme imports, and the
  **JavaScript RegExp engine** (`createJavaScriptRegexEngine`) rather than the Oniguruma WASM one.
  The full `shiki` bundle imports every grammar and is not an option.
- **Theme must come from the design tokens.** Shiki's `cssVariables` theme emits `var(--shiki-…)`
  rather than baked hex, so colours resolve from `styles.css` and there is still one source of
  colour. A hardcoded VS Code theme next to an oklch palette will look foreign.
- Language loading should be lazy and per-language, since a note might contain one TypeScript
  block and nothing else.

---

## spike: a maximalist Lexical composer to read and borrow from

**Start with `facebook/lexical` → `packages/lexical-playground`.** It is the most complete Lexical
implementation that exists, maintained by the team that maintains Lexical, and it already contains
nearly everything on this backlog: mentions with a typeahead, tables, images with resizing, code
blocks, equations, polls, sticky notes, comments, collaborative editing, and a floating format
toolbar. When a Lexical question has a good answer, it is usually demonstrated there first.

**The most serious production integration outside Meta is Payload CMS**
(`payloadcms/payload`, `packages/richtext-lexical`). Worth reading for a different reason: it
solves _packaging_ — a plugin/feature architecture where nodes, toolbar entries, and serialization
travel together, plus server-side schema for the editor state. That is the shape a long-lived
integration needs and the playground deliberately does not have.

**For mentions specifically**, `lexical-beautiful-mentions` is a focused, maintained
implementation and is directly relevant to the mentions item above.

**What to actually borrow:**

- The node registry and plugin composition shape — how nodes, commands, and toolbar state are
  registered together rather than scattered.
- Toolbar state derivation from `$getSelection`, which almost everyone re-derives badly.
- Floating-toolbar and typeahead anchor positioning. Relevant here beyond the usual, because our
  editors live inside a `transform: scale()` subtree and must portal through
  `InfiniteCanvasPortal` — see the trap noted under mentions.

**What not to borrow:** the playground is a demo application. Its state management, styling, and
app shell are not production patterns. Take the editor architecture, not the surroundings.
