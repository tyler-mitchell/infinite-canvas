import type { Canvas, WindowState } from "@hyphened/infinite-canvas/next";
import type { Observable } from "@legendapp/state";
import { observer } from "@legendapp/state/react";
import { tv } from "../tv.ts";
import { Button } from "./button.tsx";
import { Field, FieldGroup, FieldLegend, FieldSet } from "./field.tsx";
import { Input } from "./input.tsx";
import { SchemaForm } from "./schema-form.tsx";
import { Select } from "./select.tsx";
import { Switch } from "./switch.tsx";

const styles = tv({
  slots: {
    root: "mb-4 flex flex-col gap-4 border-b border-pk-line pb-4",
  },
});

export type CanvasInspectorProps = { canvas: Canvas };

export const CanvasInspector = observer(function CanvasInspector({ canvas }: CanvasInspectorProps) {
  const selected =
    canvas.computed.selectedWindows.length === 1 ? canvas.computed.selectedWindows[0] : undefined;
  if (selected === undefined) return null;
  const id = selected.id.get();
  const window = selected as Observable<WindowState>;
  const layout = window.layout.get();
  const parentType = canvas.computed.parentLayoutType[id].get();
  const layouts = canvas.configuration.layouts;
  return (
    <section className={styles().root()} aria-label="Selection">
      <FieldSet>
        <FieldLegend variant="label">Window</FieldLegend>
        <FieldGroup>
          <Field orientation="vertical">
            <Field.Label>Title</Field.Label>
            <Input
              key={id}
              defaultValue={window.title.get()}
              placeholder={id}
              onBlur={(event) =>
                canvas.actions.renameWindow.run({ window: id, title: event.target.value })
              }
              onKeyDown={(event) => {
                if (event.key === "Enter") event.currentTarget.blur();
              }}
            />
          </Field>
          <Field>
            <Field.Content>
              <Field.Label>Section</Field.Label>
              <Field.Description>
                {window.section.get() === undefined
                  ? "Takes its place in the reading order. Following this component's default."
                  : "Takes its place in the reading order. Set on this window."}
              </Field.Description>
            </Field.Content>
            {window.section.get() !== undefined && (
              <Button
                size="sm"
                tone="ghost"
                onClick={() => canvas.actions.setWindowSection.run({ window: id })}
              >
                Reset
              </Button>
            )}
            <Switch
              checked={canvas.computed.windowSection[id].get()}
              onCheckedChange={(checked) =>
                canvas.actions.setWindowSection.run({ window: id, section: checked })
              }
            />
          </Field>
          {parentType === undefined && (
            <Field>
              <Field.Content>
                <Field.Label>Viewport width</Field.Label>
                <Field.Description>Follows the window rather than its own size.</Field.Description>
              </Field.Content>
              <Switch
                checked={window.widthMode.get() === "viewport"}
                onCheckedChange={(checked) =>
                  canvas.actions.setWindowSizeMode.run({
                    window: id,
                    widthMode: checked ? "viewport" : "manual",
                  })
                }
              />
            </Field>
          )}
          <Field>
            <Field.Content>
              <Field.Label>Fit height to content</Field.Label>
              <Field.Description>Grows and shrinks with what is inside.</Field.Description>
            </Field.Content>
            <Switch
              checked={window.heightMode.get() === "content"}
              onCheckedChange={(checked) =>
                canvas.actions.setWindowSizeMode.run({
                  window: id,
                  heightMode: checked ? "content" : "manual",
                })
              }
            />
          </Field>
        </FieldGroup>
      </FieldSet>
      {layout !== undefined && (
        <FieldSet>
          <FieldLegend variant="label">Layout</FieldLegend>
          <FieldGroup>
            <Field orientation="vertical">
              <Field.Label>Kind</Field.Label>
              <Select
                value={layout.type}
                onValueChange={(next) => {
                  if (next !== null)
                    canvas.actions.setWindowLayout.run({ window: id, layout: { type: next } });
                }}
              >
                <Select.Trigger />
                <Select.Content>
                  {Object.keys(layouts).map((name) => (
                    <Select.Item key={name} value={name}>
                      {name}
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select>
            </Field>
            <SchemaForm
              schema={layouts[layout.type].options}
              values={layout}
              onChange={(values) =>
                canvas.actions.setWindowLayout.run({
                  window: id,
                  layout: { ...values, type: layout.type },
                })
              }
            />
          </FieldGroup>
        </FieldSet>
      )}
      {parentType !== undefined && (
        <FieldSet>
          <FieldLegend variant="label">Placement</FieldLegend>
          <FieldGroup>
            <SchemaForm
              schema={layouts[parentType].item}
              values={window.item.get() ?? {}}
              onChange={(values) => canvas.actions.setWindowItem.run({ window: id, item: values })}
            />
          </FieldGroup>
        </FieldSet>
      )}
    </section>
  );
});
