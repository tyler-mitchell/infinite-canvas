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

So `attributes: true` fires on the framework's own positioning writes. A drag dirties the dragged
window; **a camera pan or zoom dirties every resident window**, because every one of them is
repositioned.

**Corrected after reading the capture side.** An earlier revision of this note said a pan
recaptures every window per frame. It does not: `index.ts:68` guards on `capturing.active` and
starts at most one capture per frame, so there is no per-frame stampede. The throttle spreads the
work rather than avoiding it, and the real dynamic is worse than a burst would be:

- a sustained pan re-dirties all N resident windows on every frame,
- the drain removes one per completed capture, and snapdom costs ~16 ms per window
  (`docs/compositor.md`),
- so the dirty set stays saturated for the whole gesture and the capture lane runs flat out,
  producing rasters identical to the ones it already had.

The cost is main-thread rasterization competing with the gesture that caused it, for as long as the
gesture lasts, for no visual change. `docs/compositor.md` is explicit:

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

## 2. A window that cannot claim a page never retries, and renders blank forever

`index.ts:68-87` clears the dirty flag before the capture runs:

```ts
invalidation.dirty.delete(next);
// ...
void capture(next, element);
```

and `capture` (`index.ts:18-24`) gives up when the pages are full:

```ts
if (pages.claim(windowId) === null) {
  return;
}
```

Nothing puts the window back in `dirty`. A window is only re-dirtied by a DOM mutation, so one that
arrives while every page is taken keeps `width === 0`, is skipped by `writeTable`, and renders as
not-ready **permanently** — including after pages free up. A static note, which is the common case,
never mutates and so never recovers.

This only bites at capacity, which is exactly when it is least acceptable. The fix is to re-add the
window to `dirty` when `claim` fails, so the next frame with a free page picks it up.

## 3. A mutation during a capture is lost

Same lines. `dirty.delete(next)` happens before the ~16 ms `await`, so an edit landing during the
capture is cleared by the capture that did not include it. The window then shows stale pixels until
some later mutation happens to dirty it again.

Clearing after the capture resolves, rather than before it starts, closes this — the window stays
dirty across its own capture and is simply recaptured once more.

## 4. RETRACTED — `writeTable` does not leave a stale tail

An earlier revision of this note claimed `pages.ts:103` leaves a stale tail, because
`columns.fill(0, 0, slots.length * 4)` clears only part of an array it then uploads whole. Reading
`world/slots.ts` disproves it.

`slots.ids` is a high-water mark, not a live count. A window keeps its slot for its life on the
canvas; a departing window's slot becomes `null` in place (`slots.ts:39`) and joins a free list,
and the array only grows, since a new slot is `free.pop() ?? ids.length` (`slots.ts:53`). So
`slots.length` is monotonically non-decreasing and the cleared range never shrinks. There is no
tail to go stale.

The live count is carried separately: `surface.tsx:297` writes `columns.count` to
`instanceCountUniform`, which is what a pass dispatches on, and that is always `<= slots.length`.
Every table entry a pass can reach was cleared this frame.

Left here rather than deleted, so the next reader does not re-derive the same wrong conclusion from
the same line.

## Checked and sound

- Captures are serialized and off the frame loop: one in flight (`index.ts:68`), started from
  `sync` but awaited outside it, with a `catch` that warns and a `finally` that always clears the
  flag, so a thrown capture cannot wedge the lane.
- Residency reconciliation (`index.ts:61-66`) unwatches and releases in the same pass, so a window
  leaving the slot set gives up both its observer and its page.
- `captureWindowRaster` (`capture.ts:21-24`) clamps scale by the longest edge against `pageSize`, so
  the raster fits its page before `fill` clamps again.
- `release` (`pages.ts:92-99`) recycles a layer without clearing its pixels, which is safe:
  `claim` returns `width: 0`, and `writeTable` skips a page with `width === 0`, so a recycled layer
  reads as not-ready until `fill` runs.
- `fill` clamps to `pageSize` on both axes before `copyExternalImageToTexture`, so an oversized
  raster is cropped rather than overflowing its page.
- `freeLayers` is built high-to-low and popped, so layers are handed out lowest-first, matching the
  comment and the slot order.
