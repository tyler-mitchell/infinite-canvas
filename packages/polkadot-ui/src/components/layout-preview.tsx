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

function LayoutPreview({ panes, label, className, ...props }: LayoutPreviewProps) {
  const styles = layoutPreview();

  return (
    <div
      data-slot="layout-preview"
      role="img"
      aria-label={label?.trim() || `${panes.length} panes`}
      className={styles.root({ className })}
      {...props}
    >
      {panes.map((pane, index) => (
        <span
          key={index}
          style={{
            left: `${pane.left}%`,
            top: `${pane.top}%`,
            width: `${pane.width}%`,
            height: `${pane.height}%`,
          }}
          className={layoutPreview({ active: pane.active ?? false }).pane()}
        />
      ))}
    </div>
  );
}

export { LayoutPreview, layoutPreview as layoutPreviewVariants };
