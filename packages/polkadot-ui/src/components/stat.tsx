import { tv, type VariantProps } from "tailwind-variants";

/*
 * A figure and what it counts.
 *
 * The figure is mono and tabular because it is a value being read, and because a row of these sits
 * still when one of them changes. The word beside it is interface, so it is sans.
 */
const stat = tv({
  slots: {
    root: "inline-flex items-baseline gap-1.5",
    value: "font-pk-mono text-pk-mono-lg text-pk-ink-bright tabular-nums",
    label: "font-pk-sans text-pk-meta text-pk-ink-faint",
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
