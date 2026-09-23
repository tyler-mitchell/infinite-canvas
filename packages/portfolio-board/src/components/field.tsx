import { Field as FieldPrimitive } from "@base-ui/react/field";
import type { ComponentProps, ReactNode } from "react";
import { useMemo } from "react";
import type { VariantProps } from "tailwind-variants";

import { tv } from "../tv.ts";
import { Separator } from "./separator.tsx";
import { textVariants } from "./text.tsx";

const field = tv({
  slots: {
    set: "flex min-w-0 flex-col gap-4",
    legend: "mb-1 text-pk-label text-pk-ink-bright",
    group: "group/field-group @container/field-group flex w-full flex-col gap-3",
    root: "group/field flex min-w-0",
    content: "group/field-content flex flex-1 flex-col gap-0.5 leading-snug",
    label: "cursor-pointer select-none data-disabled:cursor-default data-disabled:opacity-40",
    title: "flex w-fit items-center gap-2",
    description: "text-pk-meta leading-normal text-pk-ink-dim last:mt-0",
    separator: "relative my-1 h-px",
    separatorLine: "absolute inset-0 top-1/2",
    separatorContent: "relative mx-auto block w-fit px-2",
    error: "text-pk-meta text-pk-accent",
    errorList: "ml-4 flex list-disc flex-col gap-1",
  },
  variants: {
    orientation: {
      vertical: { root: "flex-col gap-1.5 *:w-full [&>.sr-only]:w-auto" },
      horizontal: {
        root: "flex-row items-center gap-2.5 has-[>[data-slot=field-content]]:items-start [&>[data-slot=field-label]]:flex-auto",
      },
      responsive: {
        root: "flex-col gap-1.5 *:w-full @md/field-group:flex-row @md/field-group:items-center @md/field-group:gap-2.5 @md/field-group:*:w-auto",
      },
    },
  },
  defaultVariants: { orientation: "horizontal" },
});

type WithClassName<T> = Omit<T, "className"> & { className?: string };

export type FieldSetProps = ComponentProps<"fieldset">;

function FieldSet({ className, ...props }: FieldSetProps) {
  return <fieldset data-slot="field-set" className={field().set({ className })} {...props} />;
}

export type FieldLegendProps = ComponentProps<"legend"> & { variant?: "legend" | "label" };

function FieldLegend({ className, variant = "legend", ...props }: FieldLegendProps) {
  return (
    <legend
      data-slot="field-legend"
      data-variant={variant}
      className={field().legend({ className })}
      {...props}
    />
  );
}

export type FieldGroupProps = ComponentProps<"div">;

/** The layout a stack of fields lives in. A form never spaces its own children. */
function FieldGroup({ className, ...props }: FieldGroupProps) {
  return <div data-slot="field-group" className={field().group({ className })} {...props} />;
}

export interface FieldProps
  extends WithClassName<FieldPrimitive.Root.Props>,
    VariantProps<typeof field> {}

/**
 * Pairs a control with the words that name it. Base UI associates the two, so a switch that reads
 * as `switch, off` on its own reads as `sound, switch, off` inside one.
 */
function Field({ orientation = "horizontal", className, ...props }: FieldProps) {
  return (
    <FieldPrimitive.Root
      data-slot="field"
      data-orientation={orientation}
      className={field({ orientation }).root({ className })}
      {...props}
    />
  );
}

export type FieldContentProps = ComponentProps<"div">;

function FieldContent({ className, ...props }: FieldContentProps) {
  return <div data-slot="field-content" className={field().content({ className })} {...props} />;
}

export type FieldLabelProps = WithClassName<FieldPrimitive.Label.Props>;

/**
 * The control's name, in the same voice as a `Label`. It renders a real `label`, so pointing at
 * the words works the control.
 */
function FieldLabel({ className, ...props }: FieldLabelProps) {
  return (
    <FieldPrimitive.Label
      data-slot="field-label"
      className={textVariants({ as: "label", className: field().label({ className }) })}
      {...props}
    />
  );
}

export type FieldTitleProps = ComponentProps<"div">;

function FieldTitle({ className, ...props }: FieldTitleProps) {
  return <div data-slot="field-title" className={field().title({ className })} {...props} />;
}

export type FieldDescriptionProps = WithClassName<FieldPrimitive.Description.Props>;

function FieldDescription({ className, ...props }: FieldDescriptionProps) {
  return (
    <FieldPrimitive.Description
      data-slot="field-description"
      className={field().description({ className })}
      {...props}
    />
  );
}

export type FieldSeparatorProps = ComponentProps<"div">;

function FieldSeparator({ children, className, ...props }: FieldSeparatorProps) {
  return (
    <div
      data-slot="field-separator"
      data-content={children !== undefined}
      className={field().separator({ className })}
      {...props}
    >
      <Separator className={field().separatorLine()} />
      {children !== undefined && (
        <span data-slot="field-separator-content" className={field().separatorContent()}>
          {children}
        </span>
      )}
    </div>
  );
}

export type FieldErrorProps = ComponentProps<"div"> & {
  errors?: readonly ({ message?: string } | undefined)[];
  children?: ReactNode;
};

function FieldError({ className, children, errors, ...props }: FieldErrorProps) {
  const content = useMemo(() => {
    if (children !== undefined) return children;
    const unique = [...new Map((errors ?? []).map((error) => [error?.message, error])).values()];
    if (unique.length === 0) return null;
    if (unique.length === 1) return unique[0]?.message;
    return (
      <ul className={field().errorList()}>
        {unique.map((error) => error?.message !== undefined && <li key={error.message}>{error.message}</li>)}
      </ul>
    );
  }, [children, errors]);
  if (content === null || content === undefined) return null;
  return (
    <div role="alert" data-slot="field-error" className={field().error({ className })} {...props}>
      {content}
    </div>
  );
}

Field.Label = FieldLabel;
Field.Content = FieldContent;
Field.Description = FieldDescription;
Field.Error = FieldError;
Field.Group = FieldGroup;
Field.Legend = FieldLegend;
Field.Separator = FieldSeparator;
Field.Set = FieldSet;
Field.Title = FieldTitle;

export {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSeparator,
  FieldSet,
  FieldTitle,
  field as fieldVariants,
};
