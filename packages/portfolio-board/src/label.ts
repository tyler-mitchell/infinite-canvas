/**
 * The accessible name for a picture that can read itself: what the consumer calls it, then what it
 * holds.
 *
 * Four components draw a `role="img"` over values and build a reading from those values — the bars,
 * the sparkline, the breakdown and the layout preview. Each also takes a `label`, and each used to
 * let that label *replace* the reading. A name is the one thing a consumer always has and the
 * figures are the one thing only the component knows, so replacing meant the better half lost.
 *
 * It had happened twice before this was shared. The breakdown's own documentation records a page
 * passing "language split" and leaving every share drawn and unsaid, and the layout preview called
 * its count "the only place the state can be said" while both pages named it and dropped the count.
 * Five bar charts across two pages were reading "weekly installs over eight weeks" and "levels",
 * neither of which carries a figure.
 *
 * Composing instead makes the trap unreachable: a name costs nothing, and a component with no name
 * still reads itself.
 */
export function namedReading(label: string | undefined, reading: string) {
  const named = label?.trim();

  return named ? `${named}, ${reading}` : reading;
}
