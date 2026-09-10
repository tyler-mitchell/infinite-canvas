import { useRender } from "@base-ui/react/use-render";

import { tv } from "../tv.ts";

const contactCard = tv({
  slots: {
    root: "pk-rim box-border flex items-center justify-between gap-[14px] overflow-hidden rounded-[18px] p-5",
    body: "flex min-w-0 flex-col gap-[5px]",
    label: "font-pk-sans text-pk-label text-pk-ink-dim",
    address:
      "font-pk-sans text-[15px] leading-[1.2] font-medium tracking-[-0.02em] break-words text-pk-ink",
    note: "font-pk-sans text-[11.5px] leading-[1.4] text-pk-ink-faint",
    arrow:
      "flex size-8 flex-none items-center justify-center rounded-pk-pill border border-pk-line font-pk-sans text-[15px] leading-none text-pk-accent",
  },
});

export interface ContactCardProps extends Omit<useRender.ComponentProps<"div">, "children"> {
  readonly label: string;
  readonly address: string;
  readonly note: string;
}

function ContactCard({ label, address, note, className, render, ...props }: ContactCardProps) {
  const styles = contactCard();

  return useRender({
    render,
    defaultTagName: "div",
    props: {
      ...props,
      "data-slot": "contact-card",
      className: styles.root({ className: className as string }),
      children: (
        <>
          <div className={styles.body()}>
            <span className={styles.label()}>{label}</span>
            <span className={styles.address()}>{address}</span>
            <span className={styles.note()}>{note}</span>
          </div>
          <span aria-hidden className={styles.arrow()}>
            →
          </span>
        </>
      ),
    },
  });
}

export { ContactCard, contactCard as contactCardVariants };
