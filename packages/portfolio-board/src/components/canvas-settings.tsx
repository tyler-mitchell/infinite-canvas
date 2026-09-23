import type { Canvas } from "@hyphened/infinite-canvas/next";
import { observer } from "@legendapp/state/react";
import { type } from "arktype";
import type { ComponentProps } from "react";
import { tv } from "../tv.ts";
import { FieldGroup, FieldLegend, FieldSet } from "./field.tsx";
import { SchemaForm } from "./schema-form.tsx";

const styles = tv({
  slots: {
    root: "mb-4 flex flex-col gap-4 border-b border-pk-line pb-4",
  },
});

export type CanvasSettingsProps = Omit<ComponentProps<"section">, "children"> & {
  canvas: Canvas;
};

export const CanvasSettings = observer(function CanvasSettings({
  canvas,
  className,
  ...props
}: CanvasSettingsProps) {
  return (
    <section className={styles().root({ className })} aria-label="Canvas settings" {...props}>
      <FieldSet>
        <FieldLegend variant="label">{canvas.commands.setSnapping.label}</FieldLegend>
        <FieldGroup>
          <SchemaForm
            schema={canvas.commands.setSnapping.input}
            values={canvas.state.config.snapping.get()}
            onChange={(values) => {
              const input = canvas.inputs.setSnapping(values);
              return input instanceof type.errors ? input : canvas.actions.setSnapping.run(input);
            }}
          />
        </FieldGroup>
      </FieldSet>
      <FieldSet>
        <FieldLegend variant="label">{canvas.commands.setCameraLimits.label}</FieldLegend>
        <FieldGroup>
          <SchemaForm
            schema={canvas.commands.setCameraLimits.input}
            values={canvas.state.config.camera.get()}
            onChange={(values) => {
              const input = canvas.inputs.setCameraLimits(values);
              return input instanceof type.errors
                ? input
                : canvas.actions.setCameraLimits.run(input);
            }}
          />
        </FieldGroup>
      </FieldSet>
    </section>
  );
});
