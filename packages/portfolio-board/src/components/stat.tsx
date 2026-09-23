import type { VariantProps } from "tailwind-variants";

import { tv } from "../tv.ts";

const stat = tv({
  slots: {
    root: "inline-flex items-baseline gap-[5px] whitespace-nowrap",
    value: "font-pk-mono text-pk-mono-lg text-pk-ink tabular-nums",
    label: "font-pk-sans text-[10.5px] leading-none text-pk-ink-dim",
  },
  variants: {
    layout: {
      inline: {},
      stacked: { root: "flex-col items-start gap-1" },
    },
  },
  defaultVariants: { layout: "inline" },
});

export type StatProps = Omit<React.ComponentProps<"div">, "children"> &
  VariantProps<typeof stat> & {
    readonly value: React.ReactNode;
    readonly label: React.ReactNode;
  };

function Stat({ value, label, layout, className, ...props }: StatProps) {
  const styles = stat({ layout });

  return (
    <div data-slot="stat" className={styles.root({ className })} {...props}>
      <span className={styles.value()}>{value}</span>
      <span className={styles.label()}>{label}</span>
    </div>
  );
}

export { Stat, stat as statVariants };
