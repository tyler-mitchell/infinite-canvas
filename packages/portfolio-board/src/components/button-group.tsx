import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import type { ComponentProps } from "react";
import type { VariantProps } from "tailwind-variants";

import { tv } from "../tv.ts";
import { Separator, type SeparatorProps } from "./separator.tsx";

const buttonGroup = tv({
  base: "flex w-fit items-stretch has-[>[data-slot=button-group]]:gap-2 [&>*]:focus-visible:relative [&>*]:focus-visible:z-10 [&>[data-slot=select-trigger]:not([class*='w-'])]:w-fit [&>input]:flex-1",
  variants: {
    orientation: {
      horizontal:
        "[&>[data-slot]:not(:last-child)]:rounded-r-none [&>[data-slot]~[data-slot]]:rounded-l-none [&>[data-slot]~[data-slot]]:border-l-0",
      vertical:
        "flex-col [&>[data-slot]:not(:last-child)]:rounded-b-none [&>[data-slot]~[data-slot]]:rounded-t-none [&>[data-slot]~[data-slot]]:border-t-0",
    },
  },
  defaultVariants: { orientation: "horizontal" },
});

export type ButtonGroupProps = ComponentProps<"div"> & VariantProps<typeof buttonGroup>;

/** A nested group is spaced from its siblings, which is how a toolbar shows clusters. */
function ButtonGroup({ className, orientation = "horizontal", ...props }: ButtonGroupProps) {
  return (
    <div
      role="group"
      data-slot="button-group"
      data-orientation={orientation}
      className={buttonGroup({ orientation, className })}
      {...props}
    />
  );
}

export type ButtonGroupTextProps = useRender.ComponentProps<"div">;

function ButtonGroupText({ className, render, ...props }: ButtonGroupTextProps) {
  return useRender({
    defaultTagName: "div",
    render,
    props: mergeProps<"div">(
      {
        className: `flex items-center gap-2 rounded-pk-control border border-pk-line bg-pk-ink/[0.06] px-3 font-pk-sans text-pk-control text-pk-ink-muted [&_svg]:pointer-events-none [&_svg]:size-3.5 ${className ?? ""}`,
      },
      props,
    ),
    state: { slot: "button-group-text" },
  });
}

export type ButtonGroupSeparatorProps = SeparatorProps;

function ButtonGroupSeparator({
  className,
  orientation = "vertical",
  ...props
}: ButtonGroupSeparatorProps) {
  return (
    <Separator
      data-slot="button-group-separator"
      orientation={orientation}
      className={`relative self-stretch bg-pk-line data-[orientation=horizontal]:mx-px data-[orientation=horizontal]:w-auto data-[orientation=vertical]:my-px data-[orientation=vertical]:h-auto ${className ?? ""}`}
      {...props}
    />
  );
}

export { ButtonGroup, ButtonGroupSeparator, ButtonGroupText, buttonGroup as buttonGroupVariants };
