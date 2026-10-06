import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { observer } from "@legendapp/state/react";
import type { PlacedSection } from "@hyphened/math/cpu";
import type { ComponentPropsWithRef, ReactNode } from "react";
import { useCanvasScroll } from "./scroll";

export type WindowNavigationEntry = PlacedSection & { title: string; current: boolean };

const WindowNavigationRoot = observer(function WindowNavigationRoot({
  children,
  render,
  ref,
  ...props
}: Omit<ComponentPropsWithRef<"nav">, "children"> & {
  render?: useRender.RenderProp;
  children: (window: WindowNavigationEntry) => ReactNode;
}) {
  const { canvas, windows } = useCanvasScroll();
  const activeWindowId = canvas.computed.view.activeWindowId.get();
  const entries = windows.map((window) => ({
    ...window,
    title: canvas.state.document.content.windows[window.id].title.get() || window.id,
    current: activeWindowId === window.id,
  }));
  return useRender({
    defaultTagName: "nav",
    render,
    ref,
    props: {
      "aria-label": "Components",
      ...props,
      "data-slot": "canvas-window-navigation",
      "data-canvas-control": "",
      children: entries.map(children),
    },
  });
});

function WindowNavigationItem({
  window,
  children,
  render,
  ref,
  ...props
}: ComponentPropsWithRef<"button"> & {
  render?: useRender.RenderProp;
  window: WindowNavigationEntry;
}) {
  const { focusWindow } = useCanvasScroll();
  return useRender({
    defaultTagName: "button",
    render,
    ref,
    props: {
      ...mergeProps<"button">(
        { type: "button", "aria-label": window.title, onClick: () => focusWindow(window.id) },
        props,
      ),
      "aria-current": window.current || undefined,
      "data-slot": "canvas-window-navigation-item",
      "data-canvas-control": "",
      children: children ?? window.title,
    },
  });
}

export const WindowNavigation = { Root: WindowNavigationRoot, Item: WindowNavigationItem };
