import { tv } from "../tv.ts";

const numberTicker = tv({
  slots: {
    root: "inline-flex items-baseline tabular-nums",
    slot: "relative inline-block h-[1em] overflow-hidden",
    strip:
      "flex flex-col transition-transform duration-(--ticker-duration) ease-pk-settle will-change-transform",
    cell: "flex h-[1em] items-center justify-center",
    fixed: "inline-block",
    /* The value unsplit, for anything that reads it rather than looks at it. */
    whole: "sr-only",
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
 *
 * A reading that is not a number counts as none. Printed as it arrives it is letters, and a letter
 * takes the separator's key, which is its place value and the character: `NaN` and `Infinity` each
 * repeat a letter at the same place, so two cells would claim one key.
 */
export function tickerText(value: number, pad = 0, locale = false) {
  const real = Number.isFinite(value) ? value : 0;
  const digits = String(Math.trunc(Math.abs(real))).padStart(pad, "0");
  const grouped = locale ? digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",") : digits;

  return real < 0 ? `-${grouped}` : grouped;
}

/**
 * One cell per character, keyed and delayed by place value rather than string position, so the
 * units digit always leads and a separator never consumes a step of the cascade.
 */
export function tickerCells(text: string, stagger = 40): readonly TickerCell[] {
  const characters = text.split("");
  /* A step that is not a number is no step: the places roll together rather than at no time. */
  const step = Number.isFinite(stagger) ? stagger : 0;

  return characters.map((character, index) => {
    const place = characters.slice(index + 1).filter(isDigit).length;

    return isDigit(character)
      ? { key: `d${place}`, character, digit: Number(character), delay: place * step }
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

/**
 * Each digit rolls in its own slot, keyed by place value rather than by position in the string, so
 * a number that gains a digit rolls the units column as the units column. The units digit leads
 * and each place to its left follows by `stagger`; a separator costs no step.
 */
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
  /* A roll time that is not a number is no roll, rather than a length the sheet cannot read. */
  const roll = Number.isFinite(duration) ? duration : 0;
  /* Padding holds the width of a falling number. It is a width, not a value, so it is not spoken. */
  const spoken = tickerText(value, 0, locale);

  return (
    <span data-slot="number-ticker" className={styles.root({ className })} {...props}>
      <span className={styles.whole()}>{prefix + spoken + suffix}</span>
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
                  "--ticker-duration": `${roll}ms`,
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
