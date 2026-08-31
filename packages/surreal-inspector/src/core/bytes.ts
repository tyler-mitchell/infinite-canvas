const encoder = new TextEncoder();

/** This function measures the encoded JSON payload, not database storage. */
function measureJsonBytes(value: unknown) {
  const encoded = JSON.stringify(value);

  return encoded === undefined ? 0 : encoder.encode(encoded).length;
}

function measureTextBytes(text: string) {
  return encoder.encode(text).length;
}

const SIZE_UNITS = ["B", "kB", "MB", "GB", "TB"] as const;

/** This function uses decimal units to match browser storage APIs. */
function formatBytes(bytes: number | null): string {
  if (bytes === null) {
    return "—";
  }

  const magnitude = Math.min(
    SIZE_UNITS.length - 1,
    bytes <= 0 ? 0 : Math.floor(Math.log10(bytes) / 3),
  );
  const scaled = bytes / 1000 ** magnitude;

  return `${scaled.toFixed(magnitude === 0 ? 0 : 1)} ${SIZE_UNITS[magnitude] ?? "B"}`;
}

function formatCount(value: number | null) {
  return value === null ? "—" : value.toLocaleString();
}

function formatDuration(milliseconds: number) {
  return milliseconds < 1
    ? `${milliseconds.toFixed(2)} ms`
    : milliseconds < 1000
      ? `${milliseconds.toFixed(1)} ms`
      : `${(milliseconds / 1000).toFixed(2)} s`;
}

export { formatBytes, formatCount, formatDuration, measureJsonBytes, measureTextBytes };
