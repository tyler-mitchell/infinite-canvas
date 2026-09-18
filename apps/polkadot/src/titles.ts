const escapeForPattern = (label: string) =>
  label.replaceAll(/[.*+?^${}()|[\]\\]/gu, String.raw`\$&`);

function getNextOrdinal({
  label,
  titles,
  minimum,
}: Readonly<{
  label: string;
  titles: readonly string[];
  minimum: bigint;
}>) {
  const pattern = new RegExp(`^${escapeForPattern(label)} (\\d+)$`, "u");

  return titles.reduce((next, title) => {
    const ordinal = pattern.exec(title)?.[1];
    if (ordinal === undefined) return next;
    const candidate = BigInt(ordinal) + 1n;
    return candidate > next ? candidate : next;
  }, minimum);
}

function getNextNumberedTitle(label: string, titles: readonly string[]): string {
  return `${label} ${getNextOrdinal({ label, titles, minimum: 1n })}`;
}

function getNextRepeatTitle(label: string, titles: readonly string[]): string {
  return titles.includes(label)
    ? `${label} ${getNextOrdinal({ label, titles, minimum: 2n })}`
    : label;
}

function getNextSuffixedTitle(
  input: Readonly<{ mark: string; takenTitles: readonly string[]; title: string }>,
): string {
  const marked = new RegExp(` ${escapeForPattern(input.mark)}(?: \\d+)?$`, "u");

  return getNextRepeatTitle(`${input.title.replace(marked, "")} ${input.mark}`, input.takenTitles);
}

export { getNextNumberedTitle, getNextRepeatTitle, getNextSuffixedTitle };
