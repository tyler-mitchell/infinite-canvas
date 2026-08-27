/**
 * How far above the bottom edge a corner surface has to start to clear the canvas's own HUD.
 *
 * The framework puts its navigation and zoom rails in the bottom-right corner, and a consumer
 * surface wanting that corner has to sit above them. `hud-surfaces` said so and then guessed:
 * `bottom-16`, 64px. Measured, the rail's top edge is at 114px, so the map spanned 60–164 with the
 * rail inside it — 5,546 of the map's 15,000 px², 37%, rail on top, so the lower third of a control
 * advertising `cursor-crosshair` did not answer a click.
 *
 * **The canvas answers this now, and these two numbers are all that is left.**
 * `--icx-hud-extent-bottom` is written by the framework's HUD in the frame it lays itself out in,
 * so the position is no longer this app's to know. What remains is a gap, which is taste, and a
 * fallback for a canvas whose HUD is turned off.
 *
 * Getting there took four attempts at measuring the rail from outside, and they are worth keeping
 * because each one typechecked and each one shipped a wrong number:
 *
 * 1. Querying once at effect time found nothing — the canvas's HUD mounts *after* this surface — so
 *    no observer was attached and the early measurement stuck: `bottom: 66px` against a rail at 122.
 * 2. Watching the root's size caught the insets moving it and missed the rails arriving inside it,
 *    so it measured an empty HUD, took the fallback, and put the map *further* into the rail than
 *    the original guess had.
 * 3. Retrying across animation frames never ran: `requestAnimationFrame` does not fire while the
 *    document is hidden, which is a background tab and not only a test harness.
 * 4. Watching for the root and narrowing to it still read the pre-inset position and never
 *    corrected.
 *
 * The pattern under all four is that the consumer is trying to observe, from outside, a layout the
 * canvas performs. That is the argument that made it a framework affordance rather than a better
 * observer here.
 */

/** Where a corner surface sits when the canvas draws no HUD at all — the ordinary corner offset. */
const BARE_CORNER_PX = 16;

/** Enough that the two surfaces read as stacked rather than touching. */
const GAP_PX = 8;

export { BARE_CORNER_PX, GAP_PX };
