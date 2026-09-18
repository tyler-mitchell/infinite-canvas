import { Accordion } from "@base-ui/react/accordion";
import { Tabs } from "@base-ui/react/tabs";
import type { Observable } from "@legendapp/state";
import { observer } from "@legendapp/state/react";
import type { CSSProperties, ReactNode, RefObject } from "react";
import type { WindowState } from "../document.types";
import type { Rect } from "../geometry";
import { capturePointer, isPrimaryButton, readPointer, report } from "../input";
import type { Control } from "../layout/kinds";
import type { Canvas } from "../state.types";

export type ChildLabel = (input: {
  canvas: Canvas;
  window: Observable<WindowState>;
  child: string;
}) => ReactNode;
export type ControlRenderer = (input: {
  canvas: Canvas;
  window: Observable<WindowState>;
  control: Extract<Control, { type: "custom" }>;
  style: CSSProperties;
}) => ReactNode;

export const WindowControls = observer(function WindowControls({
  canvas,
  window,
  viewport,
  instanceId,
  origin,
  renderChildLabel,
  renderControl,
}: {
  canvas: Canvas;
  window: Observable<WindowState>;
  viewport: RefObject<HTMLDivElement | null>;
  instanceId: string;
  origin: Rect;
  renderChildLabel?: ChildLabel;
  renderControl?: ControlRenderer;
}) {
  const id = window.id.get();
  const controls =
    canvas.computed.arrangement[canvas.computed.windowRoot[id].get()].controls[id].get() ?? [];
  const local = (rect: Rect): CSSProperties => ({
    position: "absolute",
    left: 0,
    top: 0,
    transform: `translate(${rect.x - origin.x}px, ${rect.y - origin.y}px)`,
    width: rect.width,
    height: rect.height,
  });
  const elementId = (child: string) => `${instanceId}-window-${child}`;
  const label = (child: string) =>
    renderChildLabel?.({ canvas, window, child }) ??
    canvas.state.document.content.windows[child].title.get();
  const activate = (child: string) =>
    report(canvas.actions.activateChild.run({ container: id, child }));
  const headers = controls.filter((control) => control.type === "header");
  return (
    <>
      {controls.map((control) => {
        if (control.type === "tabs")
          return (
            <Tabs.Root
              key="tabs"
              data-slot="canvas-window-tabs"
              value={control.active}
              onValueChange={(value) => {
                if (typeof value === "string") activate(value);
              }}
            >
              <Tabs.List
                data-slot="canvas-window-tab-list"
                style={{ ...local(control.rect), display: "flex", pointerEvents: "auto" }}
              >
                {control.children.map((child) => (
                  <Tabs.Tab
                    key={child}
                    value={child}
                    data-canvas-tab
                    data-container-id={id}
                    data-child-id={child}
                    onPointerDown={(event) => {
                      const element = viewport.current;
                      if (element === null || !isPrimaryButton(event)) return;
                      const error = canvas.actions.beginTabDrag.run({
                        target: { container: id, child },
                        pointer: readPointer(event, element),
                      });
                      report(error);
                      if (error !== undefined) return;
                      event.stopPropagation();
                      capturePointer(element, event.pointerId);
                    }}
                  >
                    {label(child)}
                  </Tabs.Tab>
                ))}
              </Tabs.List>
              {control.children.map((child) => (
                <Tabs.Panel
                  key={child}
                  value={child}
                  keepMounted
                  aria-owns={child === control.active ? elementId(child) : undefined}
                  style={{ display: "contents" }}
                />
              ))}
            </Tabs.Root>
          );
        if (control.type === "sash")
          return (
            <div
              key={`sash:${control.index}`}
              data-slot="canvas-window-sash"
              data-axis={control.axis}
              aria-hidden="true"
              style={{
                ...local(control.rect),
                pointerEvents: "auto",
                touchAction: "none",
                cursor: control.axis === "horizontal" ? "ew-resize" : "ns-resize",
              }}
              onPointerDown={(event) => {
                const element = viewport.current;
                if (element === null || !isPrimaryButton(event)) return;
                const error = canvas.actions.beginSashDrag.run({
                  target: { container: id, index: control.index },
                  pointer: readPointer(event, element),
                });
                report(error);
                if (error !== undefined) return;
                event.preventDefault();
                event.stopPropagation();
                capturePointer(element, event.pointerId);
              }}
            />
          );
        if (control.type === "custom")
          return renderControl?.({ canvas, window, control, style: local(control.rect) }) ?? null;
        return null;
      })}
      {headers.length > 0 && (
        <Accordion.Root
          data-slot="canvas-window-accordion"
          orientation={headers[0].axis}
          value={headers.filter((header) => header.expanded).map((header) => header.child)}
          onValueChange={(value) => {
            if (typeof value[0] === "string") activate(value[0]);
          }}
        >
          {headers.map((header) => (
            <Accordion.Item key={header.child} value={header.child} style={{ display: "contents" }}>
              <Accordion.Header style={{ display: "contents" }}>
                <Accordion.Trigger
                  data-slot="canvas-window-accordion-header"
                  data-axis={header.axis}
                  style={{ ...local(header.rect), pointerEvents: "auto" }}
                >
                  {label(header.child)}
                </Accordion.Trigger>
              </Accordion.Header>
              <Accordion.Panel
                keepMounted
                aria-owns={header.expanded ? elementId(header.child) : undefined}
                style={{ display: "contents" }}
              />
            </Accordion.Item>
          ))}
        </Accordion.Root>
      )}
    </>
  );
});
