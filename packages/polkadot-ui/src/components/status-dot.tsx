import { tv, type VariantProps } from "tailwind-variants";

/*
 * A small mark that says what state a thing is in, with the word beside it.
 *
 * Only `live` pulses. A ring that expands forever draws the eye, so it is spent on the one state
 * worth interrupting for; the others are a colour and nothing else. The theme stops the ring under
 * reduced motion, where the dot alone still carries the state.
 *
 * The colour is never the only signal — the label is a real word, so the state survives a reader who
 * cannot tell the greens apart.
 */
const statusDot = tv({
  slots: {
    root: "inline-flex items-center gap-2 font-pk-sans text-pk-meta",
    mark: "relative flex size-[6px] flex-none",
    ring: "absolute inset-0 rounded-pk-pill",
    core: "size-full rounded-pk-pill",
  },
  variants: {
    tone: {
      live: {
        core: "bg-pk-accent",
        ring: "bg-pk-accent/60 animate-pk-ping",
        root: "text-pk-ink-muted",
      },
      idle: { core: "bg-pk-ink-dim", ring: "hidden", root: "text-pk-ink-faint" },
      off: { core: "bg-pk-ink-faint/50", ring: "hidden", root: "text-pk-ink-faint" },
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
      {children}
    </span>
  );
}

export { StatusDot, statusDot as statusDotVariants };
