/**
 * Where a radial menu's spokes sit, and where the wheel itself is allowed to open.
 *
 * Pure arithmetic, deliberately separated from the component that draws it. The wheel's opening is
 * driven by `requestAnimationFrame` — its own and `liquid-gooey`'s springs — and rAF does not run
 * in the verification browser, so its settled geometry is one of the few things about this app that
 * cannot be watched (see "Verifying in the browser" in `AGENTS.md`). Arithmetic needs no frame, so
 * the part that can be checked is checked, rather than left to a screenshot that will not come.
 */

/**
 * How far the items sit from the press, in screen pixels.
 *
 * Far enough that the blob has visibly split rather than bulged — under roughly twice the item's own
 * size the goo never necks apart and the wheel reads as one lump. Near enough that the whole ring
 * stays inside a modest window.
 */
const RADIUS = 78;

/** A spoke's own extent, matching the button's `size-11`. */
const ITEM_SIZE = 44;

/**
 * The group's box, and it has to contain the whole open ring.
 *
 * The library draws the goo into an SVG the size of the group, so a group sized to the press point
 * has nowhere to paint — the buttons still render, because they are real DOM on the layer above, and
 * the liquid simply does not appear. Which is exactly what the first attempt looked like: six icons
 * floating with nothing behind them.
 */
const WHEEL_SIZE = RADIUS * 2 + ITEM_SIZE;

/** Twelve o'clock, so the first verb is where the eye starts rather than wherever a loop began. */
const START_ANGLE = -Math.PI / 2;

/** Breathing room past the ring's own extent, so a clamped wheel is not flush to the edge. */
const EDGE_MARGIN = 8;

/** Where item `index` of `count` sits, relative to the wheel's centre. */
const getSpoke = (index: number, count: number) => {
  const angle = START_ANGLE + (index / count) * Math.PI * 2;

  return { x: Math.round(Math.cos(angle) * RADIUS), y: Math.round(Math.sin(angle) * RADIUS) };
};

/**
 * The wheel opens where you pressed, unless that would put spokes outside the window.
 *
 * Measured before it was fixed: a press 20px from the bottom-right corner of an 812×998 viewport put
 * all six spokes off-screen — the ring reaches 100px in every direction and the press was 22px from
 * two edges, so most of the menu simply was not there.
 *
 * Clamped rather than flipped. A dropdown flips because it hangs off one corner and has a natural
 * other side; a ring has no sides, so moving it inward keeps every verb at the angle it was learned
 * at. The cost is that a cornered wheel is no longer centred on the pointer, and that is the right
 * trade against spokes nobody can reach.
 *
 * The viewport is passed in rather than read from `window`, which is what makes the rule checkable
 * against a corner press without needing a browser to press a corner in.
 */
const clampToViewport = (
  origin: Readonly<{ x: number; y: number }>,
  viewport: Readonly<{ height: number; width: number }>,
) => {
  const inset = WHEEL_SIZE / 2 + EDGE_MARGIN;

  return {
    /*
     * The inner `max` is what keeps a viewport smaller than the wheel from inverting the clamp.
     * Below twice the inset the two bounds cross, and without it the lower bound would win and put
     * the wheel further out than the press was.
     */
    x: Math.min(Math.max(origin.x, inset), Math.max(inset, viewport.width - inset)),
    y: Math.min(Math.max(origin.y, inset), Math.max(inset, viewport.height - inset)),
  };
};

export { clampToViewport, getSpoke, ITEM_SIZE, RADIUS, WHEEL_SIZE };
