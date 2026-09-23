import { useRender } from "@base-ui/react/use-render";

import { tv } from "../tv.ts";

const contactCard = tv({
  slots: {
    root: "pk-rim box-border flex min-w-0 items-center justify-between gap-3.5 overflow-hidden rounded-pk-card p-5 no-underline outline-none focus-visible:ring-2 focus-visible:ring-pk-accent/60",
    body: "flex min-w-0 flex-col gap-[5px]",
    label: "font-pk-sans text-pk-label break-words text-pk-ink-dim",
    address: "font-pk-sans text-pk-title break-words text-pk-ink",
    note: "font-pk-sans text-pk-note break-words text-pk-ink-faint",
    arrow:
      "flex size-8 flex-none items-center justify-center rounded-pk-pill border border-pk-line font-pk-sans text-[15px] leading-none text-pk-accent",
  },
});

export type ContactCardProps = useRender.ComponentProps<"div">;

function ContactCard({ className, render, ...props }: ContactCardProps) {
  return useRender({
    render,
    defaultTagName: "div",
    props: {
      ...props,
      "data-slot": "contact-card",
      className: contactCard().root({ className }),
    },
  });
}

export type ContactCardBodyProps = useRender.ComponentProps<"div">;

function ContactCardBody({ className, render, ...props }: ContactCardBodyProps) {
  return useRender({
    render,
    defaultTagName: "div",
    props: {
      ...props,
      "data-slot": "contact-card-body",
      className: contactCard().body({ className }),
    },
  });
}

export type ContactCardLabelProps = useRender.ComponentProps<"span">;

function ContactCardLabel({ className, render, ...props }: ContactCardLabelProps) {
  return useRender({
    render,
    defaultTagName: "span",
    props: {
      ...props,
      "data-slot": "contact-card-label",
      className: contactCard().label({ className }),
    },
  });
}

export type ContactCardAddressProps = useRender.ComponentProps<"span">;

function ContactCardAddress({ className, render, ...props }: ContactCardAddressProps) {
  return useRender({
    render,
    defaultTagName: "span",
    props: {
      ...props,
      "data-slot": "contact-card-address",
      className: contactCard().address({ className }),
    },
  });
}

export type ContactCardNoteProps = useRender.ComponentProps<"span">;

function ContactCardNote({ className, render, ...props }: ContactCardNoteProps) {
  return useRender({
    render,
    defaultTagName: "span",
    props: {
      ...props,
      "data-slot": "contact-card-note",
      className: contactCard().note({ className }),
    },
  });
}

export type ContactCardArrowProps = useRender.ComponentProps<"span">;

function ContactCardArrow({ children = "→", className, render, ...props }: ContactCardArrowProps) {
  return useRender({
    render,
    defaultTagName: "span",
    props: {
      "aria-hidden": true,
      ...props,
      "data-slot": "contact-card-arrow",
      className: contactCard().arrow({ className }),
      children,
    },
  });
}

ContactCard.Body = ContactCardBody;
ContactCard.Label = ContactCardLabel;
ContactCard.Address = ContactCardAddress;
ContactCard.Note = ContactCardNote;
ContactCard.Arrow = ContactCardArrow;

export {
  ContactCard,
  ContactCardAddress,
  ContactCardArrow,
  ContactCardBody,
  ContactCardLabel,
  ContactCardNote,
  contactCard as contactCardVariants,
};
