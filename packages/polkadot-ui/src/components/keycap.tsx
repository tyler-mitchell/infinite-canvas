import { tv } from "../tv.ts";

const keycap = tv({
  slots: {
    cap: "inline-block min-w-[22px] rounded-[5px] border border-b-2 border-pk-keycap-line bg-pk-keycap-face px-1.5 py-1 text-center font-pk-mono text-pk-mono text-pk-ink-muted",
    combination: "flex gap-[3px]",
    row: "flex items-center justify-between gap-2.5",
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
        {keys.map((key) => (
          <Keycap key={key}>{key}</Keycap>
        ))}
      </span>
      <span className={styles.action()}>{action}</span>
    </div>
  );
}

export { Binding, Keycap, keycap as keycapVariants };
