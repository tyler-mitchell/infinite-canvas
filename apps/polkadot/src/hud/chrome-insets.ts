/**
 * What this app's own chrome covers, per edge.
 *
 * The library rail is the obvious one, but it is not the only one: the identity rail sits along the
 * top and the zoom and selection rails along the bottom, and until they were named the camera
 * centred content underneath them and the offscreen indicators projected their ring onto an edge
 * with a pill rail sitting on it — an arrow appeared behind the "New note" button.
 *
 * Declaring one edge and forgetting the others is the same bug as declaring none, just quieter.
 *
 * **Here rather than beside the canvas that passes them**, because two things read these now: the
 * canvas, which is told what its camera must avoid, and the HUD, which stacks its own corner
 * surfaces on top of whatever the framework placed against them. A constant with two readers in two
 * files is one edit away from disagreeing with itself.
 */

const TOP_INSET = 56;
const BOTTOM_INSET = 56;

export { BOTTOM_INSET, TOP_INSET };
