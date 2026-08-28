import { createContext, type CSSProperties, useCallback, useContext, useState } from "react";

import { useInfiniteCanvasState } from "./store";

/**
 * The canvas's screen-reader announcement channel.
 *
 * One live region per canvas, mounted for as long as the canvas is. It used to live inside the HUD,
 * which returns `null` when a consumer turns off its controls, dock, and status card — so whether
 * the canvas could speak depended on unrelated visual policy.
 *
 * A consumer reaches it with {@link useInfiniteCanvasAnnounce}. The canvas announces the active
 * window through the same element it always did; a consumer message uses a second region so the
 * two never overwrite each other.
 */

/** Screen-reader-only treatment (Tailwind sr-only). */
const VISUALLY_HIDDEN_STYLE = {
  borderWidth: 0,
  clip: "rect(0, 0, 0, 0)",
  height: "1px",
  margin: "-1px",
  overflow: "hidden",
  padding: 0,
  position: "absolute",
  whiteSpace: "nowrap",
  width: "1px",
} satisfies CSSProperties;

const InfiniteCanvasAnnouncerContext = createContext<((message: string) => void) | null>(null);

/**
 * Say something to a screen reader, from anywhere inside a canvas.
 *
 * Announcing the same string twice mutates nothing, so a repeat of the current message is not
 * spoken again. Outside a canvas this is a no-op rather than a throw: an announcement is never
 * load-bearing enough to fail a render over.
 */
function useInfiniteCanvasAnnounce(): (message: string) => void {
  const announce = useContext(InfiniteCanvasAnnouncerContext);

  return useCallback(
    (message: string) => {
      announce?.(message);
    },
    [announce],
  );
}

function InfiniteCanvasAnnouncer({ children }: Readonly<{ children: React.ReactNode }>) {
  const state = useInfiniteCanvasState();
  const [message, setMessage] = useState("");
  const activeWindow = state.windows.find((window) => window.id === state.activeWindowId);

  return (
    <InfiniteCanvasAnnouncerContext.Provider value={setMessage}>
      <div aria-live="polite" style={VISUALLY_HIDDEN_STYLE}>
        Active window {activeWindow?.title ?? "none"}.
      </div>
      <div aria-live="polite" style={VISUALLY_HIDDEN_STYLE}>
        {message}
      </div>
      {children}
    </InfiniteCanvasAnnouncerContext.Provider>
  );
}

export { InfiniteCanvasAnnouncer, useInfiniteCanvasAnnounce };
