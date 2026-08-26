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
