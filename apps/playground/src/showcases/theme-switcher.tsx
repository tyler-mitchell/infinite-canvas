import { useEffect, useState } from "react";

/** The document root owns theme tokens so portals inherit them. */
const THEME_ATTRIBUTE = "data-canvas-theme";

type CanvasTheme = "dark" | "light";

export function CanvasThemeSwitcher() {
  const [theme, setTheme] = useState<CanvasTheme>("dark");

  useEffect(() => {
    const root = document.documentElement;

    // The framework default theme uses no attribute.
    if (theme === "light") {
      root.setAttribute(THEME_ATTRIBUTE, "light");
    } else {
      root.removeAttribute(THEME_ATTRIBUTE);
    }

    return () => {
      root.removeAttribute(THEME_ATTRIBUTE);
    };
  }, [theme]);

  return (
    <button
      className="pointer-events-auto rounded-md border border-border bg-popover/90 px-2.5 py-1 font-mono text-[10px] tracking-wider text-muted-foreground uppercase backdrop-blur transition-colors hover:text-foreground"
      onClick={() => {
        setTheme((current) => (current === "dark" ? "light" : "dark"));
      }}
      onPointerDown={(event) => {
        // stopPropagation blocks the button event before the canvas can start a marquee.
        event.stopPropagation();
      }}
      title="Toggle the canvas theme. The light look is consumer CSS, not a framework export."
      type="button"
    >
      {theme === "dark" ? "◐ light" : "◑ dark"}
    </button>
  );
}
