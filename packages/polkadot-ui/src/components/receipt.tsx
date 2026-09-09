import { tv, type VariantProps } from "tailwind-variants";

/*
 * A printed slip: cream paper, a torn bottom edge, and mono throughout because it is print.
 *
 * The theme already carried the paper ground, the dotted rule and the tear clip and nothing used
 * them. They are here now.
 *
 * Composed in parts rather than taken as one object, because no two receipts hold the same rows.
 * The paper has its own ink floor, so nothing on it may use the interface inks — those are made for
 * a dark ground and vanish on cream.
 */
const receipt = tv({
  slots: {
    root: "pk-paper pk-tear flex w-full flex-col px-[13px] pt-3 pb-[18px] font-pk-mono text-pk-paper-ink shadow-[0_12px_22px_-14px_rgb(0_0_0/0.9)]",
    head: "flex flex-col items-center gap-[3px]",
    mark: "flex size-5 items-center justify-center rounded-[6px] bg-pk-paper-ink font-pk-sans text-pk-micro text-pk-paper-page",
    wordmark: "text-pk-print-xs tracking-[0.2em] text-pk-paper-label uppercase",
    rule: "pk-paper-rule my-1.5 h-px flex-none",
    line: "flex items-baseline justify-between gap-2",
    name: "min-w-0 truncate text-pk-print uppercase",
    amount: "flex-none text-pk-print tabular-nums",
    note: "text-pk-print-xs text-pk-paper-label",
    /* The bars are one flex row; each bar is a width, so the pattern is data and not an image. */
    barcode: "mt-[5px] flex h-3 items-end gap-[1.5px]",
    bar: "h-full bg-pk-paper-ink",
    action:
      "mt-1 flex w-full cursor-pointer items-center justify-center gap-[7px] rounded-[3px] border border-dashed border-pk-paper-label bg-transparent px-2 py-1.5 font-pk-mono text-pk-print tracking-[0.13em] text-pk-paper-ink uppercase transition-colors duration-(--pk-duration-hover) ease-pk-swift hover:border-pk-paper-ink hover:bg-pk-paper-ink hover:text-pk-paper-page",
    sign: "mt-[3px] self-center text-pk-print-xs tracking-[0.16em] text-pk-paper-ink uppercase",
  },
  variants: {
    /* The total is the line the eye goes to, so it is the only one that is heavier and larger. */
    total: {
      true: {
        name: "text-pk-mono-sm font-semibold tracking-[0.05em]",
        amount: "text-pk-mono-lg font-semibold tracking-[-0.01em]",
      },
      false: {},
    },
  },
  defaultVariants: { total: false },
});

export type ReceiptProps = React.ComponentProps<"div">;

function Receipt({ className, ...props }: ReceiptProps) {
  return <div data-slot="receipt" className={receipt().root({ className })} {...props} />;
}

export type ReceiptHeadProps = Omit<React.ComponentProps<"div">, "children"> & {
  /** Two or three characters. The printed stand-in for a logo. */
  readonly mark: string;
  readonly wordmark: string;
};

function ReceiptHead({ mark, wordmark, className, ...props }: ReceiptHeadProps) {
  const styles = receipt();

  return (
    <div data-slot="receipt-head" className={styles.head({ className })} {...props}>
      <span className={styles.mark()}>{mark}</span>
      <span className={styles.wordmark()}>{wordmark}</span>
    </div>
  );
}

function ReceiptRule({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="receipt-rule" className={receipt().rule({ className })} {...props} />;
}

export type ReceiptLineProps = Omit<React.ComponentProps<"div">, "children"> &
  VariantProps<typeof receipt> & {
    readonly name: React.ReactNode;
    readonly amount: React.ReactNode;
  };

function ReceiptLine({ name, amount, total, className, ...props }: ReceiptLineProps) {
  const styles = receipt({ total });

  return (
    <div data-slot="receipt-line" className={styles.line({ className })} {...props}>
      <span className={styles.name()}>{name}</span>
      <span className={styles.amount()}>{amount}</span>
    </div>
  );
}

function ReceiptNote({ className, ...props }: React.ComponentProps<"span">) {
  return <span data-slot="receipt-note" className={receipt().note({ className })} {...props} />;
}

export type ReceiptBarcodeProps = Omit<React.ComponentProps<"div">, "children"> & {
  /** The bars are derived from this, so the same order always prints the same code. */
  readonly value: string;
};

function ReceiptBarcode({ value, className, ...props }: ReceiptBarcodeProps) {
  const styles = receipt();
  /* Two widths, chosen by whether the character's code point is odd. Not a real symbology. */
  const bars = Array.from(value.repeat(3).slice(0, 18), (character) =>
    character.codePointAt(0)! % 2 === 0 ? 3 : 1.5,
  );

  return (
    <div
      data-slot="receipt-barcode"
      role="img"
      aria-label={`Order ${value}`}
      className={styles.barcode({ className })}
      {...props}
    >
      {bars.map((width, index) => (
        <span key={index} style={{ width: `${width}px` }} className={styles.bar()} />
      ))}
    </div>
  );
}

function ReceiptAction({ className, ...props }: React.ComponentProps<"button">) {
  return (
    <button
      type="button"
      data-slot="receipt-action"
      className={receipt().action({ className })}
      {...props}
    />
  );
}

function ReceiptSign({ className, ...props }: React.ComponentProps<"span">) {
  return <span data-slot="receipt-sign" className={receipt().sign({ className })} {...props} />;
}

Receipt.Head = ReceiptHead;
Receipt.Rule = ReceiptRule;
Receipt.Line = ReceiptLine;
Receipt.Note = ReceiptNote;
Receipt.Barcode = ReceiptBarcode;
Receipt.Action = ReceiptAction;
Receipt.Sign = ReceiptSign;

export {
  Receipt,
  ReceiptAction,
  ReceiptBarcode,
  ReceiptHead,
  ReceiptLine,
  ReceiptNote,
  ReceiptRule,
  ReceiptSign,
  receipt as receiptVariants,
};
