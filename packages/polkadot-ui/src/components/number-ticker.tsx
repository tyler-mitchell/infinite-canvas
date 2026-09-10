import { tv } from "../tv.ts";

const numberTicker = tv({
  slots: {
    root: "inline-flex items-baseline tabular-nums",
    slot: "relative inline-block h-[1em] overflow-hidden",
    strip:
      "flex flex-col transition-transform duration-(--ticker-duration) ease-pk-settle will-change-transform",
    cell: "flex h-[1em] items-center justify-center",
    fixed: "inline-block",
  },
});

const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

const isDigit = (character: string) => character >= "0" && character <= "9";

export interface TickerCell {
  /** Place value, so a slot keeps its identity when the number gains or loses a digit. */
  readonly key: string;
  readonly character: string;
  /** The digit to roll to, or null for a sign or a separator, which is printed as it is. */
  readonly digit: number | null;
  readonly delay: number;
}

/**
 * The printed form of a value: padded to `pad` digits, then grouped in threes if `locale`.
 * Padding runs first so a padded number still groups from its real units place.
 */
export function tickerText(value: number, pad = 0, locale = false) {
  const digits = String(Math.trunc(Math.abs(value))).padStart(pad, "0");
  const grouped = locale ? digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",") : digits;

  return value < 0 ? `-${grouped}` : grouped;
}

/**
 * One cell per character, keyed and delayed by place value rather than string position, so the
 * units digit always leads and a separator never consumes a step of the cascade.
 */
export function tickerCells(text: string, stagger = 40): readonly TickerCell[] {
  const characters = text.split("");

  return characters.map((character, index) => {
    const place = characters.slice(index + 1).filter(isDigit).length;

    return isDigit(character)
      ? { key: `d${place}`, character, digit: Number(character), delay: place * stagger }
      : { key: `s${place}${character}`, character, digit: null, delay: 0 };
  });
}

export type NumberTickerProps = Omit<React.ComponentProps<"span">, "children"> & {
  readonly value: number;
  /** Left-pad to this many digits, so a falling value keeps its width. */
  readonly pad?: number;
  /** Roll time for one digit, in milliseconds. */
  readonly duration?: number;
  /** Delay between digits, in milliseconds. The last digit leads. */
  readonly stagger?: number;
  readonly prefix?: string;
  readonly suffix?: string;
  /** Thousands separators. */
  readonly locale?: boolean;
  readonly digitClassName?: string;
};

function NumberTicker({
  value,
  pad = 0,
  duration = 600,
  stagger = 40,
  prefix = "",
  suffix = "",
  locale = false,
  className,
  digitClassName,
  ...props
}: NumberTickerProps) {
  const styles = numberTicker();
  const text = tickerText(value, pad, locale);
  const cells = tickerCells(text, stagger);

  return (
    <span data-slot="number-ticker" className={styles.root({ className })} {...props}>
      <span className="sr-only">{prefix + text + suffix}</span>
      <span aria-hidden className={styles.fixed()}>
        {prefix}
      </span>
      {cells.map((cell) =>
        cell.digit === null ? (
          <span key={cell.key} aria-hidden className={styles.fixed()}>
            {cell.character}
          </span>
        ) : (
          <span key={cell.key} aria-hidden className={styles.slot({ className: digitClassName })}>
            <span
              style={
                {
                  "--ticker-duration": `${duration}ms`,
                  transitionDelay: `${cell.delay}ms`,
                  transform: `translateY(${-cell.digit * 10}%)`,
                } as React.CSSProperties
              }
              className={styles.strip()}
            >
              {DIGITS.map((step) => (
                <span key={step} className={styles.cell()}>
                  {step}
                </span>
              ))}
            </span>
          </span>
        ),
      )}
      <span aria-hidden className={styles.fixed()}>
        {suffix}
      </span>
    </span>
  );
}

export { NumberTicker, numberTicker as numberTickerVariants };
