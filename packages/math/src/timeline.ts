export function timelineDuration(segments: readonly { at: number; duration: number }[]): number {
  return segments.reduce((end, segment) => Math.max(end, segment.at + segment.duration), 0);
}
