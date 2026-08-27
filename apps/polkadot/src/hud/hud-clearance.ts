/**
 * How far above the bottom edge a corner surface has to start to clear the canvas's own HUD.
 *
 * The framework puts its navigation and zoom rails in the bottom-right corner, and a consumer
 * surface wanting that corner has to sit above them. `hud-surfaces` said so and then guessed:
 * `bottom-16`, 64px. Measured, the rail's top edge is at 114px, so the map spanned 60–164 with the
 * rail inside it — 5,546 of the map's 15,000 px², 37%, rail on top, so the lower third of a control
 * advertising `cursor-crosshair` did not answer a click.
 *
 * **Derived, after measuring it four different ways failed.** The obvious fix is to read the rail's
 * rect from the DOM, the way `hud-occluders` reads this app's own surfaces — the element knows where
 * it is, so ask it. Every attempt raced the layout, and each shipped a wrong number that typechecked:
 *
 * 1. Querying once at effect time found nothing, because the canvas's HUD mounts *after* this
 *    surface. No observer was attached and the early measurement stuck — `bottom: 66px` against a
 *    rail at 122px.
 * 2. Watching the root's size caught the insets moving it and missed the rails arriving inside it,
 *    so it measured an empty HUD, took the bare-corner fallback, and put the map *further* into the
 *    rail than the original guess had.
 * 3. Retrying across animation frames never ran: `requestAnimationFrame` does not fire while the
 *    document is hidden, which is a background tab and not only a test harness.
 * 4. Watching for the root and then narrowing to it still read the pre-inset position and never
 *    corrected, the rail having moved without adding a node or resizing what was being observed.
 *
 * A number that races is worse than a number that is merely coupled, because it is wrong
 * intermittently and only in the environments nobody is looking at. So this composes two values
 * that are both stable and both stated.
 *
 * **The coupling is real and is the price.** `BUILT_IN_HUD_EXTENT` is the framework's business, not
 * this app's, and nothing tells us when it changes. The affordance that would end it is the
 * framework publishing where its own HUD ended up — the mirror of `viewportInsets`, which flows the
 * other way — and that is recorded in `ROADMAP.md` as a gap rather than half-built here.
 */

/**
 * What the canvas's own HUD occupies above whatever bottom inset it was given.
 *
 * Measured on 2026-08-27 at 1440×900: with a bottom inset of 56 the rail's top edge sat at 114px,
 * and with 64 it sat at 122 — so the rail is the inset plus a constant 58, being the framework's own
 * 16px corner offset and its 42px rail. Both numbers were read from `data-slot="hud-group"`, the
 * framework's published styling contract.
 */
const BUILT_IN_HUD_EXTENT = 58;

/** Enough that the two surfaces read as stacked rather than touching. */
const GAP_PX = 8;

/**
 * Composed from the app's own bottom inset, because that is what the framework's HUD is placed
 * against — it insets itself by exactly the number the consumer declares.
 *
 * Taking the inset as an argument rather than importing it keeps the direction of knowledge right:
 * the caller owns what its chrome covers, and this owns what the canvas stacks on top of that.
 */
const getBuiltInHudClearance = (bottomInsetPx: number): number =>
  bottomInsetPx + BUILT_IN_HUD_EXTENT + GAP_PX;

export { BUILT_IN_HUD_EXTENT, getBuiltInHudClearance };
