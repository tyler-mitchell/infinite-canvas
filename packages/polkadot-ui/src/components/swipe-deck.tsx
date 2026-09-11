import { useState } from "react";

import { tv } from "../tv.ts";
import { Readout } from "./text.tsx";

const swipeDeck = tv({
  slots: {
    well: "relative min-h-0 flex-1 rounded-pk-card outline-none focus-visible:ring-2 focus-visible:ring-pk-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-(color:--pk-ring-seat)",
    card: "pk-swipe-face absolute inset-0 box-border flex touch-none flex-col justify-start gap-2.5 overflow-hidden rounded-pk-card border border-pk-swipe-line p-4 shadow-pk-swipe select-none",
    head: "flex flex-none items-center justify-between gap-2",
    kind: "font-pk-sans text-pk-micro whitespace-nowrap text-pk-ink-dim uppercase",
    stamp:
      "rounded-[5px] border px-[7px] py-1 font-pk-sans text-pk-micro tracking-[0.06em] whitespace-nowrap uppercase",
    pin: "border-pk-accent text-pk-accent",
    skip: "border-pk-line-strong text-pk-ink-dim",
    body: "flex min-h-0 flex-1 flex-col gap-1.5",
    /*
     * Clamped rather than free: a card cannot grow, so a title long enough to fill it pushed the
     * foot 116px past the bottom edge and the reader lost a whole line of the card rather than a
     * few words. Three lines is one more than the longest the deck draws — two lines on a card of
     * 297, which is what a screen of 375 gives it, and one line at 1280.
     *
     * The clamp was measured holding rather than assumed: a title of about 190 characters stops at
     * three lines with a fourth hidden, and the card's box and its foot do not move. The figures and
     * the probe are in `docs/internal/layout-probes.md`, since no test here has a layout engine.
     */
    title: "line-clamp-3 font-pk-sans text-pk-title break-words text-pretty text-pk-ink",
    /*
     * The body scrolls rather than clips, and takes a vertical touch of its own so a reader can
     * reach the rest of it while the card still takes a sideways one. A card is stacked absolutely
     * and cannot grow, so with the text spacing a reader is entitled to ask for, the head and the
     * foot grew and squeezed this from 91 to 34 and cut the last line off.
     */
    prose:
      "m-0 min-h-0 flex-1 touch-pan-y overflow-y-auto font-pk-sans text-pk-note break-words text-pretty text-pk-ink-soft",
    foot: "flex flex-none items-center justify-between gap-2 border-t border-pk-line-inner-raised pt-[9px] font-pk-mono text-pk-mono-sm text-pk-ink-faint",
    end: "min-w-0 truncate",
    empty: "flex size-full items-center justify-center font-pk-sans text-pk-note text-pk-ink-faint",
    hint: "flex-none font-pk-mono text-pk-mono-sm text-pk-ink-faint",
    outcome: "sr-only",
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

/** One source for each name, so a blank one falls back to what the signature already promises. */
const DEFAULT_LABEL = "queue";
const DEFAULT_EMPTY = "nothing left";

export type SwipeOutcome = "pin" | "skip" | "return";

/** Which way a card goes when the pointer is released at `offset`, in pixels from its rest. */
export function swipeOutcome(offset: number, commit = COMMIT): SwipeOutcome {
  if (Math.abs(offset) < commit) return "return";

  return offset > 0 ? "pin" : "skip";
}

/**
 * The cards still in the deck, oldest first. Kept by id rather than by counting, so a changed
 * `items` adds and removes correctly and a card already dealt with stays gone.
 *
 * Asked of a set rather than a list. Read from a list this scanned the whole of what had settled
 * once per card, so the cost grew with the square of the deck — and it is recomputed on every
 * pointer move, since dragging a card sets its offset and draws again.
 *
 * Measured rather than assumed, and the growth is the point rather than any frame it saved: a deck
 * of two hundred cost a tenth of a millisecond as a list, and only a thousand reached a quarter of
 * a frame. The figures are in `docs/internal/layout-probes.md`.
 *
 * Two cards sharing an id leave together, which is what the id being the identity means: settling
 * either takes both, and the reader never meets the second.
 */
export function remainingOf<Item extends { readonly id: string }>(
  items: readonly Item[],
  settled: ReadonlySet<string>,
) {
  return items.filter((item) => !settled.has(item.id));
}

/**
 * What a settled card says. The card unmounts and the next takes its place with the focus still on
 * the well, so this is the only thing that reaches a reader who cannot see the change: the outcome,
 * which cannot be recovered by looking, and what is now on top.
 *
 * Never the middle dot the kit sets between figures: this line is only ever spoken, and a dot chosen
 * for visual rhythm is either silence or the words "middle dot" depending on the reader. A full stop
 * rather than a comma, because a title may hold commas of its own — one of the demo cards is called
 * "Snap against predicted rest, not the pointer", and a comma here left three in one sentence.
 *
 * The titles are the consumer's words and go out as written, punctuation and all.
 */
export function settledAs(direction: "pin" | "skip", title: string, next: string) {
  return `${direction === "pin" ? "pinned" : "skipped"} ${title}. next ${next}`;
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
  /**
   * Unique across `items`. The deck remembers what it has settled by id, so two cards sharing one
   * leave together: settling either takes both, and the reader never sees the second.
   */
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
  /** Names the queue for a reader who cannot see it. Two decks on a page need two names. */
  readonly label?: string;
  readonly emptyLabel?: string;
};

/**
 * A queue you sort by dragging, by swiping, or with the arrow keys. It remembers which items it
 * settled by id rather than counting them, so a changed `items` list adds and removes correctly
 * and a card that has been dealt with stays gone.
 *
 * The well holds the focus, not the card, because the card unmounts the moment it settles.
 */
function SwipeDeck({
  items,
  onSettle,
  label = DEFAULT_LABEL,
  emptyLabel = DEFAULT_EMPTY,
  className,
  ...props
}: SwipeDeckProps) {
  const [settled, setSettled] = useState<ReadonlySet<string>>(() => new Set());
  const [offset, setOffset] = useState(0);
  const [held, setHeld] = useState(false);
  const [outcome, setOutcome] = useState("");
  const styles = swipeDeck({ held });

  const remaining = remainingOf(items, settled);
  const top = remaining[0];
  /** One source, so the words a reader sees and the words a reader hears cannot drift apart. */
  const nothingLeft = emptyLabel.trim() || DEFAULT_EMPTY;

  /** Puts the card down where it started, holding nothing. */
  const rest = () => {
    setOffset(0);
    setHeld(false);
  };

  const settle = (direction: "pin" | "skip") => {
    if (!top) return;
    onSettle?.(top, direction);
    /* What is left once this card has gone, not the card behind it: a twin sharing its id leaves
     * with it, and naming that one sent the reader to a card already gone. */
    const left = remainingOf(items, new Set(settled).add(top.id));

    setSettled((ids) => new Set(ids).add(top.id));
    setOutcome(settledAs(direction, top.title, left[0]?.title ?? nothingLeft));
    rest();
  };

  const release = () => {
    const outcome = swipeOutcome(offset);

    if (outcome === "return") {
      rest();
      return;
    }
    settle(outcome);
  };

  return (
    <div
      data-slot="swipe-deck"
      role="group"
      aria-label={label.trim() || DEFAULT_LABEL}
      tabIndex={top ? 0 : -1}
      aria-keyshortcuts={top ? "ArrowLeft ArrowRight" : undefined}
      className={styles.well({ className })}
      onKeyDown={(event) => {
        const direction = { ArrowLeft: "skip", ArrowRight: "pin" }[event.key];
        if (!direction) return;
        event.preventDefault();
        settle(direction as "pin" | "skip");
      }}
      {...props}
    >
      {/* Empty at first, so nothing is said until a card actually settles. */}
      <Readout className={styles.outcome()}>{outcome}</Readout>
      {top ? null : <span className={styles.empty()}>{nothingLeft}</span>}
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
              /* The one on top covers the others completely, so they are picture, not text. */
              aria-hidden={isTop ? undefined : true}
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
              /* Taken away rather than let go: the reader never chose, so nothing is decided. */
              onPointerCancel={isTop ? rest : undefined}
            >
              <div className={styles.head()}>
                <span className={styles.kind()}>{item.kind}</span>
                <span
                  aria-hidden
                  style={{ opacity: stamps.pin }}
                  className={styles.stamp({ className: styles.pin() })}
                >
                  pin
                </span>
                <span
                  aria-hidden
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
                  <span className={styles.end()}>{item.left}</span>
                  <span className={styles.end()}>{item.right}</span>
                </div>
              </div>
            </div>
          );
        })}
    </div>
  );
}

export { SwipeDeck, swipeDeck as swipeDeckVariants };
