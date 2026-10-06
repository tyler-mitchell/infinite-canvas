// Keep now as an argument so callers can use a fixed instant.
const RELATIVE_TIME = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });

const RELATIVE_TIME_NARROW = new Intl.RelativeTimeFormat(undefined, {
  numeric: "auto",
  style: "narrow",
});

// Use the largest unit with an absolute value of at least one.
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

const formatRelativeTimeNarrow = (input: Readonly<{ iso: string; now: number }>): string =>
  format(RELATIVE_TIME_NARROW, input);

export { formatRelativeTime, formatRelativeTimeNarrow };
