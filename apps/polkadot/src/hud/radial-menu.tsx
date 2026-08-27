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
  const styles = radialMenu();

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setIsOpen(true);
      rootRef.current?.querySelector("button")?.focus();
    });

    return () => {
      cancelAnimationFrame(frame);
    };
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
        if (event.key === "Escape") {
          onClose();
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
          left: origin.x - WHEEL_SIZE / 2,
          top: origin.y - WHEEL_SIZE / 2,
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
                disabled={!item.isEnabled}
                onClick={() => {
                  item.run();
                  onClose();
                }}
                onPointerDown={(event) => {
                  // Otherwise the root's dismiss fires first and the click never lands.
                  event.stopPropagation();
                }}
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
