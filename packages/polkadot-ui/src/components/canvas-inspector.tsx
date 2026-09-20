import type { Canvas, WindowState } from "@hyphened/infinite-canvas/next";
import type { Observable } from "@legendapp/state";
import { observer } from "@legendapp/state/react";
import { createHeadlessForm, type Field as FormField } from "@remoteoss/json-schema-form";
import { type, type Type } from "arktype";
import { useState } from "react";
import { tv } from "../tv.ts";
import { Button } from "./button.tsx";
import { Field, FieldError, FieldGroup, FieldLegend, FieldSet } from "./field.tsx";
import { Input } from "./input.tsx";
import { NumberField } from "./number-field.tsx";
import { Select } from "./select.tsx";
import { Switch } from "./switch.tsx";

const styles = tv({
  slots: {
    root: "mb-4 flex flex-col gap-4 border-b border-pk-line pb-4",
    rows: "flex w-full flex-col gap-2 rounded-pk-inner border border-pk-line p-2",
    entry: "flex items-center gap-2",
  },
});

type Values = Readonly<Record<string, unknown>>;
type FormInput = Parameters<typeof createHeadlessForm>;
type Change = (values: Values) => unknown;

const fieldsOf = ({ schema, values }: { schema: Type; values: Values }) => {
  const json = schema.toJsonSchema({ dialect: null });
  return !("type" in json) || json.type !== "object"
    ? []
    : createHeadlessForm(
        json as FormInput[0],
        { initialValues: values } as FormInput[1],
      ).fields.filter((field) => field.const === undefined);
};

const numberBounds = (field: FormField) => ({
  ...(typeof field.minimum === "number" ? { min: field.minimum } : {}),
  ...(typeof field.exclusiveMinimum === "number" && field.jsonType === "integer"
    ? { min: field.exclusiveMinimum + 1 }
    : {}),
  ...(typeof field.maximum === "number" ? { max: field.maximum } : {}),
  ...(field.jsonType === "integer" ? { step: 1 } : {}),
});

function Control({
  field,
  value,
  onChange,
}: {
  field: FormField;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const [custom, setCustom] = useState(typeof value === "number" ? value : 1);
  const options = (field.options ?? []) as { label: string; value: unknown; type?: string }[];
  const consts = options.filter((option) => option.value !== undefined);
  const numeric = options.some((option) => option.value === undefined && option.type === "number");
  if (consts.length > 0) {
    const chosen = value ?? field.default;
    const current =
      numeric && typeof value === "number" ? "number" : typeof chosen === "string" ? chosen : "";
    return (
      <>
        <Select
          value={current}
          onValueChange={(next) => onChange(next === "number" ? custom : next)}
        >
          <Select.Trigger placeholder="Choose" />
          <Select.Content>
            {consts.map((option) => (
              <Select.Item key={String(option.value)} value={String(option.value)}>
                {option.label || String(option.value)}
              </Select.Item>
            ))}
            {numeric && <Select.Item value="number">number</Select.Item>}
          </Select.Content>
        </Select>
        {numeric && typeof value === "number" && (
          <NumberField
            value={value}
            min={1}
            onValueChange={(next) => {
              if (next !== null) {
                setCustom(next);
                onChange(next);
              }
            }}
          >
            <NumberField.Group />
          </NumberField>
        )}
      </>
    );
  }
  if (field.jsonType === "boolean")
    return <Switch checked={Boolean(value ?? field.default ?? false)} onCheckedChange={onChange} />;
  if (field.jsonType === "number" || field.jsonType === "integer")
    return (
      <NumberField
        value={typeof value === "number" ? value : null}
        {...numberBounds(field)}
        onValueChange={(next) => onChange(next ?? undefined)}
      >
        <NumberField.Group />
      </NumberField>
    );
  return null;
}

const Rows = ({
  field,
  values,
  onChange,
}: {
  field: FormField;
  values: readonly Values[];
  onChange: (rows: Values[]) => void;
}) => (
  <div className={styles().rows()}>
    {values.map((row, index) => (
      <div key={index} className={styles().entry()}>
        <div className={styles().entry()}>
          {(field.fields ?? []).map((child) => (
            <Control
              key={child.name}
              field={child}
              value={row[child.name]}
              onChange={(value) => onChange(values.with(index, { ...row, [child.name]: value }))}
            />
          ))}
        </div>
        <Button size="sm" tone="ghost" onClick={() => onChange(values.toSpliced(index, 1))}>
          Remove
        </Button>
      </div>
    ))}
    <Button
      size="sm"
      onClick={() =>
        onChange([
          ...values,
          Object.fromEntries((field.fields ?? []).map((child) => [child.name, child.default ?? 0])),
        ])
      }
    >
      Add
    </Button>
  </div>
);

const Form = observer(function Form({
  schema,
  values,
  onChange,
}: {
  schema: Type;
  values: Values;
  onChange: Change;
}) {
  const [error, setError] = useState<string | null>(null);
  const change = (patch: Values) => {
    const result = onChange(
      Object.fromEntries(
        Object.entries({ ...values, ...patch }).filter(([, value]) => value !== undefined),
      ),
    );
    setError(
      result instanceof type.errors
        ? result.summary
        : result instanceof Error
          ? result.message
          : null,
    );
  };
  return (
    <>
      {fieldsOf({ schema, values }).map((field) => (
        <Field key={field.name} orientation="vertical">
          <Field.Label>{field.label ?? field.name}</Field.Label>
          {field.inputType === "group-array" ? (
            <Rows
              field={field}
              values={(values[field.name] as Values[] | undefined) ?? []}
              onChange={(rows) => change({ [field.name]: rows })}
            />
          ) : (
            <Control
              field={field}
              value={values[field.name]}
              onChange={(value) => change({ [field.name]: value })}
            />
          )}
        </Field>
      ))}
      {error !== null && <FieldError>{error}</FieldError>}
    </>
  );
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
            <Form
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
            <Form
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
