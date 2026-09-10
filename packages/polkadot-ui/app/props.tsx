import { Kind, Label, Meta, tv } from "polkadot-ui";

const props = tv({
  slots: {
    /* The name column sizes itself to the widest name in this table, so a long one cannot spill. */
    table: "grid grid-cols-[auto_1fr] items-baseline gap-x-3 gap-y-2",
    head: "col-span-2 mb-px",
    row: "contents",
    /*
     * A floor wide enough for the longest name in the kit, so every table lands on the same
     * column and reads as one. The column still grows past it rather than spilling.
     */
    name: "min-w-[136px]",
    values: "flex flex-wrap items-baseline gap-x-2 gap-y-1",
    value: "font-pk-mono text-pk-mono text-pk-ink-faint",
    current: "font-pk-mono text-pk-mono text-pk-accent-dim",
    note: "font-pk-sans text-pk-meta text-pk-ink-faint",
  },
});

/**
 * A prop's own type, written the way a table prints it. String members come through as themselves;
 * a boolean prints as the two words a reader would type, and a number as any number.
 */
type Printed<V> =
  | Extract<V, string>
  | (boolean extends V ? "true" | "false" : never)
  | (number extends V ? `${number}` : never);

/**
 * One row per key, so `values` and `fallback` are that key's own type rather than any string. A
 * prop whose type carries no printable member — a node, a render function — takes a note and
 * nothing else, which is what those rows already say.
 */
export type PropRow<T> = {
  [K in keyof T & string]: {
    /** Checked against the component's own props type, so a renamed prop fails the build. */
    readonly name: K;
    /** The values worth naming, checked against the prop's type. */
    readonly values?: readonly Printed<NonNullable<T[K]>>[];
    /**
     * The value you get by writing nothing, drawn in the accent like a tv default.
     *
     * A string rather than the prop's type, because a default is not always a literal: the bars
     * fall back to "the largest value" and the grid's thresholds to "1 · 3 · 6 · 10", which are a
     * computed default and a rendered array. Both belong in the accent beside the values.
     */
    readonly fallback?: string;
    readonly note?: string;
  };
}[keyof T & string];

/**
 * A table for props that are not `tv` variants, so `Api` cannot read them.
 *
 * The rows are written by hand and keyed to the component's props type, so renaming or removing a
 * prop fails typechecking here — and so does naming a value the prop does not accept.
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
