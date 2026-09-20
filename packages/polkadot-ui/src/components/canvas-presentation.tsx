import type { Canvas } from "@hyphened/infinite-canvas/next";
import { observer } from "@legendapp/state/react";
import type { ComponentProps } from "react";
import { tv } from "../tv.ts";
import { FieldGroup, FieldLegend, FieldSet } from "./field.tsx";
import { SchemaForm } from "./schema-form.tsx";

const styles = tv({
  slots: {
    root: "mb-4 flex flex-col gap-4 border-b border-pk-line pb-4",
  },
});

export type CanvasPresentationProps = Omit<ComponentProps<"section">, "children"> & {
  canvas: Canvas;
  legend?: string;
};

export const CanvasPresentation = observer(function CanvasPresentation({
  canvas,
  legend = "Reading",
  className,
  ...props
}: CanvasPresentationProps) {
  const command = canvas.commands.setPresentation;
  return (
    <section className={styles().root({ className })} aria-label={command.label} {...props}>
      <FieldSet>
        <FieldLegend variant="label">{legend}</FieldLegend>
        <FieldGroup>
          <SchemaForm
            schema={command.input}
            values={canvas.state.document.content.presentation.get()}
            onChange={(values) => canvas.actions.setPresentation.run(values)}
          />
        </FieldGroup>
      </FieldSet>
    </section>
  );
});
