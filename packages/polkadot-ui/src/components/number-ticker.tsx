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
  const body = locale ? Math.trunc(value).toLocaleString("en-US") : String(Math.trunc(value));
  const padded = body.padStart(pad, "0");
  const characters = padded.split("");
  const last = characters.length - 1;

  return (
    <span data-slot="number-ticker" className={styles.root({ className })} {...props}>
      <span className="sr-only">{prefix + padded + suffix}</span>
      <span aria-hidden className={styles.fixed()}>
        {prefix}
      </span>
      {characters.map((character, index) => {
        const digit = Number(character);
        if (Number.isNaN(digit)) {
          return (
            <span key={index} aria-hidden className={styles.fixed()}>
              {character}
            </span>
          );
        }
        return (
          <span key={index} aria-hidden className={styles.slot({ className: digitClassName })}>
            <span
              style={
                {
                  "--ticker-duration": `${duration}ms`,
                  transitionDelay: `${(last - index) * stagger}ms`,
                  transform: `translateY(${-digit * 10}%)`,
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
        );
      })}
      <span aria-hidden className={styles.fixed()}>
        {suffix}
      </span>
    </span>
  );
}

export { NumberTicker, numberTicker as numberTickerVariants };
