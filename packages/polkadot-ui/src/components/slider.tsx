import { Slider as SliderPrimitive } from "@base-ui/react/slider";
import { tv } from "../tv.ts";
import { textVariants } from "./text.tsx";

const slider = tv({
  slots: {
    /* The whole control fades, the way every other one does: a track alone would still read live. */
    root: "flex w-full flex-col gap-2.5 data-disabled:pointer-events-none data-disabled:opacity-40 data-[orientation=vertical]:w-auto data-[orientation=vertical]:items-start",
    header: "flex items-baseline justify-between gap-2",
    label: "font-pk-sans text-pk-label text-pk-ink-dim",
    /* The readout role supplies the voice; only what is particular to a track sits here. */
    value: "",
    control:
      "flex h-4 w-full cursor-pointer touch-none items-center select-none data-[orientation=vertical]:h-[120px] data-[orientation=vertical]:w-4 data-[orientation=vertical]:justify-center",
    track:
      "h-[3px] w-full rounded-pk-pill bg-pk-ink/[0.1] data-[orientation=vertical]:h-full data-[orientation=vertical]:w-[3px]",
    indicator: "rounded-pk-pill bg-pk-accent",
    thumb:
      "size-[13px] rounded-pk-pill bg-pk-knob shadow-pk-knob outline-none transition-transform duration-(--pk-duration-hover) ease-pk-swift hover:scale-110 has-focus-visible:ring-2 has-focus-visible:ring-pk-accent/50 has-focus-visible:ring-offset-2 has-focus-visible:ring-offset-(color:--pk-ring-seat)",
  },
});

type WithClassName<T> = Omit<T, "className"> & { className?: string };

/**
 * A track says what it controls whether or not that is drawn. `label` draws above the track and
 * names both the group and the input under it; a bare track names itself with `aria-label`, which
 * goes to the same two places — Base UI wants it on each thumb for the input, and on the root for
 * the group. Both props at once would be one doing nothing: a label sets `aria-labelledby`, which
 * outranks an `aria-label` on the same element.
 */
type NamesItself =
  | { readonly label: string; readonly "aria-label"?: never }
  | { readonly label?: never; readonly "aria-label": string };

export type SliderProps = WithClassName<Omit<SliderPrimitive.Root.Props, "aria-label">> &
  NamesItself & {
    /** Shows the current value beside the label, and on its own when there is no label. */
    readonly showValue?: boolean;
  };

function Slider({
  label,
  showValue = true,
  className,
  "aria-label": ariaLabel,
  ...props
}: SliderProps) {
  const styles = slider();
  const values = props.value ?? props.defaultValue;
  const thumbs = Array.isArray(values) ? values.length : 1;

  return (
    <SliderPrimitive.Root
      data-slot="slider"
      aria-label={ariaLabel}
      className={styles.root({ className })}
      {...props}
    >
      {label || showValue ? (
        <div className={styles.header()}>
          {label ? (
            <SliderPrimitive.Label className={styles.label()}>{label}</SliderPrimitive.Label>
          ) : null}
          {showValue ? (
            <SliderPrimitive.Value
              className={textVariants({ as: "readout", className: styles.value() })}
            />
          ) : null}
        </div>
      ) : null}
      <SliderPrimitive.Control className={styles.control()}>
        <SliderPrimitive.Track className={styles.track()}>
          <SliderPrimitive.Indicator className={styles.indicator()} />
          {Array.from({ length: thumbs }, (_, index) => (
            <SliderPrimitive.Thumb
              key={index}
              index={index}
              aria-label={ariaLabel}
              className={styles.thumb()}
            />
          ))}
        </SliderPrimitive.Track>
      </SliderPrimitive.Control>
    </SliderPrimitive.Root>
  );
}

export { Slider, slider as sliderVariants };
