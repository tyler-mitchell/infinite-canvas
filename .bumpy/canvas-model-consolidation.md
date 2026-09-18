---
"@hyphened/infinite-canvas": major
---

Consolidate registered content into window definitions and the shared canvas store.

Remove the unused graph integration, separate content envelopes, and handle factory.
Use window kinds for component identity and raw window data for authored properties.
Expose document access and notifications on the store and preserve per-kind frame configuration.
Replace the command facade and command envelope with one flat typed dispatch function.
Return layout bounds and visibility separately from stored window records.
Use getCanvasProjection for group and window bounds, visibility, and drag previews.
Separate state execution from React bindings.
Remove the separate window lifecycle and command execution paths; normalize edits through one reducer.
Define command availability and grouping with their execution rules.
Derive command payloads from schemas and use one command admission path.
Normalize tree edits in one traversal and frame undo changes from projected bounds.
Replace direct undo, redo, reset, and clone helpers with dispatch and native cloning.
