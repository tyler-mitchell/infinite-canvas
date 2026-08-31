---
"@hyphened/infinite-canvas": minor
---

`getInfiniteCanvasContextualEntries` combines canvas commands with consumer actions from `hotkeyActions`.

The function evaluates each consumer `isEnabled` callback against current state. It also binds each `run` handler to the correct dispatcher.

Only canvas entries have a `group` value. A consumer action replaces a canvas command with the same ID.

`getInfiniteCanvasContextualCommands` still returns only framework commands.

A `hotkeyActions` entry such as `connection.cut` can appear in contextual command lists.

`getInfiniteCanvasContextualEntries` is stable.
