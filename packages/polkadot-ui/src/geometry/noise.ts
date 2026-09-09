/**
 * The kit's only source of pseudo-randomness. Deterministic, so a board, a chart and a
 * calendar draw the same thing on every load and a screenshot can be compared.
 */
export const hash01 = (index: number, seed = 0) => {
  const value = Math.sin(index * 12.9898 + seed) * 43758.5453;
  return value - Math.floor(value);
};
