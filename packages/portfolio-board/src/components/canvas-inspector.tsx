import type { Canvas, WindowState } from "@hyphened/infinite-canvas";
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
  const chosen = canvas.computed.selectedWindows;
  if (chosen.length === 0) return null;
  const selected = chosen[0];
  const ids = chosen.map((entry) => entry.id.get());
  const overridden = chosen
    .filter((entry) => entry.navigable.get() !== undefined)
    .map((entry) => entry.id.get());
  const alone = ids.length === 1;
  const id = selected.id.get();
  const window = selected as Observable<WindowState>;
  const layout = alone ? window.layout.get() : undefined;
  const parentType = alone ? canvas.computed.parentLayoutType[id].get() : undefined;
  const nested = ids.some((entry) => canvas.computed.parentLayoutType[entry].get() !== undefined);
  const layouts = canvas.configuration.layouts;
  return (
    <section className={styles().root()} aria-label="Selection">
      <FieldSet>
        <FieldLegend variant="label">{alone ? "Window" : `${ids.length} windows`}</FieldLegend>
        <FieldGroup>
          {alone && (
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
          )}
          <Field>
            <Field.Content>
              <Field.Label>Include in navigation</Field.Label>
              <Field.Description>
                {overridden.length === 0
                  ? "Uses the component default."
                  : `Overridden on ${overridden.length} of ${ids.length} windows.`}
              </Field.Description>
            </Field.Content>
            {overridden.length > 0 && (
              <Button
                size="sm"
                tone="ghost"
                onClick={() =>
                  overridden.forEach((entry) =>
                    canvas.actions.setWindowNavigable.run({ window: entry }),
                  )
                }
              >
                Reset
              </Button>
            )}
            <Switch
              checked={ids.every((entry) => canvas.computed.windowNavigable[entry].get())}
              onCheckedChange={(checked) =>
                ids.forEach((entry) =>
                  canvas.actions.setWindowNavigable.run({ window: entry, navigable: checked }),
                )
              }
            />
          </Field>
          {!nested && (
            <Field>
              <Field.Content>
                <Field.Label>Viewport width</Field.Label>
                <Field.Description>Follows the window rather than its own size.</Field.Description>
              </Field.Content>
              <Switch
                checked={chosen.every((entry) => entry.widthMode.get() === "viewport")}
                onCheckedChange={(checked) =>
                  ids.forEach((entry) =>
                    canvas.actions.setWindowSizeMode.run({
                      window: entry,
                      widthMode: checked ? "viewport" : "manual",
                    }),
                  )
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
              checked={chosen.every((entry) => entry.heightMode.get() === "content")}
              onCheckedChange={(checked) =>
                ids.forEach((entry) =>
                  canvas.actions.setWindowSizeMode.run({
                    window: entry,
                    heightMode: checked ? "content" : "manual",
                  }),
                )
              }
            />
          </Field>
        </FieldGroup>
      </FieldSet>
      {alone && (
        <FieldSet>
          <FieldLegend variant="label">Maximum size</FieldLegend>
          <FieldGroup>
            <SchemaForm
              schema={canvas.commands.setWindowSizeMode.input.get("maxSize").exclude("undefined")}
              values={window.maxSize.get() ?? {}}
              onChange={(maxSize) => canvas.actions.setWindowSizeMode.run({ window: id, maxSize })}
            />
          </FieldGroup>
        </FieldSet>
      )}
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
