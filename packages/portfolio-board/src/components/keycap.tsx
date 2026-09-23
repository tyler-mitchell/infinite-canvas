import { tv } from "../tv.ts";

const keycap = tv({
  slots: {
    cap: "inline-flex min-h-6 min-w-6 items-center justify-center rounded-pk-control-inner border border-b-2 border-pk-keycap-line bg-pk-keycap-face px-1.5 text-center font-pk-mono text-pk-mono text-pk-ink-muted",
    combination: "inline-flex flex-none items-center gap-1",
    row: "flex min-w-0 items-center justify-between gap-3",
    action: "min-w-0 font-pk-sans text-pk-note break-words text-pk-ink-dim",
  },
});

export type KeycapProps = React.ComponentProps<"kbd">;

function Keycap({ className, ...props }: KeycapProps) {
  return <kbd data-slot="keycap" className={keycap().cap({ className })} {...props} />;
}

export type BindingProps = Omit<React.ComponentProps<"div">, "children"> & {
  /** One cap each: ["⌘", "K"]. */
  readonly keys: readonly string[];
  readonly action: React.ReactNode;
};

function Binding({ keys, action, className, ...props }: BindingProps) {
  const styles = keycap();

  return (
    <div data-slot="binding" className={styles.row({ className })} {...props}>
      <span className={styles.combination()}>
        {keys.map((cap, index) => (
          <Keycap key={index}>{cap}</Keycap>
        ))}
      </span>
      <span className={styles.action()}>{action}</span>
    </div>
  );
}

export { Binding, Keycap, keycap as keycapVariants };
