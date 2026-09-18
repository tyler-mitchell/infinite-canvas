import { Liquid } from "liquid-gooey";
import { useEffect, useRef, useState, type ComponentType } from "react";
import { tv } from "ui/tv";

import { clampToViewport, getSpoke, ITEM_SIZE, WHEEL_SIZE } from "./radial-geometry";

type RadialItem = Readonly<{
  icon: ComponentType<Readonly<{ className?: string }>>;
  isEnabled: boolean;
  label: string;
  run: () => void;
}>;

const radialMenu = tv({
  slots: {
    button:
      "group/item grid size-11 place-items-center rounded-full transition-colors duration-150 ease-[var(--ease-swift)] outline-none [&_svg]:size-4",
    group: "pointer-events-none absolute",
    // Liquid.Item controls transforms, so this slot uses offsets.
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

export function getNextSpoke(
  key: string,
  index: number,
  items: readonly Pick<RadialItem, "isEnabled">[],
): number | null {
  const enabledIndices = items.flatMap((item, index) => (item.isEnabled ? [index] : []));
  switch (key) {
    case "Home":
      return enabledIndices[0] ?? null;
    case "End":
      return enabledIndices.at(-1) ?? null;
    case "ArrowDown":
    case "ArrowRight":
      return enabledIndices.find((candidate) => candidate > index) ?? enabledIndices[0] ?? null;
    case "ArrowLeft":
    case "ArrowUp":
      return (
        enabledIndices.findLast((candidate) => candidate < index) ?? enabledIndices.at(-1) ?? null
      );
    default:
      return null;
  }
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
  const [isOpen, setIsOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(() =>
    Math.max(
      0,
      items.findIndex((item) => item.isEnabled),
    ),
  );
  const styles = radialMenu();
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

  // Capture Escape before the canvas can handle the same key.
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

  useEffect(() => {
    rootRef.current?.querySelector<HTMLButtonElement>('[data-spoke][tabindex="0"]')?.focus();
  }, []);

  return (
    <div
      className={styles.root()}
      onContextMenu={(event) => {
        event.preventDefault();
        onClose();
      }}
      onKeyDown={(event) => {
        const next = getNextSpoke(event.key, focusedIndex, items);

        if (next !== null) {
          event.preventDefault();
          focusSpoke(next);
        }
      }}
      onPointerDown={(event) => {
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
                  setFocusedIndex(index);
                }}
                onPointerDown={(event) => {
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
