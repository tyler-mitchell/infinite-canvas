import { tv } from "tailwind-variants";

import { Kind, Label, Meta } from "polkadot-ui";

const api = tv({
  slots: {
    table: "flex flex-col gap-2",
    head: "mb-px",
    row: "flex items-baseline gap-3",
    name: "w-[92px] flex-none",
    values: "flex flex-wrap items-baseline gap-x-2 gap-y-1",
    value: "font-pk-mono text-[11px] leading-[1.4] text-pk-ink-faint",
    current: "font-pk-mono text-[11px] leading-[1.4] text-pk-accent-dim",
  },
});

interface VariantObject {
  readonly variants?: Record<string, Record<string, unknown>>;
  readonly defaultVariants?: Record<string, unknown>;
}

export interface ApiProps {
  readonly of: VariantObject;
  /** The component the table describes. Give it whenever a section documents more than one. */
  readonly name?: string;
  /** Variant keys that are state rather than props, so the table stays writable as an API. */
  readonly except?: readonly string[];
}

/**
 * A props table read off a component's own `tv` object, so it cannot fall behind the component.
 *
 * A variant is not always a prop: state that Base UI hands to `className`, such as a toggle's
 * `pressed` or a switch's `checked`, is indistinguishable from a prop here. Name those in `except`
 * so the table describes the API a consumer can actually write.
 */
export function Api({ of, name, except = [] }: ApiProps) {
  const styles = api();
  const variants = of.variants ?? {};
  const defaults = of.defaultVariants ?? {};
  const keys = Object.keys(variants).filter((key) => !except.includes(key));

  if (keys.length === 0) return <Meta>no variants</Meta>;

  return (
    <div className={styles.table()}>
      {name ? <Kind className={styles.head()}>{name}</Kind> : null}
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
