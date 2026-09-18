import type { Canvas, WindowState } from "@hyphened/infinite-canvas/next";
import type { Observable } from "@legendapp/state";
import { observer } from "@legendapp/state/react";
import { createHeadlessForm, type Field as FormField } from "@remoteoss/json-schema-form";
import { type, type Type } from "arktype";
import { useState } from "react";
import { Button, Field, Label, NumberField, Select, Stack, Switch, tv } from "polkadot-ui";

const styles = tv({
  slots: {
    root: "mb-4 border-b border-pk-line pb-4",
    heading: "mb-3",
    section: "mb-3 text-xs uppercase tracking-wide opacity-60",
    row: "w-full",
    rows: "flex w-full flex-col gap-2 rounded-lg border border-pk-line p-2",
    entry: "flex items-center gap-2",
    error: "text-xs text-pk-accent",
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
  title,
  schema,
  values,
  onChange,
}: {
  title: string;
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
    <Stack gap="sm">
      <p className={styles().section()}>{title}</p>
      {fieldsOf({ schema, values }).map((field) => (
        <Field key={field.name} layout="stacked" className={styles().row()}>
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
      {error !== null && (
        <p role="alert" className={styles().error()}>
          {error}
        </p>
      )}
    </Stack>
  );
});

export const Inspector = observer(function Inspector({ canvas }: { canvas: Canvas }) {
  const selected =
    canvas.computed.selectedWindows.length === 1 ? canvas.computed.selectedWindows[0] : undefined;
  if (selected === undefined) return null;
  const id = selected.id.get();
  const window = selected as Observable<WindowState>;
  const layout = window.layout.get();
  const parentId = canvas.computed.windowParent[id].get();
  const parentType =
    parentId === undefined
      ? undefined
      : canvas.state.document.content.windows[parentId].layout.type.get();
  const layouts = canvas.configuration.layouts;
  return (
    <section className={styles().root()} aria-label="Selection">
      <header className={styles().heading()}>
        <Label>{window.title.get() || id}</Label>
      </header>
      {layout !== undefined && (
        <Stack gap="sm">
          <Field layout="stacked" className={styles().row()}>
            <Field.Label>Layout</Field.Label>
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
            title="Layout options"
            schema={layouts[layout.type].options}
            values={layout}
            onChange={(values) =>
              canvas.actions.setWindowLayout.run({
                window: id,
                layout: { ...values, type: layout.type },
              })
            }
          />
        </Stack>
      )}
      {parentType !== undefined && (
        <Form
          title={`${parentType} item`}
          schema={layouts[parentType].item}
          values={window.item.get() ?? {}}
          onChange={(values) => canvas.actions.setWindowItem.run({ window: id, item: values })}
        />
      )}
    </section>
  );
});
