import { Liquid } from "liquid-gooey";
import { useEffect, useRef, useState, type ComponentType } from "react";
import { tv } from "ui/tv";

import { clampToViewport, getSpoke, ITEM_SIZE, WHEEL_SIZE } from "./radial-geometry";

/**
 * A wheel of verbs, blooming from where you pressed.
 *
 * A radial menu is worth the trouble over a list for one reason: on a canvas the pointer is
 * already where the work is, so the shortest path to a verb is outward from it rather than down a
 * column anchored to a corner. Every item is the same distance away, which a list cannot offer —
 * the tenth row is always further than the first.
 *
 * `liquid-gooey`'s morph is what makes it read as one thing opening rather than several appearing.
 * The items share the group's goo filter, so at rest they are a single blob at the centre and the
 * open gesture is that mass splitting — which is the library's headline case, and the reason the
 * effect earns its place here rather than decorating a menu that would work without it.
 *
 * **Screen space, never inside the camera transform.** The library measures DOM rects in device
 * pixels; anything drawn under the world→screen scale is measured wrong. Same rule the group rail's
 * indicator follows.
 *
 * The content layer is real buttons — the library's whole design is that the liquid is a silhouette
 * behind live DOM, so focus, hit targets and accessible names survive. A canvas menu only a mouse
 * can reach would also fail the rule in `AGENTS.md` that every capability stays reachable.
 */

type RadialItem = Readonly<{
  icon: ComponentType<Readonly<{ className?: string }>>;
  /** A spoke keeps its place when it cannot be used. Position is the thing a wheel is learned by. */
  isEnabled: boolean;
  label: string;
  run: () => void;
}>;

const radialMenu = tv({
  slots: {
    button:
      "group/item grid size-11 place-items-center rounded-full transition-colors duration-150 ease-[var(--ease-swift)] outline-none [&_svg]:size-4",
    group: "pointer-events-none absolute",
    /*
     * Centred by offsetting its own box, never by a transform.
     *
     * `Liquid.Item` mirrors the element's geometry into the silhouette layer and applies its own
     * transform for `x`/`y`. A `-translate-x-1/2` here composes with that, so the blob and the
     * button it is supposed to sit under end up half an item apart — watched: six dark circles with
     * their icons beside them rather than on them.
     */
    item: "pointer-events-auto absolute",
    label:
      "pointer-events-none absolute top-full left-1/2 mt-1 -translate-x-1/2 rounded-[var(--radius-sm)] bg-[var(--surface-raised)] px-1.5 py-0.5 text-[11px] whitespace-nowrap text-[var(--ink)] opacity-0 shadow-[var(--lift-1)] transition-opacity duration-150 ease-[var(--ease-swift)] group-hover/item:opacity-100 group-focus-visible/item:opacity-100",
    root: "fixed inset-0 z-90",
  },
  variants: {
    enabled: {
      false: { button: "text-[var(--ink-faint)] opacity-40" },
      true: {
        button:
          "text-[var(--ink-muted)] hover:text-[var(--ink)] focus-visible:text-[var(--ink)] cursor-pointer",
      },
    },
  },
});

/**
 * Which spoke an arrow moves to, going round rather than along.
 *
 * Both arrow pairs turn the wheel, which is why the framework's `getNextInfiniteCanvasRovingIndex`
 * is not reused here even setting aside that it is internal: it takes one axis, because a tab strip
 * and an accordion each have one. A ring has none — every direction is around it — and Left/Up
 * turning one way while Right/Down turns the other is the whole contract.
 *
 * Disabled spokes are stepped over rather than landed on. They keep their place on screen, because
 * position is what a wheel is learned by, but focus stopping on something that cannot be used is a
 * dead key press.
 */
function getNextSpoke(key: string, index: number, items: readonly RadialItem[]): number | null {
  const step = { ArrowDown: 1, ArrowLeft: -1, ArrowRight: 1, ArrowUp: -1 }[key];

  if (step === undefined) {
    return key === "Home" || key === "End"
      ? (key === "Home" ? items : [...items].reverse()).reduce<number | null>(
          (found, item, offset) =>
            found ??
            (item.isEnabled ? (key === "Home" ? offset : items.length - 1 - offset) : null),
          null,
        )
      : null;
  }

  // At most one full turn: if nothing else is usable, focus stays where it is.
  for (let turn = 1; turn <= items.length; turn++) {
    const candidate = (index + step * turn + items.length * turn) % items.length;

    if (items[candidate]?.isEnabled === true) {
      return candidate;
    }
  }

  return null;
}

function RadialMenu({
  items,
  onClose,
  origin,
}: Readonly<{
  items: readonly RadialItem[];
  onClose: () => void;
  origin: Readonly<{ x: number; y: number }>;
}>) {
  const rootRef = useRef<HTMLDivElement>(null);
  /*
   * Mounted closed and opened on the next frame, so the items animate out of the centre. Rendering
   * them already fanned would show a ring appearing, which is a different gesture — the split is
   * the whole point of using a goo filter rather than positioning six buttons.
   */
  const [isOpen, setIsOpen] = useState(false);
  /** The one spoke carrying the tab stop, so Tab leaves the wheel rather than walking it. */
  const [focusedIndex, setFocusedIndex] = useState(() =>
    Math.max(
      0,
      items.findIndex((item) => item.isEnabled),
    ),
  );
  const styles = radialMenu();
  // Read at open. The wheel is transient, so a resize under it is not a case worth carrying state for.
  const [centre] = useState(() =>
    clampToViewport(origin, { height: window.innerHeight, width: window.innerWidth }),
  );
  const focusSpoke = (index: number) => {
    setFocusedIndex(index);
    rootRef.current?.querySelector<HTMLButtonElement>(`[data-spoke="${String(index)}"]`)?.focus();
  };

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setIsOpen(true);
    });

    return () => {
      cancelAnimationFrame(frame);
    };
  }, []);

  /*
   * Escape is heard on the document, not on the overlay.
   *
   * Dismissal is not focus-scoped the way arrowing between spokes is. Turning the wheel is a
   * question about the thing you are already in; closing it is a question about the whole screen,
   * and the same reasoning already puts the `contextmenu` listener that opens it on the document.
   *
   * The wheel does take focus on open, so the overlay's own handler would usually hear Escape —
   * but "usually" is the problem. Focus leaves for ordinary reasons, and an event whose target is
   * `<body>` never enters the React root at all, so no component handler can see it. Measured:
   * an ArrowRight aimed at the document left focus where it was, while the same key aimed at a
   * spoke moved it. A menu that can only be dismissed from inside itself is a trap.
   *
   * Capture, so the wheel answers first. The framework binds Escape too — cancelling an
   * interaction, clearing a selection — and dismissing a menu should not also undo something
   * behind it.
   */
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
      }
    };

    document.addEventListener("keydown", handleEscape, true);

    return () => {
      document.removeEventListener("keydown", handleEscape, true);
    };
  }, [onClose]);

  /*
   * The wheel takes focus when it opens.
   *
   * A menu you just opened is the thing you are working in, so the arrows should turn it and
   * Escape should close it without first pressing Tab to get in. Without this the wheel is
   * reachable only after a tab stop nobody thinks to look for.
   *
   * It asks the DOM which spoke carries the tab stop rather than reading `focusedIndex`, so the
   * effect depends on nothing and runs once. Keying it to the index would re-run on every arrow
   * press and fight the very navigation it exists to enable.
   *
   * A previous version of this comment said auto-focus was impossible here, citing four attempts
   * that left `document.activeElement` as `<body>`. That was wrong, and it was measurement rather
   * than behaviour: each probe dispatched a second `contextmenu` at an already-open wheel, the
   * dismiss handler closed it, and the reading was taken on a menu that no longer existed. Opening
   * and reading in one probe shows focus landing on the first enabled spoke and still there half a
   * second later, on the canvas ring and the window ring alike.
   */
  useEffect(() => {
    rootRef.current?.querySelector<HTMLButtonElement>('[data-spoke][tabindex="0"]')?.focus();
  }, []);

  return (
    <div
      className={styles.root()}
      onContextMenu={(event) => {
        // A second right-click dismisses rather than stacking a menu on a menu.
        event.preventDefault();
        onClose();
      }}
      onKeyDown={(event) => {
        // Escape is handled on the document above, so this is only about turning the wheel.
        const next = getNextSpoke(event.key, focusedIndex, items);

        if (next !== null) {
          // Otherwise Home/End scroll the page and the arrows pan the canvas underneath.
          event.preventDefault();
          focusSpoke(next);
        }
      }}
      onPointerDown={(event) => {
        // Anywhere off the wheel closes it. The items stop this at their own level.
        event.stopPropagation();
        onClose();
      }}
      ref={rootRef}
    >
      <Liquid
        blur={9}
        className={styles.group()}
        contrast={20}
        fill="var(--surface-raised)"
        shadow="0 8px 24px rgba(0,0,0,0.45)"
        style={{
          height: WHEEL_SIZE,
          left: centre.x - WHEEL_SIZE / 2,
          top: centre.y - WHEEL_SIZE / 2,
          width: WHEEL_SIZE,
        }}
      >
        {items.map((item, index) => {
          const spoke = getSpoke(index, items.length);
          const Icon = item.icon;

          return (
            <Liquid.Item
              className={styles.item()}
              // Staggered so the ring unfurls rather than snapping open as one shape.
              delay={index * 18}
              key={item.label}
              style={{ left: (WHEEL_SIZE - ITEM_SIZE) / 2, top: (WHEEL_SIZE - ITEM_SIZE) / 2 }}
              transition="bouncy"
              x={isOpen ? spoke.x : 0}
              y={isOpen ? spoke.y : 0}
            >
              <button
                aria-label={item.label}
                className={styles.button({ enabled: item.isEnabled })}
                data-spoke={index}
                disabled={!item.isEnabled}
                onClick={() => {
                  item.run();
                  onClose();
                }}
                onFocus={() => {
                  // Pointer focus and key focus agree, so arrowing after hovering continues from
                  // where the eye already is rather than from wherever the ring was opened.
                  setFocusedIndex(index);
                }}
                onPointerDown={(event) => {
                  // Otherwise the root's dismiss fires first and the click never lands.
                  event.stopPropagation();
                }}
                tabIndex={index === focusedIndex ? 0 : -1}
                type="button"
              >
                <Icon />
                <span className={styles.label()}>{item.label}</span>
              </button>
            </Liquid.Item>
          );
        })}
      </Liquid>
    </div>
  );
}

export { RadialMenu };
export type { RadialItem };
