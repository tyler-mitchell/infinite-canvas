# Polkadot backlog

This file gives enough detail to start each backlog item without prior session context.
No item in this file is in progress.
`ROADMAP.md` contains current implementation work.
`docs/research/spikes.md` contains investigations that produce decisions instead of features.

---

## feature: mentions, via Lexical

Type `@` in a note to find another note.
The editor shows the mention as an inline live chip with the current target title.
Following the chip moves the canvas to the target note.

The schema defines `relates_to` as a typed `RELATION IN content_item OUT content_item`.
The relation also contains `kind` and `label`.

A mention creates this edge while the user writes a reference.
Canvas connectors display the same stored edges.
As a result, mentions and connectors use one knowledge-graph model.

This capability was one reason for the selection of Lexical instead of Tiptap.
A mention is a `DecoratorNode`, which can render arbitrary React content inside the document.
The chip can subscribe to its target note and change after a title rename.
A serialized text token cannot provide that live title.

`@lexical/react/LexicalTypeaheadMenuPlugin` provides the trigger, query, and keyboard behavior.
The application composes the plugin instead of implementing this interaction.

- `MentionNode extends DecoratorNode<ReactNode>` stores the `content_item` record ID.
  It does not store the title.
  A title lookup makes renames visible and prevents a stale copy.
- `MentionsPlugin` uses `LexicalTypeaheadMenuPlugin`.
  It queries `fn::list_notes` through the existing `search_text` filter.
  Writes already store that field in lowercase.
- Selection inserts the node and writes the `relates_to` edge.
  This operation keeps the graph and prose consistent.
- Node deletion removes the edge.
  Many mention implementations omit this removal.

The typeahead is inside a `transform: scale()` subtree.
As a result, `position: fixed` uses the scaled window frame and produces an incorrect position and size.

Mount the typeahead through `InfiniteCanvasPortal` with `scope="window"`.
This portal exists for this transformed-window case.

- Decide whether the typeahead can create a missing note through "＋ New note called …".
  This action changes the feature from linking to content creation.
- Decide whether dragging one canvas window onto another can create a mention.
  If both paths exist, they must produce the same edge.
- Decide whether a mention changes layout or remains semantic.
  The current preference is semantic because typing must not rearrange the canvas.

---

## feature: paste an image, as a canvas primitive

Paste or drop an image to create a first-class canvas object.
This object is separate from an `<img>` inside note prose.

A canvas image needs a durable rectangle that exists independently of a note.
It also needs an intrinsic aspect ratio, a caption, and its own relation identity.
The image can then become the subject of a mention or connector.

An inline prose image does not provide these capabilities.
A later conversion from inline content requires a content migration.

Add an `image` window kind beside `note`.
Store it as a `content_item` with `kind: "image"`.
The existing window registry already types each kind payload, so no new registry mechanism is necessary.

SurrealDB 3 provides `DEFINE BUCKET` and file values.
This native storage keeps image bytes outside the layout document.

Base64 inside the record is not permitted for files larger than a few hundred kilobytes.
It increases the size of every canvas read.

Before implementation, examine bucket support in the vendored SurrealDB 3.0.4 WASM build.
Bucket support is a release-sensitive SurrealDB 3 capability.

- Paste and drop use the same destination rule.
  The framework owns drop placement.
  `getInfiniteCanvasDropPlacement` provides pointer-anchored placement with snap support.
  `dropPolicy.placement` gives the preview its actual destination size.
  Paste has no pointer.
  It uses `getInfiniteCanvasWindowPlacementRect` against the visible rectangle, as `New note` does.
- The first rectangle uses the intrinsic image aspect ratio.
  A maximum size prevents a 4000px screenshot from filling the world.
- `minSize` and resize preserve the aspect ratio by default.
  A modifier permits a free-form resize.
  This behavior can require a framework change because current resize is free-form.
  "this window has an intrinsic aspect ratio" describes a generic window property.
  Examine the framework before a product-local implementation.
- At far zoom, the framework replaces the body with `renderSummary`.
  The image summary is a downscaled copy of the image.
  In this case, the summary represents the source more accurately than the body.

- Decide whether paste at an active note caret creates an inline image.
  The current preference uses the caret for inline paste and the canvas for an image object.
- Decide whether notes and images use one record kind or different record kinds.
  The current preference uses different kinds because the two editors share nothing.
- Decide whether cropping changes the source image.

---

## feature: projects

A project is the top-level workbench container.
It owns canvases, content, and a graph.

The schema already contains a `project` table.
Both `canvas_document` and `content_item` contain an indexed `project` record link.
The current application hardcodes `project:default` and `canvas_document:main`.

This work is less "build a feature" and more removal of singleton assumptions.
The schema already defines the required model.
Its purpose is to "stop pretending there is one of everything".
This change must occur before more product code depends on one project and one canvas.

A project is the unit for export, import, sharing, archive, and possible future sync.
These capabilities become difficult when a schema assumes one project.
The current schema already supports multiple projects, but the application does not use that support fully.

The rejected route was `/p/$projectId/c/$canvasId/…` instead of `/c/$canvasId`.
The accepted route is `/canvas/$canvasId`.

Each canvas belongs to exactly one project.
As a result, the project segment is data that the canvas record already provides.
A project segment in the address can contradict the canvas record.
It adds validation and a mismatch failure without reducing the current migration.

`fn::open_canvas` returns the project with the canvas.
The shell can then name both records.

A workspace change filters one canvas and preserves the camera.
A project change removes the canvas store, note store, and persistence loop.
It then constructs replacements for the new project.

The UI must show these changes as different operations.
The HUD must make the active scope clear.

Projects need a dedicated picker instead of a corner dropdown.
`Mod+P` over projects and canvases is a candidate command surface, similar to an editor workspace switcher.

The application includes these project operations:

- `fn::list_projects`.
- `fn::create_project`.
- `fn::rename_project`.
- Project-scoped `fn::list_canvases`.
- Project-scoped `fn::list_archived_canvases`.
- A project switcher on the brand mark.

Project creation also creates its first canvas.
The application addresses canvases directly, so a project without a canvas is unreachable.

Project archive and deletion remain separate because deletion requires a cascade decision.
A project owns canvases and `content_item` records.
Deletion must either remove the notes or leave them without a project.
This data-retention decision does not belong to the UI implementation.

- Implement archive first.
  All three tables contain `archived_at`, and `fn::list_projects` already filters that field.
  Archive is small after the cascade rule is final.
- Permanent removal needs confirmation with current canvas and note counts.
  The confirmation must state which records survive.
- The note store uses record IDs as keys.
  It requires no change because each record already contains `project`.

- Decide whether every canvas belongs to one project.
  The current schema requires this ownership.
  The request "reference this canvas from another project" breaks that rule and must face early rejection.
- Decide whether content can have cross-project relations.
  The `relates_to` relation is `IN content_item OUT
content_item` and has no project constraint.
  As a result, cross-project edges are currently possible.
  The current preference rejects them.
- Define the empty state.
  A workbench without projects is the actual first-run state, and no design exists for it.

---

## bug: resize handle hit area is too small

A user reported: "I can barely hover over them to drag to resize."

The problem has a diagnosis but no correction.
`resizeHandleSize` is 16, and `RESIZE_HANDLE_OVERHANG = extent / -2` centers the handle on the frame edge.
The target extends 8px outside the window and 8px inside it.
This size is at the lower limit for reliable pointer input.

Edge handles also reserve one full handle extent at each end for corner handles.
The window surface has a 12px radius.
Near each corner, the curved visible edge moves away from the square handle target.
As a result, the smallest target has a different visible aim point.

A symmetric size increase also reduces the header drag area.
A spatial-target test found this conflict immediately.

Add more target area outside the window than inside it.
The outside area is empty canvas, while the inside area competes with the header and body.
A pointer also approaches an edge from outside the window.

The rendered and interactive geometry have different owners:

- `RESIZE_HANDLE_DESCRIPTORS` in `window-frame.tsx` defines the CSS geometry.
- `getWindowResizeHandleAtPoint` in `spatial-target.ts` defines the TypeScript hit classification.

A CSS overhang change does not change the hit classification.
Make one definition the source for both forms of geometry.
This framework change requires its own tests and one implementation sprint.

---

## feature: command prompt / launcher bar (cmdk)

`Mod+K` opens one surface for the complete canvas vocabulary and project content.

Most required behavior already exists and must remain in its current owner.
`getInfiniteCanvasContextualCommands` returns labels, descriptions, groups, hotkeys, and current-state enablement.
`getAvailableInfiniteCanvasContextualCommands` returns only enabled commands.

The framework owns this vocabulary, and the launcher displays it.
A copied vocabulary creates a second authority that can become stale.
The playground palette already uses these framework results and receives new commands without product changes.

`cmdk` provides filtering, group behavior, and selection through arrow keys.
Base UI provides the dialog, focus trap, and focus restoration.
Both packages are existing project dependencies.
Do not implement their behavior again.

Search results include more than commands.
They also include notes and canvas navigation targets.

Selection of a note moves the camera to its window instead of opening a separate dialog.
`navigateCameraToWindow` and `getCameraNavigationFrame` provide this behavior.
Navigation is the canvas-specific half of the launcher.

- One surface contains commands, notes, and navigation targets.
  Commands come from the framework.
  Notes come from `fn::list_notes`, which already stores `search_text` in lowercase.
  Navigation targets include windows and workspaces.
- The framework supplies command enablement.
  Disabled commands remain visible with a dim treatment.
  This treatment keeps the full vocabulary visible.
- On close, return focus through `focusInfiniteCanvasCommandSurface`.
  Otherwise, canvas hotkeys stop without a visible error.
  Base UI focus restoration does not know the canvas command surface.
- Add `Mod+P` for projects and canvases after projects exist.

---

## refactor: one ordered writer, not two

`canvas-persistence.ts` and `note-store.ts` each compose the same three parts:

1. A `Debouncer` combines one change burst into one write.
   A drag or sentence is one burst.
2. An `AsyncQueuer` uses concurrency one to preserve write order.
3. A revision guard protects the save, and the caller stores the returned revision.

The queue is easy to omit and expensive to omit.
Both stores protect writes with a revision.
Two concurrent saves can read the same revision before the first save increments it.
The database then reports a conflict for two changes from the same user.

Ordered writes make optimistic concurrency usable without these false conflicts.
Two files currently assert this order through separate implementations.

TanStack Pacer provides `Debouncer` and `AsyncQueuer` as separate parts.
It does not provide a combined part, so the application owns their composition.
Two real call sites justify one shared function.

`createOrderedWriter({ save, wait, onError, onStarted, onSettled })` returns `{ write, stop }`.
Each caller continues to read and store its revision inside `save`.

The canvas keeps its revision in a closure.
A note reads its revision from the store.
The shared function must preserve this difference.

An unrelated correction created this function once and then removed it.
The work started during a course correction and did not land.
The two current implementations still contain the duplication.

---

## spike: an icon set that is not `lucide-react`

Lucide is the default icon set in products derived from shadcn.
As a result, the current icons identify "a React app" instead of Polkadot.
The replacement needs its own visual identity.

- **State expression.** Many HUD actions are toggles, including pinned, locked, snapped, and minimized.
  One glyph needs paired line and fill weights for these two states.
  Lucide has one effective weight, so `Pin` looks the same in both states.
- **Optical size at 14px.** HUD glyphs appear at 14px on a dark blurred surface.
  A 24px grid with 1.5px strokes loses clarity at this size.
  A small-size variant preserves it.
- **Spatial vocabulary.** The set needs align, distribute, group, fit, layer, and lasso glyphs.
  Most sets have limited coverage for these actions.

Examine the candidates in this order:

1. **Phosphor** (`@phosphor-icons/react`) has six weights, including `fill` and `duotone`.
   It has approximately 9,000 glyphs and per-icon ESM modules.
   `<Pin weight={pinned ? "fill" :
"regular"} />` uses one component for both states.
   Its visual form is different from Lucide.
2. **Solar** or **Iconoir** can load through `unplugin-icons`.
   The build compiles each glyph to inline SVG, with no runtime or full-set bundle cost.
   This path permits trials of several sets before selection.
3. **Untitled UI icons** target small product controls.

Tabler and Feather use the same 24px and 2px stroke lineage as Lucide.
They do not provide the required change.

The current migration has eight glyphs in two files:
`Plus`, `AlignStartVertical`, `AlignHorizontalSpaceAround`, `Pin`, `Scan`, `Trash2`, `TriangleAlert`, and `X`.

`InfiniteCanvasHud` renders its own zoom and camera controls.
If it fixes its own glyphs, a product icon change creates two visual icon systems on one canvas.

Examine the framework glyphs before selection.
If the framework fixes them, add generic icon slots to the framework.
Polkadot must not copy the framework icon set only to hide this gap.
A framework must not select the icon set for every consumer.

---

## feature: code blocks with syntax highlighting

Editing code and displaying code have different requirements.
The probable implementation uses two engines.

`@lexical/code` is an existing dependency.
It provides `CodeNode`, `CodeHighlightNode`, and a Prism tokenizer with incremental highlighting.
The tokenizer updates only the affected content after each keystroke.

A basic highlighter processes the full block after each character and causes editing delay.
Replacing the Lexical tokenizer with Shiki requires a new incremental update system.
This system is the expensive part of editor highlighting.

Shiki uses TextMate grammars and actual VS Code themes.
Its output matches editor syntax more closely than Prism output.
This fidelity matters for far-zoom summaries and future export, where users read instead of type.

Keep the Prism tokenizer from `@lexical/code` for live editing.
Add Shiki for read-only display.
If the two outputs have an unacceptable visual difference, revisit this split.

- Do not add a second WASM file to the critical path.
  The application already loads an 11 MB SurrealDB engine.
  Use `shiki/core` with `createHighlighterCore` and explicit language and theme imports.
  Use the JavaScript RegExp engine through `createJavaScriptRegexEngine` instead of Oniguruma WASM.
  The complete `shiki` bundle imports every grammar and is not permitted.
- Derive the theme from design tokens.
  The Shiki `cssVariables` theme emits `var(--shiki-…)` values instead of fixed hex colors.
  Resolve these colors through `styles.css` to keep one color authority.
  A fixed VS Code theme does not match the oklch palette.
- If a note uses a language, load only that language.
  One TypeScript block must not load unrelated languages.

---

## spike: a maximalist Lexical composer to read and borrow from

Start with `facebook/lexical` and `packages/lexical-playground`.
The Lexical team maintains this implementation, and it is the most complete available example.

It includes these backlog capabilities:

- Mentions with a typeahead.
- Tables.
- Resizable images.
- Code blocks.
- Equations.
- Polls.
- Sticky notes.
- Comments.
- Collaborative editing.
- A floating format toolbar.

The playground usually contains the first complete example of a supported Lexical capability.

Payload CMS is the most substantial production integration outside Meta.
Read `payloadcms/payload` and `packages/richtext-lexical` for its packaging design.

Its feature architecture keeps nodes, toolbar entries, and serialization together.
It also defines a server schema for editor state.
A long-lived integration needs this packaging model, which the demonstration playground omits.

`lexical-beautiful-mentions` is a focused and maintained mention implementation.
It applies directly to the mention backlog item.

- Reuse the node registry and plugin composition model.
  It registers nodes, commands, and toolbar state in one place.
- Derive toolbar state from `$getSelection`.
  Many integrations implement this state incorrectly.
- Reuse the anchor-placement patterns for floating toolbars and typeaheads.
  Polkadot editors are inside a `transform: scale()` subtree.
  Their floating UI must use `InfiniteCanvasPortal`, as the mention item describes.

The playground is a demonstration application.
Its state management, styling, and application shell are not production patterns.
Reuse the editor architecture only.

---

## defect: notes become unreachable after the last window closes (**fixed**)

The data-loss appearance is gone.

The command palette lists each project note that has no window on the current canvas.
These entries appear under "Notes".
Selection puts the note on the canvas again.

The browser proof closed the only window for the welcome note.
It then reopened that note from the palette with its text intact.

The original entry remains because browsing is a separate requirement.
Search does not replace a library that users can scan.
Saved views do not exist.

---

Closing a window does not delete its note.
The note is a record, and the window is one view of that record.

Before the palette correction, no other surface had a path to the note.
Closing its last window made it invisible while the database retained it.
Test-note cleanup exposed records that accumulated without a product surface for viewing or removal.

This defect supplied the strongest requirement for the library rail.
`ROADMAP.md` described that rail as "an empty box making a promise".
The rail makes window closure safe by keeping the record reachable.

Before the rail exists, the last window closure looks like data loss and gives no warning.
The original entry offered two temporary choices:

- If a closing window is the last view of its note, tell the user.
- Archive a note without windows, so the existing canvas recovery collection can show it.

Also examine delayed saves during note deletion.
`fn::save_note` uses `UPDATE ONLY $note SET …`.
SurrealDB `UPDATE` on one record ID creates the record when it is absent.

A debounced write after deletion can recreate a partial record.
The revision guard can prevent this because `WHERE revision = $revision` cannot match an absent record.
This behavior still needs proof.

Cleanup appeared to show this recreation once.
The session did not rule out an accidental `New note` action as the cause.

---

## feat: arrangements as first-class layout recipes

Save a window arrangement and apply it again later.
Examples include "review layout", "writing layout", and "three-up compare".

A spatial tool reuses a configuration of documents instead of one document.
At present, that configuration exists only in the user's memory of manual window positions.

Examine the framework before product implementation because much of this behavior can already exist.
`InfiniteCanvasRecipe` and `parseInfiniteCanvasRecipe` are public exports.
The framework also contains `recipes.ts`.

Establish these current recipe capabilities:

- Whether a recipe describes a target arrangement.
- Whether a recipe applies to live windows.
- Whether a recipe accepts the windows that it changes.

An arrangement can be a durable named recipe that the user creates.
It can use a `content_item` with `kind: "arrangement"` and content that the framework already applies.
If this model is sufficient, no second recipe mechanism is necessary.

An arrangement needs one of three binding models:

- **Positional.** Selected content fills reusable slots when the arrangement runs.
- **Identity-bound.** The recipe names records and reopens those exact notes.
  This form is similar to a saved session.
- **Query-bound.** The recipe contains a filter such as "everything tagged `review`".
  Its result changes with the content.
  This is the most capable and most expensive form.

The current preference is positional binding.
It composes with the existing selection model that users already know.
The other forms can extend the same object later.

Framework `workspaces` filter membership inside one canvas.
An arrangement is a different object and must not use that model.
The arrangement produces geometry.
The workspace controls visibility.

---

## feat: undo that shows you where

An infinite canvas has an undo failure that a linear editor does not have.
The reverted change can be outside the viewport.

A user can press undo, see no movement, and press undo again.
Two changes then disappear without visible feedback.
This problem exists in most canvas tools, and few tools correct it.

Undo must combine navigation with the state change.
After reversal, move the camera to the affected location and mark the changed area.
The user can then see the result directly.

This capability belongs to the framework because every consumer can have a camera and history.
The framework already has `state.history` and `navigateToRect` for camera movement.

A history entry does not identify its affected region.
Add an optional world rectangle to each undoable entry.
The existing parts can then implement "navigate to the undone change".

- If the changed area is already comfortably visible, keep the camera still.
  `isWorldRectWithinViewport` already answers this question.
  Unnecessary camera movement is more disruptive than no movement.
- Let the highlight disappear without a dismissal action.
  It answers "what just happened", which remains useful for approximately one second.
- Apply the same behavior to redo.
  The history-entry rectangle supplies it without another model.
- For a batch across several windows, frame the union of all changed rectangles.
  `navigateToRect` already supports that union after the entry supplies it.

This work is small because the current history model already contains the other required parts.
Implement it early so users can see the result of every undo and redo.
