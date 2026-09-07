import { useInfiniteCanvasSelector, type InfiniteCanvasSize } from "@hyphened/infinite-canvas";
import { prepareWithSegments } from "@chenglou/pretext";
import { useValue } from "@legendapp/state/react";
import { useEffect, useMemo, useState } from "react";
import { tv } from "ui/tv";

import {
  getSummaryPadding,
  getSummaryScreenSize,
  SUMMARY_FONT,
  SUMMARY_LINE_HEIGHT,
  SUMMARY_SCREEN_PX,
} from "../canvas/summary-metrics";
import type { WindowKind } from "../canvas/window-registry";
import { getClampedLines } from "../content/line-clamp";
import { ensureNoteLoaded, notes$, type NoteGateway } from "./note-store";
import { getNoteText } from "./note-text";

/*
 * A body earns its place only when two lines fit.
 *
 * One line of a wrapped note is one word at these widths, and a lone word reads as damage rather
 * than a preview. Measured at 1440x900: zoom 0.18 gave "Halves", 0.22 gave "Halves every".
 */
const MINIMUM_BODY_LINES = 2;

const noteSummary = tv({
  slots: {
    body: "min-h-0 overflow-hidden text-[var(--ink-faint)]",
    line: "truncate",
    root: "h-full overflow-hidden leading-[1.4]",
    title: "font-medium text-[var(--ink-muted)]",
  },
  variants: {
    // Without a body the title owns the card, so it centres instead of hanging from the top edge.
    titleOnly: {
      false: {
        root: "flex flex-col",
        title: "shrink-0 truncate",
      },
      true: {
        root: "grid place-items-center text-center",
        title: "line-clamp-2 max-w-full",
      },
    },
  },
});

/** Measuring before the web font loads describes the fallback face, so every width is wrong. */
function useFontsReady() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void document.fonts.ready.then(() => {
      if (!cancelled) setReady(true);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return ready;
}

export function NoteSummary({
  bodySize,
  gateway,
  noteId,
  title,
}: Readonly<{
  bodySize: InfiniteCanvasSize;
  gateway: NoteGateway;
  noteId: string;
  title: string;
}>) {
  const zoom = useInfiniteCanvasSelector<WindowKind, number>((state) => state.camera.zoom);
  const entry = useValue(notes$[noteId]);
  const fontsReady = useFontsReady();

  // The summary loads the note because the full body is not mounted at this zoom.
  useEffect(() => {
    ensureNoteLoaded(noteId, gateway);
  }, [gateway, noteId]);

  const text = entry?.note == null ? "" : getNoteText(entry.note.content.text);
  // One measurement pass per note. Zoom changes the box, never the text.
  const prepared = useMemo(
    () => (text === "" ? null : prepareWithSegments(text, SUMMARY_FONT)),
    [text],
  );

  /*
   * Screen space, because the font is a fixed number there and the card is not. The title takes
   * one line, and the padding is a screen distance too, so it does not grow as the canvas scales.
   */
  const screenSize = getSummaryScreenSize(bodySize, zoom);
  const padding = getSummaryPadding(screenSize);
  const bodyHeight = screenSize.height - padding * 2 - SUMMARY_LINE_HEIGHT;
  // Geometry decides the tier, not the loaded text, so the card does not change shape on load.
  const titleOnly = Math.floor(bodyHeight / SUMMARY_LINE_HEIGHT) < MINIMUM_BODY_LINES;
  const styles = noteSummary({ titleOnly });
  const lines =
    prepared === null || !fontsReady || titleOnly
      ? []
      : getClampedLines({
          lineHeight: SUMMARY_LINE_HEIGHT,
          maxHeight: bodyHeight,
          maxWidth: screenSize.width - padding * 2,
          prepared,
        });

  return (
    <div
      className={styles.root()}
      style={{
        fontSize: SUMMARY_SCREEN_PX / zoom,
        gap: (SUMMARY_LINE_HEIGHT - SUMMARY_SCREEN_PX) / zoom,
        padding: padding / zoom,
      }}
    >
      <span className={styles.title()}>{title}</span>
      {titleOnly ? null : (
        <div className={styles.body()}>
          {lines.map((line, index) => (
            <div className={styles.line()} key={`${String(index)}:${line}`}>
              {line}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
