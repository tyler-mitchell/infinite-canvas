import { Slider as SliderPrimitive } from "@base-ui/react/slider";
import { tv } from "../tv.ts";

const slider = tv({
  slots: {
    root: "flex w-full flex-col gap-2.5 data-[orientation=vertical]:w-auto data-[orientation=vertical]:items-start",
    header: "flex items-baseline justify-between gap-2",
    label: "font-pk-sans text-pk-label text-pk-ink-dim",
    value: "font-pk-sans text-pk-label text-pk-ink-muted tabular-nums",
    control:
      "flex h-4 w-full cursor-pointer touch-none items-center select-none data-[orientation=vertical]:h-[120px] data-[orientation=vertical]:w-4 data-[orientation=vertical]:justify-center",
    track:
      "h-[3px] w-full rounded-pk-pill bg-pk-ink/[0.1] data-[orientation=vertical]:h-full data-[orientation=vertical]:w-[3px]",
    indicator: "rounded-pk-pill bg-pk-accent",
    thumb:
      "size-[13px] rounded-pk-pill bg-white shadow-[0_1px_3px_rgb(0_0_0/0.5)] outline-none transition-transform duration-(--pk-duration-hover) ease-pk-swift hover:scale-110 focus-visible:ring-2 focus-visible:ring-pk-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-(color:--pk-ring-seat)",
  },
});

type WithClassName<T> = Omit<T, "className"> & { className?: string };

export type SliderProps = WithClassName<SliderPrimitive.Root.Props> & {
  /** Rendered above the control. Omit for a bare track. */
  readonly label?: string;
  /** Shows the current value beside the label. */
  readonly showValue?: boolean;
};

function Slider({ label, showValue = true, className, ...props }: SliderProps) {
  const styles = slider();
  const values = props.value ?? props.defaultValue;
  const thumbs = Array.isArray(values) ? values.length : 1;

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
          {Array.from({ length: thumbs }, (_, index) => (
            <SliderPrimitive.Thumb key={index} index={index} className={styles.thumb()} />
          ))}
        </SliderPrimitive.Track>
      </SliderPrimitive.Control>
    </SliderPrimitive.Root>
  );
}

export { Slider, slider as sliderVariants };
