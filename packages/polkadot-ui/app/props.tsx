import { tv } from "tailwind-variants";

import { Kind, Label, Meta } from "polkadot-ui";

const props = tv({
  slots: {
    table: "flex flex-col gap-2",
    head: "mb-px",
    row: "flex items-baseline gap-3",
    name: "w-[92px] flex-none",
    values: "flex flex-wrap items-baseline gap-x-2 gap-y-1",
    value: "font-pk-mono text-[11px] leading-[1.4] text-pk-ink-faint",
    current: "font-pk-mono text-[11px] leading-[1.4] text-pk-accent-dim",
    note: "font-pk-sans text-[11px] leading-[1.4] text-pk-ink-faint",
  },
});

export interface PropRow<T> {
  /** Checked against the component's own props type, so a renamed prop fails the build. */
  readonly name: keyof T & string;
  /** The values worth naming. A type such as `number` is a value here too. */
  readonly values?: readonly string[];
  /** The value you get by writing nothing, drawn in the accent like a tv default. */
  readonly fallback?: string;
  readonly note?: string;
}

/**
 * A table for props that are not `tv` variants, so `Api` cannot read them.
 *
 * The rows are written by hand and their values can drift, but the names cannot: each is keyed to
 * the component's props type, so renaming or removing a prop fails typechecking here.
 */
export function Props<T>({
  name,
  rows,
}: {
  readonly name?: string;
  readonly rows: readonly PropRow<T>[];
}) {
  const styles = props();

  return (
    <div className={styles.table()}>
      {name ? <Kind className={styles.head()}>{name}</Kind> : null}
      {rows.map((row) => (
        <div key={row.name} className={styles.row()}>
          <Label className={styles.name()}>{row.name}</Label>
          <div className={styles.values()}>
            {row.fallback ? <span className={styles.current()}>{row.fallback}</span> : null}
            {row.values?.map((value) => (
              <span key={value} className={styles.value()}>
                {value}
              </span>
            ))}
            {row.note ? <Meta className={styles.note()}>{row.note}</Meta> : null}
          </div>
        </div>
      ))}
    </div>
  );
}
