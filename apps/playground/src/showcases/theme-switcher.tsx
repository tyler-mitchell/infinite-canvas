import { useEffect, useState } from "react";

/**
 * Toggles the canvas between its two complete looks.
 *
 * The framework ships one theme and a token contract; the second look is consumer CSS
 * (`../canvas-light-theme.css`), which is the point — it demonstrates that a theme written from
 * outside the package can reach every colour. This control only sets an attribute; the whole
 * theme is the stylesheet.
 *
 * Written on `documentElement` rather than on the canvas so portalled content — which mounts
 * outside the window transform, and therefore outside the viewport element — is themed too. A
 * switcher that leaves popovers dark on a light canvas has not demonstrated a second look, it has
 * demonstrated a bug.
 */

const THEME_ATTRIBUTE = "data-canvas-theme";

type CanvasTheme = "dark" | "light";

export function CanvasThemeSwitcher() {
  const [theme, setTheme] = useState<CanvasTheme>("dark");

  useEffect(() => {
    const root = document.documentElement;

    // `dark` is the framework default and needs no attribute; removing it rather than writing
    // `="dark"` keeps the default path identical to a consumer who never adopted a switcher.
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
        // The overlay sits inside the canvas's React tree; without this the pointerdown reaches
        // the canvas root and starts a marquee behind the button.
        event.stopPropagation();
      }}
      title="Toggle the canvas theme. The light look is consumer CSS, not a framework export."
      type="button"
    >
      {theme === "dark" ? "◐ light" : "◑ dark"}
    </button>
  );
}
