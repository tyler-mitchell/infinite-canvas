# Browser probes

Facts about this kit that only a browser can establish — what moves when text grows, and what a
thing costs. The suite has no layout engine and no clock worth trusting, so nothing here is
enforced: each probe is written out so it can be run again rather than trusted.

Run them in the preview with the dev server up. **Set an explicit viewport first.** A hidden pane
reports `window.innerWidth` as `0`, every element as `clientWidth: 0`, and therefore every element
as overflowing its box. Confirm the width before believing a result.

## Does clipped text ever drag its container?

Seven slots clip: the swipe card's title (three lines) and its two foot ends, the select's value, the
receipt's line name, the list row's label, the pending card's label, and the plot's readout.

None of them clips on the demo content — measured at 1280 and at 375, nothing in the app is cut. So
the protection is real but idle, and this probe is the only thing that has exercised it.

```js
// Paste into the preview console. Walks every clipping element on the current page, gives each an
// overlong string, and reports what moved.
window.__stress = (path) => {
  const LONG =
    "Enormously overlong label text that no sensible interface would ever be given but which a component still has to survive without dragging its own container sideways";
  const docBefore = document.documentElement.scrollWidth;

  return [...document.querySelectorAll("*")]
    .filter((el) => getComputedStyle(el).textOverflow === "ellipsis" && el.clientWidth > 0)
    .map((el) => {
      const parent = el.parentElement;
      const before = { el: el.clientWidth, parent: parent.clientWidth };
      const original = el.textContent;

      el.textContent = LONG;
      // Reading a layout property forces the reflow, so no await is needed between the two reads.
      const after = {
        where: path,
        was: (original ?? "").trim().slice(0, 14),
        clipped: el.scrollWidth > el.clientWidth + 1,
        parentGrew: parent.clientWidth - before.parent,
        pageGrew: document.documentElement.scrollWidth - docBefore,
      };

      el.textContent = original;
      return after;
    });
};
```

Result, 2026-09-10, across all nine routes at 1280x900: **34 clipping elements, all held.** Every one
reported `clipped: true`, `parentGrew: 0`, `pageGrew: 0`.

The plot's readout is the one worth stating on its own, because it was the newest and the only one
inside a `justify-between` row:

```txt
130 characters into the plot's readout, at a grid 558 wide
  footer width   558 → 558
  legend left    818 → 818      (not pushed)
  legend width    66 → 66       (not squeezed)
  page width    1280 → 1280
  text clipped by 406px
```

Do not compare an element against `el.closest("[data-slot]")` when the element carries the slot
itself: the first version of this probe did, so it measured the readout against itself and reported
its growing to fill the free space as a failure. What matters is whether anything **outside** it
moved.

## Does the swipe card's clamp hold?

The card cannot grow, and its comment records a title once pushing the foot 116px past the bottom
edge. Three lines is one more than the longest title the deck draws — two lines on a card of 297,
which is what a 375 screen gives it, and one line at 1280.

```txt
~190 characters into the top card's title, at 1280x900
  title height    19 → 56       (three lines, then stops)
  fourth line hidden by 19px
  card height    211 → 211
  foot bottom   2716 → 2716
  card bottom   2733 → 2733
```

## What does a drag actually cost?

Dragging a card sets its offset, so the deck draws again on every pointer move. That sounded
expensive and is not.

```js
// Paste into the preview console on /widgets.
const card = document.querySelector('[data-slot="swipe-card"]:not([aria-hidden])');
const box = card.getBoundingClientRect();
const at = { clientX: box.left + box.width / 2, clientY: box.top + box.height / 2 };
const fire = (type, extra = {}) =>
  card.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: 1, ...at, ...extra }));

fire("pointerdown");
await new Promise((r) => setTimeout(r, 30));
const before = performance.now();
for (let i = 0; i < 200; i += 1) fire("pointermove", { movementX: i % 2 === 0 ? 1 : -1 });
const total = performance.now() - before;
fire("pointerup");
total / 200;
```

**0.085ms per move**, against a 16.7ms frame — half a percent of the budget for the whole redraw,
three cards and their stamps included. So the offset stays React state. Writing the transform
straight to the node would add a ref, a second source of truth for the offset, and the stamps would
need the same treatment, to save a twelfth of a millisecond.

## When did keeping settled cards in a list actually hurt?

The deck used to ask a growing list for every card on every draw. Changing it to a set was right —
the growth is gone and the behaviour is identical — but the urgency was overstated when it landed.
Measured, at four fifths of each deck settled, per draw:

```txt
  deck     as a list    as a set    times
    50       0.018ms     0.002ms      11
   200       0.098ms     0.005ms      20
   500       0.887ms     0.010ms      89
  1000       4.210ms     0.023ms     180
```

At the size a deck plausibly has, the list cost a tenth of a millisecond — real growth, no visible
problem. It only reaches a quarter of a frame at a thousand cards. The fix stands on removing the
growth, not on rescuing a frame rate that was never in trouble.
