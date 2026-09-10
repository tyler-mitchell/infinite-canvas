import { ScrollArea as ScrollAreaPrimitive } from "@base-ui/react/scroll-area";
import { tv } from "../tv.ts";

const scrollArea = tv({
  slots: {
    root: "relative min-h-0 overflow-hidden",
    viewport:
      "size-full overscroll-contain outline-none focus-visible:ring-2 focus-visible:ring-pk-accent/50",
    scrollbar:
      "m-px flex touch-none justify-center rounded-pk-pill opacity-0 transition-opacity delay-200 duration-(--pk-duration-hover) ease-pk-swift select-none data-hovering:opacity-100 data-hovering:delay-0 data-scrolling:opacity-100 data-scrolling:delay-0 data-[orientation=horizontal]:h-1 data-[orientation=vertical]:w-1",
    /* A thumb is a control, not a separation, so it comes off the ink scale: the line scale tops
     * out at 1.92:1 on a card, under the 3:1 a non-text control is asked for. */
    thumb: "rounded-pk-pill bg-pk-ink-faint",
    corner: "bg-transparent",
  },
});

type WithClassName<T> = Omit<T, "className"> & { className?: string };

export type ScrollAreaProps = WithClassName<ScrollAreaPrimitive.Root.Props> & {
  /** Both axes get a bar when `both`. Defaults to vertical only, which is what a widget body needs. */
  readonly axis?: "vertical" | "horizontal" | "both";
};

/** An overlay scrollbar, so the bar costs no width and content does not reflow when it appears. */
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
