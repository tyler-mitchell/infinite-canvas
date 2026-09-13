import { useRender } from "@base-ui/react/use-render";
import type { VariantProps } from "tailwind-variants";
import { inputVariants } from "./input.tsx";
import { tv } from "../tv.ts";

const textarea = tv({ extend: inputVariants, base: "h-auto resize-y py-3" });
export type TextareaProps = useRender.ComponentProps<"textarea"> & VariantProps<typeof textarea>;

function Textarea({ tone, className, render, disabled, ...props }: TextareaProps) {
  return useRender({ defaultTagName: "textarea", render, props: {
    ...props, disabled, "data-disabled": disabled ? "" : undefined, "data-slot": "textarea",
    className: textarea({ tone, className }),
  } });
}

export { Textarea, textarea as textareaVariants };
