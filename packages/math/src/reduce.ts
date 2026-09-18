export function minOf(values: readonly number[]): number {
  return values.reduce((lowest, value) => Math.min(lowest, value), Number.POSITIVE_INFINITY);
}

export function maxOf(values: readonly number[]): number {
  return values.reduce((highest, value) => Math.max(highest, value), Number.NEGATIVE_INFINITY);
}
