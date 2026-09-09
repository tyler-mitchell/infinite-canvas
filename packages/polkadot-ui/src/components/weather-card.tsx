import { tv } from "../tv.ts";

const weatherCard = tv({
  slots: {
    root: "box-border flex flex-col justify-start gap-2 overflow-hidden rounded-pk-card border border-pk-line bg-pk-surface p-4 transition-colors duration-(--pk-duration-hover) ease-pk-swift hover:border-pk-line-hover",
    head: "flex flex-none items-baseline justify-between gap-2",
    place:
      "flex-none font-pk-sans text-[11px] leading-none font-medium tracking-[0.02em] whitespace-nowrap text-pk-ink-dim",
    aside: "flex flex-none items-center gap-[7px]",
    hint: "flex-none font-pk-mono text-pk-mono-sm whitespace-nowrap text-pk-ink-faint",
    body: "flex flex-col gap-0.5",
    temperature: "font-pk-mono text-[22px] leading-[1.1] tracking-[-0.03em] text-pk-ink",
    conditions: "font-pk-sans text-[11px] leading-[1.3] font-medium text-pk-ink-faint",
    detail: "font-pk-mono text-pk-mono text-pk-ink-faint",
  },
});

export type WeatherCardProps = Omit<React.ComponentProps<"div">, "children"> & {
  readonly place: string;
  readonly temperature: string;
  readonly conditions: string;
  readonly detail: string;
  /** Sits beside the place name, for a control or a prompt. */
  readonly aside?: React.ReactNode;
  readonly hint?: string;
};

function WeatherCard({
  place,
  temperature,
  conditions,
  detail,
  aside,
  hint,
  className,
  ...props
}: WeatherCardProps) {
  const styles = weatherCard();

  return (
    <div data-slot="weather-card" className={styles.root({ className })} {...props}>
      <div className={styles.head()}>
        <span className={styles.place()}>{place}</span>
        {aside || hint ? (
          <span className={styles.aside()}>
            {aside}
            {hint ? <span className={styles.hint()}>{hint}</span> : null}
          </span>
        ) : null}
      </div>
      <div className={styles.body()}>
        <span className={styles.temperature()}>{temperature}</span>
        <span className={styles.conditions()}>{conditions}</span>
        <span className={styles.detail()}>{detail}</span>
      </div>
    </div>
  );
}

export { WeatherCard, weatherCard as weatherCardVariants };
