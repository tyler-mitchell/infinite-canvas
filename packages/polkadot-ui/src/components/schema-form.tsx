import { createHeadlessForm, type Field as FormField } from "@remoteoss/json-schema-form";
import { type, type Type } from "arktype";
import { useState } from "react";
import { tv } from "../tv.ts";
import { Button } from "./button.tsx";
import { Field, FieldError } from "./field.tsx";
import { NumberField } from "./number-field.tsx";
import { Select } from "./select.tsx";
import { Switch } from "./switch.tsx";

const styles = tv({
  slots: {
    rows: "flex w-full flex-col gap-2 rounded-pk-inner border border-pk-line p-2",
    entry: "flex items-center gap-2",
  },
});

export type SchemaValues = Readonly<Record<string, unknown>>;
type FormInput = Parameters<typeof createHeadlessForm>;

const fieldsOf = ({
  schema,
  values,
}: {
  schema: Pick<Type, "toJsonSchema">;
  values: SchemaValues;
}) => {
  const json = schema.toJsonSchema({
    dialect: null,
    fallback: { predicate: (context) => context.base },
  });
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
  values: readonly SchemaValues[];
  onChange: (rows: SchemaValues[]) => void;
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

export type SchemaFormProps<Value extends SchemaValues> = {
  schema: Type<Value>;
  values: SchemaValues;
  onChange: (values: Type<Value>["infer"]) => unknown;
};

export function SchemaForm<Value extends SchemaValues>({
  schema,
  values,
  onChange,
}: SchemaFormProps<Value>) {
  const [error, setError] = useState<string | null>(null);
  const change = (patch: SchemaValues) => {
    const next = Object.fromEntries(
      Object.entries({ ...values, ...patch }).filter(([, value]) => value !== undefined),
    );
    const parsed = schema(next);
    if (parsed instanceof type.errors) {
      setError(parsed.summary);
      return;
    }
    const result = onChange(parsed);
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
              values={(values[field.name] as SchemaValues[] | undefined) ?? []}
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
}
