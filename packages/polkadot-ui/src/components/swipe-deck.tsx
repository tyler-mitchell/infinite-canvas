import { useState } from "react";

import { tv } from "../tv.ts";

const swipeDeck = tv({
  slots: {
    well: "relative min-h-0 flex-1",
    card: "pk-swipe-face absolute inset-0 box-border flex touch-none flex-col justify-start gap-[10px] overflow-hidden rounded-[18px] border border-pk-swipe-line p-4 shadow-pk-swipe select-none",
    head: "flex flex-none items-center justify-between gap-2",
    kind: "font-pk-sans text-[10px] leading-none font-medium tracking-[0.05em] whitespace-nowrap text-pk-ink-dim uppercase",
    stamp:
      "rounded-[5px] border px-[7px] py-1 font-pk-sans text-[10px] leading-none font-medium tracking-[0.06em] whitespace-nowrap uppercase",
    pin: "border-pk-accent text-pk-accent",
    skip: "border-pk-line-strong text-pk-ink-dim",
    body: "flex min-h-0 flex-1 flex-col gap-1.5",
    title:
      "font-pk-sans text-[15px] leading-[1.25] font-medium tracking-[-0.02em] text-pretty text-pk-ink",
    prose:
      "m-0 min-h-0 flex-1 overflow-hidden font-pk-sans text-pk-note text-pretty text-pk-ink-soft",
    foot: "flex flex-none items-center justify-between gap-2 border-t border-pk-line-inner-raised pt-[9px] font-pk-mono text-pk-mono-sm text-pk-ink-faint",
    empty: "flex size-full items-center justify-center font-pk-sans text-pk-note text-pk-ink-faint",
    hint: "flex-none font-pk-mono text-pk-mono-sm text-pk-ink-faint",
  },
  variants: {
    held: {
      true: { card: "cursor-grabbing" },
      false: {
        card: "cursor-grab transition-transform duration-(--pk-duration-detail) ease-pk-settle",
      },
    },
  },
  defaultVariants: { held: false },
});

const COMMIT = 90;

export interface SwipeItem {
  readonly id: string;
  readonly kind: string;
  readonly title: string;
  readonly body: string;
  readonly left: string;
  readonly right: string;
}

export type SwipeDeckProps = Omit<React.ComponentProps<"div">, "children" | "onSelect"> & {
  readonly items: readonly SwipeItem[];
  /** Called with the item and which way it went once a card is committed. */
  readonly onSettle?: (item: SwipeItem, direction: "pin" | "skip") => void;
  readonly emptyLabel?: string;
};

function SwipeDeck({
  items,
  onSettle,
  emptyLabel = "nothing left",
  className,
  ...props
}: SwipeDeckProps) {
  const [cleared, setCleared] = useState(0);
  const [offset, setOffset] = useState(0);
  const [held, setHeld] = useState(false);
  const styles = swipeDeck({ held });

  const remaining = items.slice(cleared);
  const top = remaining[0];

  const settle = (direction: "pin" | "skip") => {
    if (top) onSettle?.(top, direction);
    setCleared((count) => count + 1);
    setOffset(0);
    setHeld(false);
  };

  const release = () => {
    if (Math.abs(offset) < COMMIT) {
      setOffset(0);
      setHeld(false);
      return;
    }
    settle(offset > 0 ? "pin" : "skip");
  };

  return (
    <div data-slot="swipe-deck" className={styles.well({ className })} {...props}>
      {top ? null : <span className={styles.empty()}>{emptyLabel}</span>}
      {remaining
        .slice(0, 3)
        .reverse()
        .map((item) => {
          const isTop = item.id === top?.id;
          const shift = isTop ? offset : 0;
          return (
            <div
              key={item.id}
              data-slot="swipe-card"
              tabIndex={isTop ? 0 : -1}
              style={{ transform: `translateX(${shift}px) rotate(${shift / 22}deg)` }}
              className={styles.card()}
              onPointerDown={
                isTop
                  ? (event) => {
                      event.currentTarget.setPointerCapture(event.pointerId);
                      setHeld(true);
                    }
                  : undefined
              }
              onPointerMove={
                isTop && held
                  ? (event) => setOffset((current) => current + event.movementX)
                  : undefined
              }
              onPointerUp={isTop ? release : undefined}
              onPointerCancel={isTop ? release : undefined}
              onKeyDown={
                isTop
                  ? (event) => {
                      const direction = { ArrowLeft: "skip", ArrowRight: "pin" }[event.key];
                      if (!direction) return;
                      event.preventDefault();
                      settle(direction as "pin" | "skip");
                    }
                  : undefined
              }
            >
              <div className={styles.head()}>
                <span className={styles.kind()}>{item.kind}</span>
                <span
                  style={{ opacity: isTop ? Math.max(0, Math.min(1, shift / COMMIT)) : 0 }}
                  className={styles.stamp({ className: styles.pin() })}
                >
                  pin
                </span>
                <span
                  style={{ opacity: isTop ? Math.max(0, Math.min(1, -shift / COMMIT)) : 0 }}
                  className={styles.stamp({ className: styles.skip() })}
                >
                  skip
                </span>
              </div>
              <div className={styles.body()}>
                <span className={styles.title()}>{item.title}</span>
                <p className={styles.prose()}>{item.body}</p>
                <div className={styles.foot()}>
                  <span>{item.left}</span>
                  <span>{item.right}</span>
                </div>
              </div>
            </div>
          );
        })}
    </div>
  );
}

export { SwipeDeck, swipeDeck as swipeDeckVariants };
