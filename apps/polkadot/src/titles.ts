const escapeForPattern = (label: string) =>
  label.replaceAll(/[.*+?^${}()|[\]\\]/gu, String.raw`\$&`);

function getUsedOrdinals(label: string, titles: readonly string[]): readonly number[] {
  const pattern = new RegExp(`^${escapeForPattern(label)} (\\d+)$`, "u");

  return titles.flatMap((title) => {
    const ordinal = pattern.exec(title)?.[1];

    return ordinal === undefined ? [] : [Number(ordinal)];
  });
}

function getNextNumberedTitle(label: string, titles: readonly string[]): string {
  return `${label} ${String(Math.max(0, ...getUsedOrdinals(label, titles)) + 1)}`;
}

function getNextRepeatTitle(label: string, titles: readonly string[]): string {
  return titles.includes(label)
    ? `${label} ${String(Math.max(1, ...getUsedOrdinals(label, titles)) + 1)}`
    : label;
}

function getNextSuffixedTitle(
  input: Readonly<{ mark: string; takenTitles: readonly string[]; title: string }>,
): string {
  const marked = new RegExp(` ${escapeForPattern(input.mark)}(?: \\d+)?$`, "u");

  return getNextRepeatTitle(`${input.title.replace(marked, "")} ${input.mark}`, input.takenTitles);
}

export { getNextNumberedTitle, getNextRepeatTitle, getNextSuffixedTitle };
