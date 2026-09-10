import type { VariantProps } from "tailwind-variants";

import { tv } from "../tv.ts";

const readoutCard = tv({
  slots: {
    root: "box-border flex flex-col justify-start gap-[10px] overflow-hidden rounded-pk-card border border-pk-line bg-pk-surface p-[18px] shadow-pk-card transition-colors duration-(--pk-duration-hover) ease-pk-swift hover:border-pk-line-hover",
    head: "flex flex-none items-baseline justify-between gap-2",
    label:
      "flex-none font-pk-sans text-[11px] leading-none font-medium tracking-[0.02em] whitespace-nowrap text-pk-ink-dim",
    aside: "flex flex-none items-center gap-[7px]",
    hint: "flex-none font-pk-mono text-pk-mono-sm whitespace-nowrap text-pk-ink-faint",
    body: "flex flex-none flex-col gap-[3px]",
    value: "font-pk-mono tracking-[-0.03em] text-pk-ink tabular-nums",
    caption: "font-pk-sans text-[11px] leading-none font-medium text-pk-ink-faint",
    detail: "font-pk-mono text-pk-mono text-pk-ink-faint",
  },
  variants: {
    size: {
      md: { value: "text-[20px] leading-[1.4]" },
      lg: { value: "text-[22px] leading-[1.1]" },
    },
  },
  defaultVariants: { size: "md" },
});

export type ReadoutCardProps = Omit<React.ComponentProps<"div">, "children"> &
  VariantProps<typeof readoutCard> & {
    readonly label: string;
    readonly value: string;
    /** The line under the value, in sans. */
    readonly caption?: string;
    /** Mono lines under the caption. */
    readonly details?: readonly string[];
    /** Sits beside the label, for a control. */
    readonly aside?: React.ReactNode;
    readonly hint?: string;
  };

function ReadoutCard({
  label,
  value,
  caption,
  details,
  aside,
  hint,
  size,
  className,
  ...props
}: ReadoutCardProps) {
  const styles = readoutCard({ size });

  return (
    <div data-slot="readout-card" className={styles.root({ className })} {...props}>
      <div className={styles.head()}>
        <span className={styles.label()}>{label}</span>
        {aside || hint ? (
          <span className={styles.aside()}>
            {aside}
            {hint ? <span className={styles.hint()}>{hint}</span> : null}
          </span>
        ) : null}
      </div>
      <div className={styles.body()}>
        <span className={styles.value()}>{value}</span>
        {caption ? <span className={styles.caption()}>{caption}</span> : null}
        {details?.map((line) => (
          <span key={line} className={styles.detail()}>
            {line}
          </span>
        ))}
      </div>
    </div>
  );
}

export { ReadoutCard, readoutCard as readoutCardVariants };
