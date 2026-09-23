import { useRender } from "@base-ui/react/use-render";

import { tv } from "../tv.ts";

const link = tv({
  base: "text-inherit no-underline outline-none focus-visible:ring-2 focus-visible:ring-pk-accent/60",
});

export type LinkProps = useRender.ComponentProps<"a">;

/** A native link with a visible keyboard focus indicator. */
function Link({ className, render, ...props }: LinkProps) {
  return useRender({
    defaultTagName: "a",
    render,
    props: { ...props, "data-slot": "link", className: link({ className }) },
  });
}

export { Link, link as linkVariants };
