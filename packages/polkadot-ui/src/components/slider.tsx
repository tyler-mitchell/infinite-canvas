import { Slider as SliderPrimitive } from "@base-ui/react/slider";
import { tv } from "tailwind-variants";

const slider = tv({
  slots: {
    root: "flex w-full flex-col gap-2",
    header: "flex items-baseline justify-between gap-2",
    label: "font-pk-sans text-[11px] leading-none font-medium tracking-[0.02em] text-pk-ink-dim",
    value: "font-pk-mono text-[11px] leading-[1.4] text-pk-ink-muted",
    control: "flex h-4 w-full cursor-pointer touch-none items-center select-none",
    track: "h-1 w-full rounded-pk-pill bg-pk-surface-sunken",
    indicator: "rounded-pk-pill bg-pk-accent",
    thumb:
      "size-3 rounded-pk-pill border border-pk-accent bg-pk-ink-bright outline-none transition-[box-shadow] duration-(--pk-duration-hover) ease-pk-swift focus-visible:ring-2 focus-visible:ring-pk-accent/50",
  },
});

type WithClassName<T> = Omit<T, "className"> & { className?: string };

export type SliderProps = WithClassName<SliderPrimitive.Root.Props> & {
  /** Rendered above the control. Omit for a bare track. */
  readonly label?: string;
  /** Shows the current value beside the label, in mono. */
  readonly showValue?: boolean;
};

/**
 * Composed rather than exposed part by part: every slider in this kit is a labelled track with an
 * optional readout, and Base UI's parts have no other useful arrangement here.
 */
function Slider({ label, showValue = true, className, ...props }: SliderProps) {
  const styles = slider();

  return (
    <SliderPrimitive.Root data-slot="slider" className={styles.root({ className })} {...props}>
      {label || showValue ? (
        <div className={styles.header()}>
          {label ? (
            <SliderPrimitive.Label className={styles.label()}>{label}</SliderPrimitive.Label>
          ) : null}
          {showValue ? <SliderPrimitive.Value className={styles.value()} /> : null}
        </div>
      ) : null}
      <SliderPrimitive.Control className={styles.control()}>
        <SliderPrimitive.Track className={styles.track()}>
          <SliderPrimitive.Indicator className={styles.indicator()} />
          <SliderPrimitive.Thumb className={styles.thumb()} />
        </SliderPrimitive.Track>
      </SliderPrimitive.Control>
    </SliderPrimitive.Root>
  );
}

export { Slider, slider as sliderVariants };
