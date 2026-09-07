import type { InfiniteCanvasSize } from "@hyphened/infinite-canvas";

/*
 * What every summary card agrees on.
 *
 * Text holds a constant screen size while the canvas scales, so a card reads the same at any zoom
 * until it runs out of room. Both summary kinds used to set this separately, and their padding then
 * disagreed: one held ten screen pixels whatever the card, the other held sixteen world units and
 * shrank to nothing.
 */
const SUMMARY_SCREEN_PX = 11;
const SUMMARY_LINE_HEIGHT = Math.round(SUMMARY_SCREEN_PX * 1.4);

/** Pretext needs the canvas font shorthand, naming the same face as `--font-sans`. */
const SUMMARY_FONT = `${String(SUMMARY_SCREEN_PX)}px "Geist Variable"`;

/*
 * Padding follows the card rather than holding one size.
 *
 * A fixed inset is a tenth of a full card and two thirds of a small one, so the further out the
 * canvas goes the more of each card is margin. It scales with the shorter side and stops at 3px,
 * below which the text touches the hairline.
 */
const SUMMARY_PADDING_RATIO = 0.07;
const SUMMARY_PADDING_RANGE = { max: 10, min: 3 } as const;

/** The screen-space box a summary draws into, from the body size the canvas reports. */
const getSummaryScreenSize = (bodySize: InfiniteCanvasSize, zoom: number) => ({
  height: bodySize.height * zoom,
  width: bodySize.width * zoom,
});

const getSummaryPadding = (screenSize: InfiniteCanvasSize) =>
  Math.max(
    SUMMARY_PADDING_RANGE.min,
    Math.min(
      SUMMARY_PADDING_RANGE.max,
      Math.min(screenSize.height, screenSize.width) * SUMMARY_PADDING_RATIO,
    ),
  );

export {
  getSummaryPadding,
  getSummaryScreenSize,
  SUMMARY_FONT,
  SUMMARY_LINE_HEIGHT,
  SUMMARY_PADDING_RANGE,
  SUMMARY_SCREEN_PX,
};
