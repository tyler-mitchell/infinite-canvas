import { tv } from "../tv.ts";

const aurora = tv({
  slots: {
    root: "relative isolate grid min-h-[214px] min-w-0 overflow-hidden rounded-pk-card border border-pk-line bg-pk-void shadow-pk-card transition-colors duration-(--pk-duration-hover) ease-pk-swift hover:border-pk-line-hover",
    blob: "pointer-events-none absolute top-1/2 left-1/2 mix-blend-screen",
    teal: "-mt-[35%] -ml-[85%] h-[70%] w-[170%] blur-[26px] bg-[image:var(--pk-aurora-teal)]",
    violet: "-mt-[28%] -ml-[65%] h-[56%] w-[130%] blur-[30px] bg-[image:var(--pk-aurora-violet)]",
    white: "-mt-[18%] -ml-[47%] h-[36%] w-[95%] blur-[20px] bg-[image:var(--pk-aurora-white)]",
    grain: "pk-noise pointer-events-none absolute inset-0",
    vignette: "pointer-events-none absolute inset-0 bg-[image:var(--pk-aurora-vignette)]",
    content: "relative flex min-w-0 flex-col justify-between gap-8 p-4",
    label: "font-pk-sans text-pk-label break-words text-pk-ink/72",
    headline:
      "font-pk-sans text-pk-title font-semibold break-words text-balance text-pk-ink-bright",
  },
});

export type AuroraProps = Omit<React.ComponentProps<"div">, "children"> & {
  /** The label above the decorative background. */
  readonly label: string;
  /** The headline contributes to the card's minimum height. */
  readonly headline: string;
};

function Aurora({ label, headline, className, ...props }: AuroraProps) {
  const styles = aurora();

  return (
    <div data-slot="aurora" className={styles.root({ className })} {...props}>
      <span className={styles.blob({ className: styles.teal() })} />
      <span className={styles.blob({ className: styles.violet() })} />
      <span className={styles.blob({ className: styles.white() })} />
      <span className={styles.grain()} />
      <span className={styles.vignette()} />
      <div className={styles.content()}>
        <span className={styles.label()}>{label}</span>
        <span className={styles.headline()}>{headline}</span>
      </div>
    </div>
  );
}

export { Aurora, aurora as auroraVariants };
