---
"@hyphened/infinite-canvas": minor
---

A consumer's verbs can join contextual discovery instead of reaching only the keyboard.

`hotkeyActions` gave a consumer's own verbs a chord and nothing else. `getInfiniteCanvasContextualCommands` answers only for commands the canvas owns, so every surface offering verbs — a palette, a context menu, a WebMCP tool registry — had to build a second list, resolve its enablement, and police id collisions between the two vocabularies by hand.

`getInfiniteCanvasContextualEntries` returns both, taking the same `InfiniteCanvasHotkeyAction` the keyboard already accepts and resolving each verb's `isEnabled` against live state. A caller branches on `source` to invoke: a canvas entry carries a `command`, a consumer entry carries its own `run`, and the union makes the wrong dispatch a type error rather than something a helper has to prevent.

Entries are discriminated by `source` rather than by probing for `command`. Consumer entries carry no `group` — the five groups are the framework's taxonomy of its own verbs, so filing a consumer verb under one would be a false statement in the data rather than a missing one. A consumer verb sharing an id with a canvas command replaces it, which is what a consumer re-declaring a verb to take an argument already means.

Experimental, `unobserved`: unit-tested and consumed by nothing. Polkadot builds this merge by hand today and is the migration that will exercise it.
