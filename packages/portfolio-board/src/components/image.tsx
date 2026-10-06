import { useRender } from "@base-ui/react/use-render";
import type { VariantProps } from "tailwind-variants";

import { tv } from "../tv.ts";

const image = tv({
  base: "block max-w-full",
  variants: {
    fill: { true: "size-full", false: "" },
    fit: { contain: "object-contain", cover: "object-cover" },
  },
  defaultVariants: { fit: "contain" },
});

export interface ImageProps extends useRender.ComponentProps<"img">, VariantProps<typeof image> {
  readonly alt: string;
}

/** An image with explicit alternative text and native dragging disabled by default. */
function Image({ className, render, fill, fit, draggable = false, ...props }: ImageProps) {
  return useRender({
    defaultTagName: "img",
    render,
    props: {
      ...props,
      draggable,
      "data-slot": "image",
      className: image({ fill, fit, className }),
    },
  });
}

export { Image, image as imageVariants };
