# Browser probes

Facts about this kit that only a browser can establish — what moves when text grows, and what a
thing costs. The suite has no layout engine and no clock worth trusting, so nothing here is
enforced: each probe is written out so it can be run again rather than trusted.

Run them in the preview with the dev server up. **Set an explicit viewport first, and read
`innerWidth` back.** A hidden pane reports `window.innerWidth` as `0`, every element as
`clientWidth: 0`, and therefore every element as overflowing its box. An unset pane is the quieter
version of the same trap: it is simply narrower than the layout's minimum, so every page reports a
plausible-looking 68 to 236px of overflow and nothing is wrong. Both were met here. Confirm the
width before believing a result.

A figure here is true only while the code that produced it is unchanged, and nothing re-runs these.
What the suite can hold is the half below the measurement: the classes that do the cutting. The rule
`every slot the probes measured still carries the class that made it true`, in `theme.test.ts`, is
what stops the clipping figures quietly becoming fiction. Nothing equivalent guards the timings —
they are machine and day dependent, and a number that varies by a third between runs cannot be
asserted. Re-run those rather than trusting them.

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

## What happens to text that refuses to wrap?

The probe above asks about slots that **clip**. This asks about the other half: fifteen slots say
`whitespace-nowrap`, and most of them do not clip, so a label longer than its room has nowhere to go
and pushes the page instead.

Nothing overflows on the demo content — `scrollWidth` equals `clientWidth` on all nine pages at both
1280 and 375. What follows is what an overlong label does, which is a consumer's business and not
the lab's. Worst push per slot, at 375x812, one element at a time:

```txt
  /widgets     stat 367   text-readout 281   badge 249   status-dot 243   button 160
  /disclosure  tab 300
  /layout      toolbar-button 289   icon-tile 225
  /controls    toggle 253   button 252
  /overlays    tooltip-trigger, popover-trigger, dialog-trigger, menu-trigger   168 each
```

**No fix is applied to the controls.** A button whose label wraps reads as broken, which is why the
nowrap is there, and one that truncates loses the word that said what it does. Both are worse than a
wide button, and every kit worth copying leaves a control as wide as its label. The container is the
consumer's to bound. This is written down rather than acted on so the next person measuring it finds
the decision instead of the symptom.

The `icon-tile` figure is the interesting one: it carries `min-w-0 overflow-hidden` and pushes 225px
anyway, because nothing above it is constrained either. `min-w-0` on a leaf does nothing when its
parent chain never gives it a bound.

```js
// Paste into the preview console, one page at a time. Replaces each one-line element's text,
// measures the page, and puts it back.
window.__nowrap = () => {
  const d = document.documentElement;
  const LONG = "ship the quarterly reconciliation summary to every regional operations lead";
  const marks = [...document.querySelectorAll("*")].filter(
    (e) =>
      getComputedStyle(e).whiteSpace === "nowrap" &&
      e.children.length === 0 &&
      e.textContent.trim().length > 0,
  );
  const worst = new Map();
  for (const el of marks) {
    const was = el.textContent;
    el.textContent = LONG;
    const over = d.scrollWidth - d.clientWidth;
    const slot = el.closest("[data-slot]")?.dataset.slot ?? "?";
    if (over > (worst.get(slot) ?? 0)) worst.set(slot, over);
    el.textContent = was;
  }
  return { rest: d.scrollWidth - d.clientWidth, marks: marks.length, worst: [...worst] };
};
```

This probe is what found the readout asking to wrap and refusing to in the same breath: its class
list carried `wrap-anywhere` from the text base and `whitespace-nowrap` from its own role, and the
browser dropped the wrap silently. The suite now composes every class list the kit can emit and
reports a pair like that, in `variants.test.tsx` — that rule is enforced, unlike the figures above.

## Does the kit write anything else the browser ignores?

The wrap contradiction above was one declaration that could never take effect. Asking the same
question of every element on all nine pages — six ways a declaration can be inert — finds nothing
else. Two things do report, and neither is a fault:

- **A disabled control keeps `cursor-pointer` under `pointer-events: none`.** Nothing is drawn from
  it: with pointer events off the element's own cursor is never consulted, and the reader gets the
  parent's. It is Tailwind's own `disabled:pointer-events-none` pattern meeting the base cursor.
  Giving a disabled control `cursor-not-allowed` is a taste, not a fix, and is not taken here.
- **`text-meta` computing `nowrap` on `/layout`.** The role asks to wrap; the scroller holding it
  says `whitespace-nowrap`, and `white-space` inherits. That is the demo asking for one line and
  getting it. A consumer's container overriding a role is composition working, which is why the
  enforced rule reads what `tv` emits and stops there.

`line-clamp` also reports if the check asks for `display: -webkit-box`. It should not: Chrome clamps
on a `flow-root` box through the standard property, and the card's clamp was measured holding at 3
lines, 56px tall over 94px of content. The check was wrong, not the class.

```js
// Paste into the preview console. Reports declarations that cannot take effect.
window.__inert = () => {
  const found = [];
  for (const el of document.querySelectorAll("*")) {
    const s = getComputedStyle(el);
    const slot = el.closest("[data-slot]")?.dataset.slot ?? "?";
    const say = (why) => found.push(`${slot} :: ${why}`);
    if (s.whiteSpace === "nowrap" && s.overflowWrap === "anywhere") say("nowrap + wrap-anywhere");
    if (s.pointerEvents === "none" && s.cursor === "pointer") say("no pointer events + cursor");
    if (s.textOverflow === "ellipsis" && s.overflow === "visible") say("ellipsis, nothing hidden");
    if (s.position === "static" && (s.top !== "auto" || s.left !== "auto")) say("offset, static");
    if (s.position === "static" && s.zIndex !== "auto") say("z-index, static");
    if (s.display === "inline" && s.width !== "auto") say("width on an inline box");
  }
  return [...new Set(found)];
};
```

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
