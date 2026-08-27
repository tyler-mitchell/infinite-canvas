import { Liquid } from "liquid-gooey";
import { useEffect, useRef, useState, type ComponentType } from "react";
import { tv } from "ui/tv";

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

/**
 * How far the items sit from the press, in screen pixels.
 *
 * Far enough that the blob has visibly split rather than bulged — under roughly twice the item's
 * own size the goo never necks apart and the wheel reads as one lump. Near enough that the whole
 * ring stays inside a modest window.
 */
const RADIUS = 78;

/** A spoke's own extent, matching the button's `size-11`. */
const ITEM_SIZE = 44;

/**
 * The group's box, and it has to contain the whole open ring.
 *
 * The library draws the goo into an SVG the size of the group, so a group sized to the press point
 * has nowhere to paint — the buttons still render, because they are real DOM on the layer above,
 * and the liquid simply does not appear. Which is exactly what the first attempt looked like: six
 * icons floating with nothing behind them.
 */
const WHEEL_SIZE = RADIUS * 2 + ITEM_SIZE;

/** Twelve o'clock, so the first verb is where the eye starts rather than wherever a loop began. */
const START_ANGLE = -Math.PI / 2;

/** Breathing room past the ring's own extent, so a clamped wheel is not flush to the edge. */
const EDGE_MARGIN = 8;

/**
 * The wheel opens where you pressed, unless that would put spokes outside the window.
 *
 * Measured before it was fixed: a press 20px from the bottom-right corner of an 812×998 viewport
 * put all six spokes off-screen — the ring reaches 100px in every direction and the press was 22px
 * from two edges, so most of the menu simply was not there.
 *
 * Clamped rather than flipped. A dropdown flips because it hangs off one corner and has a natural
 * other side; a ring has no sides, so moving it inward keeps every verb at the angle it was learned
 * at. The cost is that a cornered wheel is no longer centred on the pointer, and that is the right
 * trade against spokes nobody can reach.
 */
const clampToViewport = (origin: Readonly<{ x: number; y: number }>) => {
  const inset = WHEEL_SIZE / 2 + EDGE_MARGIN;

  return {
    x: Math.min(Math.max(origin.x, inset), Math.max(inset, window.innerWidth - inset)),
    y: Math.min(Math.max(origin.y, inset), Math.max(inset, window.innerHeight - inset)),
  };
};

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

/** Where item `index` of `count` sits, relative to the wheel's centre. */
const getSpoke = (index: number, count: number) => {
  const angle = START_ANGLE + (index / count) * Math.PI * 2;

  return { x: Math.round(Math.cos(angle) * RADIUS), y: Math.round(Math.sin(angle) * RADIUS) };
};

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
  const [centre] = useState(() => clampToViewport(origin));
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
   * The wheel does not focus itself, and that is a known gap rather than an oversight.
   *
   * Four attempts failed: in the mount effect, in an effect keyed on `isOpen`, inside
   * `requestAnimationFrame`, and inside `setTimeout`. Every one left `document.activeElement` as
   * `<body>` on a wheel that was demonstrably open with six spokes rendered.
   *
   * It is not the element. Calling `.focus()` on the same button from the console succeeds at 0,
   * 16, 50, 120, 300 and 500ms after opening, sticks for at least 600ms, and the node stays
   * connected and current — so nothing removes it and nothing steals focus. Something about
   * focusing from inside this component's own lifecycle is different, and I did not find what.
   *
   * Shipping without it rather than shipping a call that silently does nothing. The keyboard path
   * still exists: one spoke carries the tab stop, so Tab reaches the wheel, and the arrows turn it
   * from there.
   */

  return (
    <div
      className={styles.root()}
      onContextMenu={(event) => {
        // A second right-click dismisses rather than stacking a menu on a menu.
        event.preventDefault();
        onClose();
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          onClose();

          return;
        }

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
