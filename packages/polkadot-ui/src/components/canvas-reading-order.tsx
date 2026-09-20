import type { Canvas } from "@hyphened/infinite-canvas/next";
import { observer } from "@legendapp/state/react";
import { ChevronDownIcon, ChevronUpIcon } from "lucide-react";
import type { ComponentProps } from "react";
import { tv } from "../tv.ts";
import { Button } from "./button.tsx";
import { FieldLegend, FieldSet } from "./field.tsx";

const styles = tv({
  slots: {
    root: "mb-4 flex flex-col gap-2 border-b border-pk-line pb-4",
    list: "flex flex-col gap-1",
    item: "flex items-center gap-2 rounded-pk-inner px-2 py-1 text-xs aria-[current=true]:bg-pk-accent/10",
    position: "w-4 shrink-0 text-right tabular-nums text-pk-ink-faint",
    title: "flex-1 truncate text-left",
    steps: "flex shrink-0 items-center",
    empty: "text-xs text-pk-ink-faint",
  },
});

export type CanvasReadingOrderProps = Omit<ComponentProps<"section">, "children"> & {
  canvas: Canvas;
  legend?: string;
};

export const CanvasReadingOrder = observer(function CanvasReadingOrder({
  canvas,
  legend = "Reading order",
  className,
  ...props
}: CanvasReadingOrderProps) {
  const route = canvas.computed.route.get();
  const selected = canvas.computed.selectedWindows.map((window) => window.id.get());
  const classes = styles();
  return (
    <section className={classes.root({ className })} aria-label={legend} {...props}>
      <FieldSet>
        <FieldLegend variant="label">{legend}</FieldLegend>
        {route.length === 0 ? (
          <p className={classes.empty()}>No window takes a place in the reading order.</p>
        ) : (
          <ol className={classes.list()}>
            {route.map((section, position) => {
              const title = canvas.state.document.content.windows[section.id].title.get();
              return (
                <li
                  key={section.id}
                  className={classes.item()}
                  aria-current={selected.includes(section.id)}
                >
                  <span className={classes.position()}>{position + 1}</span>
                  <button
                    type="button"
                    className={classes.title()}
                    onClick={() => canvas.actions.revealWindow.run({ window: section.id })}
                  >
                    {title || section.id}
                  </button>
                  <span className={classes.steps()}>
                    <Button
                      size="sm"
                      tone="ghost"
                      aria-label={`Move ${title || section.id} earlier`}
                      disabled={!canvas.commands.moveSection.canRun({ window: section.id, by: -1 })}
                      onClick={() => canvas.actions.moveSection.run({ window: section.id, by: -1 })}
                    >
                      <ChevronUpIcon aria-hidden="true" />
                    </Button>
                    <Button
                      size="sm"
                      tone="ghost"
                      aria-label={`Move ${title || section.id} later`}
                      disabled={!canvas.commands.moveSection.canRun({ window: section.id, by: 1 })}
                      onClick={() => canvas.actions.moveSection.run({ window: section.id, by: 1 })}
                    >
                      <ChevronDownIcon aria-hidden="true" />
                    </Button>
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </FieldSet>
    </section>
  );
});
