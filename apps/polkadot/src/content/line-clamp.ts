import { layoutWithLines, type PreparedTextWithSegments } from "@chenglou/pretext";

/**
 * The lines of a prepared text that fit a box, wrapped the way the browser would wrap them.
 *
 * Pretext measures with a canvas and breaks the lines itself, so this reads no DOM and causes no
 * reflow. `prepareWithSegments` does the one-time work; this call is arithmetic over cached
 * widths, cheap enough to run on every zoom step.
 *
 * Sizes are screen pixels. Canvas summary text holds a constant screen size while the world
 * around it scales, so screen space is the space where the font size is a fixed number.
 */
function getClampedLines(
  input: Readonly<{
    lineHeight: number;
    maxHeight: number;
    maxWidth: number;
    prepared: PreparedTextWithSegments;
  }>,
): readonly string[] {
  const rows = Math.floor(input.maxHeight / input.lineHeight);

  if (rows < 1 || input.maxWidth < 1) {
    return [];
  }

  const { lines } = layoutWithLines(input.prepared, input.maxWidth, input.lineHeight);

  return lines.slice(0, rows).map((line) => line.text);
}

export { getClampedLines };
