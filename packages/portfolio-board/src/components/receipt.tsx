import { Button as ButtonPrimitive } from "@base-ui/react/button";
import type { VariantProps } from "tailwind-variants";

import { tv } from "../tv.ts";

const receipt = tv({
  slots: {
    root: "pk-paper pk-tear flex w-full min-w-0 flex-col gap-1 px-4 pt-4 pb-5 font-pk-mono text-pk-paper-ink shadow-pk-paper",
    head: "flex flex-col items-center gap-[3px]",
    mark: "flex size-5 items-center justify-center rounded-pk-control-inner bg-pk-paper-ink font-pk-sans text-pk-micro text-pk-paper-page",
    wordmark:
      "max-w-full text-center text-pk-print-xs break-words tracking-[0.12em] text-pk-paper-label uppercase",
    rule: "pk-paper-rule my-1.5 h-px flex-none",
    line: "flex items-baseline justify-between gap-2",
    name: "min-w-0 flex-1 text-pk-print break-words uppercase",
    amount: "flex-none text-pk-print tabular-nums",
    note: "text-pk-print-xs break-words text-pk-paper-label",
    barcode: "mt-[5px] flex h-3 items-end gap-[1.5px]",
    bar: "h-full bg-pk-paper-ink",
    action:
      "mt-2 flex min-h-8 w-full cursor-pointer items-center justify-center gap-2 rounded-pk-control-inner border border-pk-paper-label bg-transparent px-3 py-2 font-pk-mono text-pk-print tracking-[0.06em] text-pk-paper-ink uppercase outline-none transition-colors duration-(--pk-duration-hover) ease-pk-swift hover:border-pk-paper-ink hover:bg-pk-paper-ink hover:text-pk-paper-page focus-visible:ring-2 focus-visible:ring-pk-paper-ink focus-visible:ring-offset-2 focus-visible:ring-offset-(color:--pk-ring-seat) data-disabled:pointer-events-none data-disabled:opacity-50",
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

/** A paper surface that fills its container width. */
function Receipt({ className, ...props }: ReceiptProps) {
  return <div data-slot="receipt" className={receipt().root({ className })} {...props} />;
}

export type ReceiptHeadProps = Omit<React.ComponentProps<"div">, "children"> & {
  readonly mark: React.ReactNode;
  readonly wordmark: React.ReactNode;
};

function ReceiptHead({ mark, wordmark, className, ...props }: ReceiptHeadProps) {
  const styles = receipt();

  return (
    <div data-slot="receipt-head" className={styles.head({ className })} {...props}>
      {mark == null || typeof mark === "boolean" ? null : (
        <span className={styles.mark()}>{mark}</span>
      )}
      <span className={styles.wordmark()}>{wordmark}</span>
    </div>
  );
}

export type ReceiptRuleProps = React.ComponentProps<"div">;

/**
 * Printed decoration, so it carries no role and no separator: the hairline reaches only 1.54
 * against the foot of the sheet, and a reader who cannot see it loses nothing, because a total is
 * told apart by its weight and size rather than by the line above it.
 */
function ReceiptRule({ className, ...props }: ReceiptRuleProps) {
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

export type ReceiptNoteProps = React.ComponentProps<"span">;

function ReceiptNote({ className, ...props }: ReceiptNoteProps) {
  return <span data-slot="receipt-note" className={receipt().note({ className })} {...props} />;
}

/** Bars in a strip. Enough that each is a hairline rather than a plank once they fill the paper. */
const BARS = 48;

/**
 * The bar widths a barcode prints for an order. The parity of each character decides which of the
 * two widths it gets, so the same order always prints the same code.
 *
 * Trimmed first, which is what makes that last part true: untrimmed, `A1` and ` A1 ` printed
 * different codes. It also settles an order of nothing but spaces, which drew a full strip of
 * identical bars beside a label that said there was no order — the eye and the ear disagreeing.
 */
export function barcodeBars(value: string) {
  /*
   * Cut to the strip's width before repeating, not after. Repeating first builds eight copies of
   * whatever it was given and throws away all but the first forty eight, so a long order allocated
   * eight times its own length for nothing — and past about sixty seven million characters the
   * repeat itself is longer than a string can be and throws. Cutting first, the repeat never sees
   * more than forty eight characters, and the answer is the same either way: where the order is
   * longer than the strip, both take its first forty eight and the repeat never shows.
   */
  const order = value.trim().slice(0, BARS);

  return Array.from(order.repeat(8).slice(0, BARS), (character) =>
    character.codePointAt(0)! % 2 === 0 ? 3 : 1.5,
  );
}

export type ReceiptBarcodeProps = Omit<React.ComponentProps<"div">, "children"> & {
  /** The bars are derived from this, so the same order always prints the same code. */
  readonly value: string;
};

function ReceiptBarcode({ value, className, ...props }: ReceiptBarcodeProps) {
  const styles = receipt();
  const order = value.trim();
  const bars = barcodeBars(value);

  return (
    <div
      data-slot="receipt-barcode"
      role="img"
      /* An order of nothing draws no bars, so naming it `order ` names a strip of paper. */
      aria-label={order.length > 0 ? `order ${order}` : "no order"}
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

export type ReceiptActionProps = Omit<ButtonPrimitive.Props, "className"> & { className?: string };

function ReceiptAction({ className, ...props }: ReceiptActionProps) {
  return (
    <ButtonPrimitive
      type="button"
      data-slot="receipt-action"
      className={receipt().action({ className })}
      {...props}
    />
  );
}

export type ReceiptSignProps = React.ComponentProps<"span">;

function ReceiptSign({ className, ...props }: ReceiptSignProps) {
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
