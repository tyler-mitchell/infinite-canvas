import type { VariantProps } from "tailwind-variants";

import { tv } from "../tv.ts";

const receipt = tv({
  slots: {
    root: "pk-paper pk-tear flex w-full flex-col px-[13px] pt-3 pb-[18px] font-pk-mono text-pk-paper-ink shadow-pk-paper",
    head: "flex flex-col items-center gap-[3px]",
    mark: "flex size-5 items-center justify-center rounded-pk-control-inner bg-pk-paper-ink font-pk-sans text-pk-micro text-pk-paper-page",
    wordmark: "text-pk-print-xs tracking-[0.2em] text-pk-paper-label uppercase",
    rule: "pk-paper-rule my-1.5 h-px flex-none",
    line: "flex items-baseline justify-between gap-2",
    name: "min-w-0 truncate text-pk-print uppercase",
    amount: "flex-none text-pk-print tabular-nums",
    note: "text-pk-print-xs text-pk-paper-label",
    barcode: "mt-[5px] flex h-3 items-end gap-[1.5px]",
    bar: "h-full bg-pk-paper-ink",
    action:
      "mt-1 flex w-full cursor-pointer items-center justify-center gap-[7px] rounded-[3px] border border-dashed border-pk-paper-label bg-transparent px-2 py-1.5 font-pk-mono text-pk-print tracking-[0.13em] text-pk-paper-ink uppercase outline-none transition-colors duration-(--pk-duration-hover) ease-pk-swift hover:border-pk-paper-ink hover:bg-pk-paper-ink hover:text-pk-paper-page focus-visible:ring-2 focus-visible:ring-pk-paper-ink focus-visible:ring-offset-2 focus-visible:ring-offset-(color:--pk-ring-seat)",
    sign: "mt-[3px] self-center text-pk-print-xs tracking-[0.16em] text-pk-paper-ink uppercase",
  },
  variants: {
    total: {
      true: {
        name: "text-pk-mono-sm font-semibold tracking-[0.05em]",
        amount: "text-pk-mono-lg leading-[1.3] font-semibold tracking-[-0.01em]",
      },
      false: {},
    },
  },
  defaultVariants: { total: false },
});

export type ReceiptProps = React.ComponentProps<"div">;

/**
 * Paper: its own ground, its own ink, and the one inverted surface in the kit. It fills the width
 * it is given, so put it in a card the size a receipt should be rather than in an open column.
 */
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
  /* Enough bars that each is a hairline rather than a plank once they fill the paper. */
  const bars = Array.from(value.repeat(8).slice(0, 48), (character) =>
    character.codePointAt(0)! % 2 === 0 ? 3 : 1.5,
  );

  return (
    <div
      data-slot="receipt-barcode"
      role="img"
      aria-label={`order ${value}`}
      className={styles.barcode({ className })}
      {...props}
    >
      {bars.map((width, index) => (
        /* The widths are a ratio rather than a size, so the code spans whatever paper it is on. */
        <span key={index} style={{ flex: `${width} 1 0` }} className={styles.bar()} />
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
