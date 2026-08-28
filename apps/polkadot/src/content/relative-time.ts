/**
 * How long ago something happened, in words.
 *
 * `Intl.RelativeTimeFormat` is the platform's own, so there is no date library here and the wording
 * follows the reader's locale. `now` is an argument rather than a call inside, which keeps this a
 * pure function a test can pin to a fixed instant.
 */

const RELATIVE_TIME = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });

/** Largest unit that still counts at least one, so a three-day-old item reads days, not hours. */
const UNITS = [
  ["year", 31_536_000_000],
  ["month", 2_592_000_000],
  ["week", 604_800_000],
  ["day", 86_400_000],
  ["hour", 3_600_000],
  ["minute", 60_000],
] as const;

const formatRelativeTime = (input: Readonly<{ iso: string; now: number }>): string => {
  const elapsed = new Date(input.iso).getTime() - input.now;

  if (Number.isNaN(elapsed)) {
    return "";
  }

  const unit = UNITS.find(([, span]) => Math.abs(elapsed) >= span);

  return unit === undefined
    ? RELATIVE_TIME.format(0, "second")
    : RELATIVE_TIME.format(Math.round(elapsed / unit[1]), unit[0]);
};

export { formatRelativeTime };
