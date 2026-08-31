import type { CSSProperties } from "react";

/** Merges framework slot props with consumer props. */
type InfiniteCanvasSlotEvent = Readonly<{
  infiniteCanvasHandlerPrevented?: boolean;
  preventInfiniteCanvasHandler?: () => void;
}>;

type InfiniteCanvasSlotProps = Record<string, unknown> &
  Readonly<{
    className?: string;
    style?: CSSProperties;
  }>;

/** Detects React event handler prop names. */
const isEventHandlerKey = (key: string, value: unknown): boolean =>
  key.charCodeAt(0) === 111 &&
  key.charCodeAt(1) === 110 &&
  key.charCodeAt(2) >= 65 &&
  key.charCodeAt(2) <= 90 &&
  (typeof value === "function" || value === undefined);

/** Returns true for React synthetic events. */
const isSyntheticEvent = (value: unknown): value is InfiniteCanvasSlotEvent =>
  typeof value === "object" && value !== null && "nativeEvent" in value;

/** Runs the consumer handler first. The consumer can stop the framework handler. */
const composeEventHandlers = (
  frameworkHandler: unknown,
  consumerHandler: unknown,
): ((...args: readonly unknown[]) => unknown) => {
  return (...args) => {
    const [event] = args;

    if (!isSyntheticEvent(event)) {
      const result = (consumerHandler as ((...a: readonly unknown[]) => unknown) | undefined)?.(
        ...args,
      );
      (frameworkHandler as ((...a: readonly unknown[]) => unknown) | undefined)?.(...args);

      return result;
    }

    const preventable = event as {
      infiniteCanvasHandlerPrevented?: boolean;
      preventInfiniteCanvasHandler?: () => void;
    };

    preventable.preventInfiniteCanvasHandler = () => {
      preventable.infiniteCanvasHandlerPrevented = true;
    };

    const result = (consumerHandler as ((...a: readonly unknown[]) => unknown) | undefined)?.(
      ...args,
    );

    if (preventable.infiniteCanvasHandlerPrevented !== true) {
      (frameworkHandler as ((...a: readonly unknown[]) => unknown) | undefined)?.(...args);
    }

    return result;
  };
};

/** Merges slot props. Event handlers compose, and `data-slot` stays framework-owned. */
function mergeInfiniteCanvasSlotProps(
  frameworkProps: InfiniteCanvasSlotProps,
  consumerProps: InfiniteCanvasSlotProps = {},
): InfiniteCanvasSlotProps {
  const merged: Record<string, unknown> = { ...frameworkProps };

  for (const key of Object.keys(consumerProps)) {
    const value = consumerProps[key];

    if (isEventHandlerKey(key, value)) {
      merged[key] = composeEventHandlers(frameworkProps[key], value);
      continue;
    }

    if (value === undefined) {
      // Ignore explicit undefined values from prop spreads.
      continue;
    }

    if (key === "className") {
      // Put consumer classes first to preserve equal-specificity source order.
      merged[key] =
        typeof value === "string"
          ? [value, frameworkProps.className].filter(Boolean).join(" ")
          : frameworkProps.className;
      continue;
    }

    if (key === "style") {
      merged[key] = { ...frameworkProps.style, ...(value as CSSProperties) };
      continue;
    }

    merged[key] = value;
  }

  // Keep the framework style anchor.
  if (frameworkProps["data-slot"] !== undefined) {
    merged["data-slot"] = frameworkProps["data-slot"];
  }

  return merged as InfiniteCanvasSlotProps;
}

export { mergeInfiniteCanvasSlotProps };
export type { InfiniteCanvasSlotProps };
