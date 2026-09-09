import { ScrollArea as ScrollAreaPrimitive } from "@base-ui/react/scroll-area";
import { tv } from "tailwind-variants";

const scrollArea = tv({
  slots: {
    root: "relative min-h-0 overflow-hidden",
    viewport:
      "size-full overscroll-contain outline-none focus-visible:ring-2 focus-visible:ring-pk-accent/50",
    /*
     * The scrollbar is absent until the pointer arrives. A widget body is small, and a permanent
     * gutter costs more of it than the bar is worth.
     */
    scrollbar:
      "m-px flex touch-none justify-center rounded-pk-pill opacity-0 transition-opacity delay-200 duration-(--pk-duration-hover) ease-pk-swift select-none data-hovering:opacity-100 data-hovering:delay-0 data-scrolling:opacity-100 data-scrolling:delay-0 data-[orientation=horizontal]:h-1 data-[orientation=vertical]:w-1",
    thumb: "rounded-pk-pill bg-pk-line-strong",
    corner: "bg-transparent",
  },
});

type WithClassName<T> = Omit<T, "className"> & { className?: string };

export type ScrollAreaProps = WithClassName<ScrollAreaPrimitive.Root.Props> & {
  /** Both axes get a bar when `both`. Defaults to vertical only, which is what a widget body needs. */
  readonly axis?: "vertical" | "horizontal" | "both";
};

function ScrollArea({ axis = "vertical", className, children, ...props }: ScrollAreaProps) {
  const styles = scrollArea();

  return (
    <ScrollAreaPrimitive.Root
      data-slot="scroll-area"
      className={styles.root({ className })}
      {...props}
    >
      <ScrollAreaPrimitive.Viewport data-slot="scroll-area-viewport" className={styles.viewport()}>
        <ScrollAreaPrimitive.Content>{children}</ScrollAreaPrimitive.Content>
      </ScrollAreaPrimitive.Viewport>

      {axis !== "horizontal" ? (
        <ScrollAreaPrimitive.Scrollbar orientation="vertical" className={styles.scrollbar()}>
          <ScrollAreaPrimitive.Thumb className={styles.thumb()} />
        </ScrollAreaPrimitive.Scrollbar>
      ) : null}

      {axis !== "vertical" ? (
        <ScrollAreaPrimitive.Scrollbar orientation="horizontal" className={styles.scrollbar()}>
          <ScrollAreaPrimitive.Thumb className={styles.thumb()} />
        </ScrollAreaPrimitive.Scrollbar>
      ) : null}

      {axis === "both" ? <ScrollAreaPrimitive.Corner className={styles.corner()} /> : null}
    </ScrollAreaPrimitive.Root>
  );
}

export { ScrollArea, scrollArea as scrollAreaVariants };
