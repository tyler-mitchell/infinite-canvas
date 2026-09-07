import { useInfiniteCanvasSelector, type InfiniteCanvasSize } from "@hyphened/infinite-canvas";
import { prepareWithSegments } from "@chenglou/pretext";
import { useValue } from "@legendapp/state/react";
import { useEffect, useMemo, useState } from "react";
import { tv } from "ui/tv";

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

// Summary text holds this screen size while the canvas around it scales.
const SUMMARY_SCREEN_PX = 11;
const SUMMARY_LINE_HEIGHT = Math.round(SUMMARY_SCREEN_PX * 1.4);
/*
 * Padding follows the card rather than holding one size.
 *
 * A fixed 10px inset is a tenth of a full card and a third of a small one, so the further out the
 * canvas went the more of each card was margin. It scales with the shorter side and stops at 3px,
 * below which the text touches the hairline.
 */
const SUMMARY_PADDING_RATIO = 0.07;
const SUMMARY_PADDING_RANGE = { max: 10, min: 3 } as const;

const getSummaryPadding = (screenSize: Readonly<{ height: number; width: number }>) =>
  Math.max(
    SUMMARY_PADDING_RANGE.min,
    Math.min(
      SUMMARY_PADDING_RANGE.max,
      Math.min(screenSize.height, screenSize.width) * SUMMARY_PADDING_RATIO,
    ),
  );
// Pretext needs the canvas font shorthand. It has to name the same face as `--font-sans`.
const SUMMARY_FONT = `${String(SUMMARY_SCREEN_PX)}px "Geist Variable"`;

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
  const screenSize = { height: bodySize.height * zoom, width: bodySize.width * zoom };
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
