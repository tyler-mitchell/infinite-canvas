import { tv } from "../tv.ts";

const aurora = tv({
  slots: {
    root: "relative isolate overflow-hidden rounded-pk-card border border-pk-line bg-pk-void shadow-pk-card transition-colors duration-(--pk-duration-hover) ease-pk-swift hover:border-pk-line-hover",
    blob: "pointer-events-none absolute top-1/2 left-1/2 mix-blend-screen",
    teal: "-mt-[35%] -ml-[85%] h-[70%] w-[170%] blur-[26px] [background:var(--pk-aurora-teal)]",
    violet: "-mt-[28%] -ml-[65%] h-[56%] w-[130%] blur-[30px] [background:var(--pk-aurora-violet)]",
    white: "-mt-[18%] -ml-[47%] h-[36%] w-[95%] blur-[20px] [background:var(--pk-aurora-white)]",
    grain: "pk-noise pointer-events-none absolute inset-0",
    vignette: "pointer-events-none absolute inset-0 [background:var(--pk-aurora-vignette)]",
    /*
     * The four layers above this one are decoration and take no pointer. The words are not, and
     * taking none left them unselectable — hit-testing the headline landed on nothing at all. The
     * card's hover still reads, because hovering a child is hovering its parent.
     */
    content: "absolute inset-0 flex flex-col justify-between p-4",
    label: "font-pk-sans text-pk-label text-pk-ink/72",
    headline:
      "font-pk-sans text-pk-title font-semibold break-words text-balance text-pk-ink-bright",
  },
});

export type AuroraProps = Omit<React.ComponentProps<"div">, "children"> & {
  readonly label: string;
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
