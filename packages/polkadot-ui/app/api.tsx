import { tv } from "tailwind-variants";

import { Label, Meta } from "polkadot-ui";

/*
 * The props table, read off the component's own `tv` object rather than written out beside it.
 * A hand-kept list is wrong the first time a variant is added; this cannot be.
 *
 * Only for components whose variants really are props. ToggleGroup's `pressed` and Switch's
 * `checked` are state Base UI hands to className, and a table built from the object alone cannot
 * tell the two apart — so those get no table rather than a table that invents two props.
 */
const api = tv({
  slots: {
    table: "flex flex-col gap-2",
    row: "flex items-baseline gap-3",
    name: "w-[92px] flex-none",
    values: "flex flex-wrap items-baseline gap-x-2 gap-y-1",
    value: "font-pk-mono text-[11px] leading-[1.4] text-pk-ink-faint",
    /* The default is the one you get by writing nothing, so it is the active one. */
    current: "font-pk-mono text-[11px] leading-[1.4] text-pk-accent-dim",
  },
});

interface VariantObject {
  readonly variants?: Record<string, Record<string, unknown>>;
  readonly defaultVariants?: Record<string, unknown>;
}

export function Api({ of }: { readonly of: VariantObject }) {
  const styles = api();
  const variants = of.variants ?? {};
  const defaults = of.defaultVariants ?? {};
  const keys = Object.keys(variants);

  if (keys.length === 0) return <Meta>no variants</Meta>;

  return (
    <div className={styles.table()}>
      {keys.map((key) => (
        <div key={key} className={styles.row()}>
          <Label className={styles.name()}>{key}</Label>
          <div className={styles.values()}>
            {Object.keys(variants[key] ?? {}).map((value) => (
              <span
                key={value}
                className={String(defaults[key]) === value ? styles.current() : styles.value()}
              >
                {value}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
