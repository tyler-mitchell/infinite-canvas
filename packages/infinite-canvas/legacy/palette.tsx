import { Autocomplete } from "@base-ui/react/autocomplete";
import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { createContext, useContext, type ComponentPropsWithRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { useComponentPalette } from "./use-component-palette";
import type { InfiniteCanvasOverlayRenderContext } from "./types";

export const PaletteContext = createContext<unknown>(null);
function usePalette() {
  const value = useContext(PaletteContext);
  if (value === null) throw new Error("Palette parts require a configured canvas viewport.");
  return value as Readonly<{
    palette: ReturnType<typeof useComponentPalette>;
    context: Pick<InfiniteCanvasOverlayRenderContext, "drag" | "startDrag">;
  }>;
}
function Root({
  portal = false,
  autocomplete,
  render,
  ref,
  ...props
}: ComponentPropsWithRef<"aside"> & {
  render?: useRender.RenderProp;
  portal?: boolean;
  autocomplete?: Omit<Autocomplete.Root.Props<string>, "items" | "children" | "inline" | "open">;
}) {
  const { palette } = usePalette();
  const element = useRender({
    defaultTagName: "aside",
    render,
    ref,
    props: { ...props, "data-slot": "component-palette" },
  });
  const node = (
    <Autocomplete.Root {...autocomplete} items={palette.items.map(({ kind }) => kind)} inline open>
      {element}
    </Autocomplete.Root>
  );
  return portal && typeof document !== "undefined" ? createPortal(node, document.body) : node;
}
function List({
  children,
  ...props
}: Omit<Autocomplete.List.Props, "children"> & {
  children: (component: Readonly<{ id: string }>) => ReactNode;
}) {
  return (
    <Autocomplete.List {...props} data-slot="component-palette-list">
      {(id: string) => children({ id })}
    </Autocomplete.List>
  );
}
function Item({ componentId, ...props }: Autocomplete.Item.Props & { componentId: string }) {
  const { palette, context } = usePalette();
  const { isDragging, ...control } = palette.getItemProps({ componentId, context });
  return (
    <Autocomplete.Item
      {...mergeProps<typeof Autocomplete.Item>(control, props)}
      value={componentId}
      data-slot="component-palette-item"
      data-dragging={isDragging ? "" : undefined}
    />
  );
}
function ErrorMessage({
  render,
  ref,
  children,
  ...props
}: ComponentPropsWithRef<"p"> & { render?: useRender.RenderProp }) {
  const { palette } = usePalette();
  return useRender({
    defaultTagName: "p",
    render,
    ref,
    enabled: palette.error !== null,
    props: { ...props, role: "alert", children: children ?? palette.error },
  });
}
export const InfiniteCanvasPalette = {
  Root,
  Input: Autocomplete.Input,
  List,
  Item,
  Empty: Autocomplete.Empty,
  Clear: Autocomplete.Clear,
  Error: ErrorMessage,
} as const;
