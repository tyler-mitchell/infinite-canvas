import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { observer } from "@legendapp/state/react";
import type { PlacedSection } from "@hyphened/math/cpu";
import type { ComponentPropsWithRef, ReactNode } from "react";
import { useCanvasScroll } from "./scroll";

export type SectionEntry = PlacedSection & { title: string; current: boolean };

const SectionsRoot = observer(function SectionsRoot({
  children,
  render,
  ref,
  ...props
}: Omit<ComponentPropsWithRef<"nav">, "children"> & {
  render?: useRender.RenderProp;
  children: (section: SectionEntry) => ReactNode;
}) {
  const { canvas, sections, current } = useCanvasScroll();
  const active = new Set(current.get());
  const entries = [...Map.groupBy(sections, (section) => section.offset).values()]
    .map((sections) => ({
      ...sections[0]!,
      title: sections
        .map((section) => canvas.state.document.content.windows[section.id].title.get() || section.id)
        .join(", "),
      current: active.has(sections[0]!.id),
    }));
  return useRender({
    defaultTagName: "nav",
    render,
    ref,
    props: {
      "aria-label": "Sections",
      ...props,
      "data-slot": "canvas-sections",
      "data-canvas-control": "",
      children: entries.map(children),
    },
  });
});

function SectionItem({
  section,
  children,
  render,
  ref,
  ...props
}: ComponentPropsWithRef<"button"> & { render?: useRender.RenderProp; section: SectionEntry }) {
  const { scrollTo } = useCanvasScroll();
  return useRender({
    defaultTagName: "button",
    render,
    ref,
    props: {
      ...mergeProps<"button">(
        { type: "button", "aria-label": section.title, onClick: () => scrollTo(section.id) },
        props,
      ),
      "aria-current": section.current || undefined,
      "data-slot": "canvas-section",
      "data-canvas-control": "",
      children: children ?? section.title,
    },
  });
}

export const Sections = { Root: SectionsRoot, Item: SectionItem };
