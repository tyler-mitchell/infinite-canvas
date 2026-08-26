# Affordance audit

**A row here is a precondition, not a record.** It is written _before_ the code, and code written
without one is a defect regardless of whether it works.

This file existed before, was used as a phase gate, deadlocked the project, and was deleted along
with the evidence requirement it carried. Deleting it was the mistake: within hours, a HUD was
written that rebuilt the framework's zoom and camera controls from scratch, and both versions
rendered on the canvas side by side. The sequencing gate is gone for good. The evidence
requirement is not optional and never was.

## Why this cannot be left to judgment

Polkadot exists to find gaps in `@hyphened/infinite-canvas`. That only works if "does the framework
already do this?" is answered _every time, with evidence_, before anything is written. An agent
moving quickly will skip the check to produce visible output, and will not notice it skipped —
the code compiles, it renders, it looks like progress. The duplicate is only visible later, from
outside, usually to Tyler.

The framework is 199 exports. Guesses about what is missing are wrong more often than right.

## How to satisfy it

Before implementing any capability, in this order:

1. `mcp__type-atlas__list_module_exports` on `@hyphened/infinite-canvas` — page through all of it,
   not the first screen.
2. Read the module that looks closest, in full. `InfiniteCanvasHud` was one `read_file` away.
3. Check `packages/ui` (`src/index.ts`) for the interaction primitive before writing one.
4. Check the playground — it is the canonical consumer and shows the intended composition.
5. Write the row below.

If the framework owns it, consume it. If it half-owns it, extend the framework generically. Only
what is genuinely a _product_ decision belongs in Polkadot.

| Capability                                                         | Framework/library evidence                                                                                                    | Finding                                                             | Where it belongs                                                                                                | Status    |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | --------- |
| Zoom, camera navigation, minimized dock, status card, pointer mode | `InfiniteCanvasHud` with `InfiniteCanvasHudPolicy`; `--icx-hud-*` tokens; playground consumes it                              | Rebuilt from scratch without ever opening it; both rendered at once | Framework, enabled via `hud` policy and themed                                                                  | corrected |
| Buttons in chrome                                                  | `packages/ui` `Button` — Base UI, `ghost`/`destructive`, `icon-sm`, focus ring, disabled, SVG sizing                          | A third button implementation was written                           | `ui`'s Button                                                                                                   | corrected |
| Chrome that recedes during an interaction                          | Nothing in the framework; `getInfiniteCanvasActivity` added generically to derive the state                                   | Genuinely absent                                                    | `HudSurface` in Polkadot for now; the receding rule is arguably framework-level and is a candidate to push down | open      |
| Verbs for a multi-window selection                                 | Framework owns the commands (`window.align`, `selection.close`, …) and their enablement; it has no opinion on presenting them | Vocabulary is framework, presentation is product                    | Polkadot renders; framework decides enablement                                                                  | accepted  |
| Note content storage                                               | Framework owns layout only (`serializeInfiniteCanvasState` omits content by design)                                           | Product concern                                                     | SurrealDB `content_item`                                                                                        | accepted  |
| Rich text editing                                                  | Not a canvas concern                                                                                                          | Library                                                             | Lexical, behind one boundary                                                                                    | accepted  |
| Backdrop replacement                                               | `InfiniteCanvasGridBackdrop` was hardcoded with no seam                                                                       | Real gap                                                            | Framework: `renderBackdrop`                                                                                     | landed    |
| Viewport survival across hydration                                 | `desktop.hydrate` replaced the whole document including measured `viewport`                                                   | Real gap                                                            | Framework: hydrate keeps the live measurement                                                                   | landed    |
