import { useState } from "react";

import { tv } from "../tv.ts";

const swipeDeck = tv({
  slots: {
    well: "relative min-h-0 flex-1",
    card: "pk-swipe-face absolute inset-0 box-border flex touch-none flex-col justify-start gap-[10px] overflow-hidden rounded-[18px] border border-pk-swipe-line p-4 shadow-pk-swipe select-none",
    head: "flex flex-none items-center justify-between gap-2",
    kind: "font-pk-sans text-pk-micro whitespace-nowrap text-pk-ink-dim uppercase",
    stamp:
      "rounded-[5px] border px-[7px] py-1 font-pk-sans text-[10px] leading-none font-medium tracking-[0.06em] whitespace-nowrap uppercase",
    pin: "border-pk-accent text-pk-accent",
    skip: "border-pk-line-strong text-pk-ink-dim",
    body: "flex min-h-0 flex-1 flex-col gap-1.5",
    title:
      "font-pk-sans text-[15px] leading-[1.25] font-medium tracking-[-0.02em] break-words text-pretty text-pk-ink",
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

export type SwipeOutcome = "pin" | "skip" | "return";

/** Which way a card goes when the pointer is released at `offset`, in pixels from its rest. */
export function swipeOutcome(offset: number, commit = COMMIT): SwipeOutcome {
  if (Math.abs(offset) < commit) return "return";

  return offset > 0 ? "pin" : "skip";
}

/**
 * How far each stamp has faded in, from 0 at rest to 1 at the commit distance. Only the stamp on
 * the side being dragged towards shows, so the pair never reads as both at once.
 */
export function stampOpacity(offset: number, commit = COMMIT) {
  const reach = Math.min(1, Math.abs(offset) / commit);

  return { pin: offset > 0 ? reach : 0, skip: offset < 0 ? reach : 0 };
}

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

/**
 * A queue you sort by dragging, by swiping, or with the arrow keys. It remembers which items it
 * settled by id rather than counting them, so a changed `items` list adds and removes correctly
 * and a card that has been dealt with stays gone.
 */
function SwipeDeck({
  items,
  onSettle,
  emptyLabel = "nothing left",
  className,
  ...props
}: SwipeDeckProps) {
  const [settled, setSettled] = useState<readonly string[]>([]);
  const [offset, setOffset] = useState(0);
  const [held, setHeld] = useState(false);
  const styles = swipeDeck({ held });

  const remaining = items.filter((item) => !settled.includes(item.id));
  const top = remaining[0];

  const settle = (direction: "pin" | "skip") => {
    if (!top) return;
    onSettle?.(top, direction);
    setSettled((ids) => [...ids, top.id]);
    setOffset(0);
    setHeld(false);
  };

  const release = () => {
    const outcome = swipeOutcome(offset);

    if (outcome === "return") {
      setOffset(0);
      setHeld(false);
      return;
    }
    settle(outcome);
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
          const stamps = stampOpacity(shift);
          return (
            <div
              key={item.id}
              data-slot="swipe-card"
              tabIndex={isTop ? 0 : -1}
              /* The card takes the focus and the arrows act on it, so it says which arrows. */
              aria-keyshortcuts={isTop ? "ArrowLeft ArrowRight" : undefined}
              style={{ transform: `translateX(${shift}px) rotate(${shift / 22}deg)` }}
              className={styles.card()}
              onPointerDown={
                isTop
                  ? (event) => {
                      try {
                        event.currentTarget.setPointerCapture(event.pointerId);
                      } catch {
                        console.warn("swipe deck: no pointer capture, dragging from state instead");
                      }
                      setHeld(true);
                    }
                  : undefined
              }
              onPointerMove={
                isTop
                  ? (event) => {
                      const dragging =
                        held || event.currentTarget.hasPointerCapture(event.pointerId);
                      if (!dragging) return;
                      setOffset((current) => current + event.movementX);
                    }
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
                  style={{ opacity: stamps.pin }}
                  className={styles.stamp({ className: styles.pin() })}
                >
                  pin
                </span>
                <span
                  style={{ opacity: stamps.skip }}
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
