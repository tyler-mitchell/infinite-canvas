import { useValue } from "@legendapp/state/react";
import { createContext, type CSSProperties, useCallback, useContext, useState } from "react";

import { useInfiniteCanvasState$ } from "./store";

/** Provides separate live regions for active-window and consumer messages. */

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

/** Sends a message to the nearest canvas live region. Outside a canvas, it does nothing. */
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
  const state$ = useInfiniteCanvasState$();
  const activeTitle = useValue(() => {
    const activeWindowId = state$.activeWindowId.get();
    return state$.windows.get().find((window) => window.id === activeWindowId)?.title ?? "none";
  });
  const [message, setMessage] = useState("");

  return (
    <InfiniteCanvasAnnouncerContext.Provider value={setMessage}>
      <div aria-live="polite" style={VISUALLY_HIDDEN_STYLE}>
        Active window {activeTitle}.
      </div>
      <div aria-live="polite" style={VISUALLY_HIDDEN_STYLE}>
        {message}
      </div>
      {children}
    </InfiniteCanvasAnnouncerContext.Provider>
  );
}

export { InfiniteCanvasAnnouncer, useInfiniteCanvasAnnounce };
