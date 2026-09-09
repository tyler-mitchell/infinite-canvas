import { tv } from "../tv.ts";

const aurora = tv({
  slots: {
    root: "relative isolate overflow-hidden rounded-pk-card border border-pk-line bg-pk-void shadow-pk-card transition-colors duration-(--pk-duration-hover) ease-pk-swift hover:border-pk-line-hover",
    blob: "pointer-events-none absolute top-1/2 left-1/2 mix-blend-screen",
    teal: "-mt-[35%] -ml-[85%] h-[70%] w-[170%] blur-[26px] [background:radial-gradient(closest-side,rgb(0_230_168/0.5),rgb(0_230_168/0)_72%)]",
    violet:
      "-mt-[28%] -ml-[65%] h-[56%] w-[130%] blur-[30px] [background:radial-gradient(closest-side,rgb(126_140_255/0.38),rgb(126_140_255/0)_74%)]",
    white:
      "-mt-[18%] -ml-[47%] h-[36%] w-[95%] blur-[20px] [background:radial-gradient(closest-side,rgb(255_255_255/0.2),rgb(255_255_255/0)_70%)]",
    grain: "pk-noise pointer-events-none absolute inset-0",
    vignette:
      "pointer-events-none absolute inset-0 [background:radial-gradient(120%_90%_at_50%_45%,rgb(7_8_10/0)_38%,rgb(7_8_10/0.86)_100%)]",
    content: "pointer-events-none absolute inset-0 flex flex-col justify-between p-4",
    label: "font-pk-sans text-[11px] leading-none font-medium tracking-[0.02em] text-pk-ink/72",
    headline:
      "font-pk-sans text-[15px] leading-[1.2] font-semibold tracking-[-0.025em] text-balance text-pk-ink-bright",
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
