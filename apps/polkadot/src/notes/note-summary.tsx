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

const noteSummary = tv({
  slots: {
    body: "min-h-0 overflow-hidden text-[var(--ink-faint)]",
    line: "truncate",
    root: "flex h-full flex-col leading-[1.4]",
    title: "shrink-0 truncate font-medium text-[var(--ink-muted)]",
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
  const styles = noteSummary();

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
  const lines =
    prepared === null || !fontsReady
      ? []
      : getClampedLines({
          lineHeight: SUMMARY_LINE_HEIGHT,
          maxHeight: screenSize.height - padding * 2 - SUMMARY_LINE_HEIGHT,
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
      <div className={styles.body()}>
        {lines.map((line, index) => (
          <div className={styles.line()} key={`${String(index)}:${line}`}>
            {line}
          </div>
        ))}
      </div>
    </div>
  );
}
