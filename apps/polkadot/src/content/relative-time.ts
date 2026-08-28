/**
 * How long ago something happened, in words.
 *
 * `Intl.RelativeTimeFormat` is the platform's own, so there is no date library here and the wording
 * follows the reader's locale. `now` is an argument rather than a call inside, which keeps this a
 * pure function a test can pin to a fixed instant.
 */

const RELATIVE_TIME = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });

/** `narrow` is `Intl`'s own short form — "3d ago" — for rows with no width for a sentence. */
const RELATIVE_TIME_NARROW = new Intl.RelativeTimeFormat(undefined, {
  numeric: "auto",
  style: "narrow",
});

/** Largest unit that still counts at least one, so a three-day-old item reads days, not hours. */
const UNITS = [
  ["year", 31_536_000_000],
  ["month", 2_592_000_000],
  ["week", 604_800_000],
  ["day", 86_400_000],
  ["hour", 3_600_000],
  ["minute", 60_000],
] as const;

const format = (
  formatter: Intl.RelativeTimeFormat,
  input: Readonly<{ iso: string; now: number }>,
): string => {
  const elapsed = new Date(input.iso).getTime() - input.now;

  if (Number.isNaN(elapsed)) {
    return "";
  }

  const unit = UNITS.find(([, span]) => Math.abs(elapsed) >= span);

  return unit === undefined
    ? formatter.format(0, "second")
    : formatter.format(Math.round(elapsed / unit[1]), unit[0]);
};

const formatRelativeTime = (input: Readonly<{ iso: string; now: number }>): string =>
  format(RELATIVE_TIME, input);

/** The same instant where a row has room for a stamp and not for a sentence. */
const formatRelativeTimeNarrow = (input: Readonly<{ iso: string; now: number }>): string =>
  format(RELATIVE_TIME_NARROW, input);

export { formatRelativeTime, formatRelativeTimeNarrow };
