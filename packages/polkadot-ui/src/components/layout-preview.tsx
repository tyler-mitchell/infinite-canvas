import { tv } from "../tv.ts";

const layoutPreview = tv({
  slots: {
    root: "relative min-h-0 flex-1 overflow-hidden rounded-pk-control border border-pk-line-inner bg-pk-ground",
    pane: "absolute rounded-[5px] border transition-[left,top,width,height] duration-(--pk-duration-detail) ease-pk-swift",
  },
  variants: {
    active: {
      true: { pane: "border-pk-pane-line-active bg-pk-pane-active" },
      false: { pane: "border-pk-pane-line bg-pk-pane" },
    },
  },
  defaultVariants: { active: false },
});

/** Percentages of the frame, so a recipe is resolution-free. */
export interface Pane {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
  readonly active?: boolean;
}

export type LayoutPreviewProps = Omit<React.ComponentProps<"div">, "children"> & {
  readonly panes: readonly Pane[];
  readonly label?: string;
};

/**
 * A pane is four of these, straight from the recipe. A length that is not a usable number is
 * written as zero: the browser drops a declaration it cannot read, and the pane then lands at its
 * static position rather than where it was put, which nothing reports.
 */
const percent = (value: number) => `${Number.isFinite(value) ? value : 0}%`;

function LayoutPreview({ panes, label, className, ...props }: LayoutPreviewProps) {
  const styles = layoutPreview();
  /* An active pane is drawn in its own fill and line, and the frame is one image: a pane carries
   * no words of its own, so the count is the only place the state can be said. */
  const active = panes.filter((pane) => pane.active).length;
  const counted = active > 0 ? `${panes.length} panes, ${active} active` : `${panes.length} panes`;

  return (
    <div
      data-slot="layout-preview"
      role="img"
      aria-label={label?.trim() || counted}
      className={styles.root({ className })}
      {...props}
    >
      {panes.map((pane, index) => (
        <span
          key={index}
          style={{
            left: percent(pane.left),
            top: percent(pane.top),
            width: percent(pane.width),
            height: percent(pane.height),
          }}
          className={layoutPreview({ active: pane.active ?? false }).pane()}
        />
      ))}
    </div>
  );
}

export { LayoutPreview, layoutPreview as layoutPreviewVariants };
