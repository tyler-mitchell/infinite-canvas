# Review: the raster capture path

Read on 2026-09-11 against the untracked working tree —
`packages/infinite-canvas/src/compositor/backend/rasters/` (4 files) and `world/` (4 files). This
code is mid-build in another session, so nothing here was edited; it is a review, not a patch.

Reviewed by reading only. The app does not bundle right now (`surface.tsx:56` imports `./instances`
after it moved to `world/instances.ts`), so none of this was observed running.

## 1. Invalidation recaptures on camera movement — contract violation, high impact

`rasters/invalidation.ts:22-27` watches each resident window's element:

```ts
observer.observe(element, {
  attributes: true,
  characterData: true,
  childList: true,
  subtree: true,
});
```

Windows are positioned by per-window inline style, recomputed from the camera every render:
`window-frame.tsx:221` calls `projectWorldRectToScreen(camera, viewport, window.rect, dpr)`, and
`group-layer.tsx:159-164` returns `{ height, left, position, ... }` as a style object.

So `attributes: true` fires on the framework's own positioning writes:

| Gesture                    | Elements whose style changes | Marked dirty                |
| -------------------------- | ---------------------------- | --------------------------- |
| Drag one window            | that window                  | 1 per frame                 |
| **Pan or zoom the camera** | **every window**             | **all resident, per frame** |

The second row is the problem. `docs/compositor.md` measures a coalesced paint of 64 windows at
32.3 ms — roughly two frames at 60 Hz — and its own conclusion is explicit:

> The browser already keeps the dirty set. The compositor must not keep a second dirty set.
> Moving a window does not request a new capture.

This module is that second dirty set, and it requests a capture on move.

Do not fix it by filtering `style` off the root element. Descendant attribute changes are real
invalidations (a control toggling), so the filter has to distinguish the framework's positioning
writes from content writes, and an attribute filter cannot see which element it fired for without
inspecting each record. Two directions worth weighing, both cheaper than a filter:

- Take the dirty set from `changedElements` on the `paint` event, which is what the compositor
  document already specifies and what the browser already computes.
- Failing that, observe the window's _body subtree_ rather than its frame element, so the
  positioned node is outside what is watched.

## 2. `writeTable` leaves a stale tail when residency shrinks

`rasters/pages.ts:102-114`:

```ts
columns.fill(0, 0, slots.length * 4);
// ... writes slots ...
table.buffer.write(columns);
```

`columns` is `WINDOW_INSTANCE_CAPACITY * 4` long and the whole array is uploaded, but only the first
`slots.length * 4` entries are cleared. When residency shrinks between frames the tail keeps the
previous frame's values, including the readiness flag at `.w === 1`, so a pass reading
`rasterTable.$[slot]` past the live count samples a page that is no longer assigned to that slot.

Latent rather than live: it only bites if a pass reads beyond the current instance count. The fix is
`columns.fill(0)` — the array is small and clearing all of it removes the coupling to `slots.length`
entirely.

## Checked and sound

- `release` (`pages.ts:92-99`) recycles a layer without clearing its pixels, which is safe:
  `claim` returns `width: 0`, and `writeTable` skips a page with `width === 0`, so a recycled layer
  reads as not-ready until `fill` runs.
- `fill` clamps to `pageSize` on both axes before `copyExternalImageToTexture`, so an oversized
  raster is cropped rather than overflowing its page.
- `freeLayers` is built high-to-low and popped, so layers are handed out lowest-first, matching the
  comment and the slot order.
