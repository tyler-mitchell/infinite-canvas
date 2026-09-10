import type { VariantProps } from "tailwind-variants";

import { tv } from "../tv.ts";

const statusDot = tv({
  slots: {
    root: "inline-flex items-center gap-[7px] whitespace-nowrap",
    mark: "relative flex size-[10px] flex-none items-center justify-center",
    ring: "absolute size-[10px] rounded-pk-pill border",
    core: "size-1 rounded-pk-pill",
    label: "font-pk-mono text-pk-mono-sm",
  },
  variants: {
    tone: {
      live: {
        ring: "border-pk-accent/50 animate-pk-ping",
        core: "bg-pk-accent",
        label: "text-pk-accent-dim",
      },
      idle: { ring: "hidden", core: "bg-pk-ink-dim", label: "text-pk-ink-faint" },
      /* Hollow rather than dimmer: a filled dot faint enough to read as off is too faint to see. */
      off: { ring: "border-pk-ink-faint", core: "hidden", label: "text-pk-ink-faint" },
    },
  },
  defaultVariants: { tone: "live" },
});

export type StatusDotProps = Omit<React.ComponentProps<"span">, "children"> &
  VariantProps<typeof statusDot> & {
    /** The state in words. Omit for the mark alone, and name the state some other way. */
    readonly children?: React.ReactNode;
  };

function StatusDot({ tone, children, className, ...props }: StatusDotProps) {
  const styles = statusDot({ tone });

  return (
    <span data-slot="status-dot" className={styles.root({ className })} {...props}>
      <span className={styles.mark()}>
        <span aria-hidden className={styles.ring()} />
        <span className={styles.core()} />
      </span>
      {children ? <span className={styles.label()}>{children}</span> : null}
    </span>
  );
}

export { StatusDot, statusDot as statusDotVariants };
