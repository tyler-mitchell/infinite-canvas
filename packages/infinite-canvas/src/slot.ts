import type { CSSProperties } from "react";

/**
 * Prop merging for frame slots — the thing that makes a slot headless rather than merely
 * unstyled.
 *
 * **The distinction this module exists for.** A framework is *unstyled* when it ships no colours;
 * it is *headless* when the consumer owns the element. This one was the former and called itself
 * the latter. Every frame slot accepted exactly `children`, `className`, and `style`, so a
 * consumer could recolour a header but could not put an `id` on it, attach an `onFocus`, hang a
 * `ref` off it to measure or anchor to, give it an `aria-describedby`, or render it as anything
 * but the `<header>` the framework chose. Base UI, Radix, and Downshift all treat that last one
 * as the defining capability, and it was the one thing the API had no answer for.
 *
 * ### Provenance
 *
 * The merge semantics below are **transplanted from Base UI's `mergeProps`** (MIT, Copyright (c)
 * 2019 Material-UI SAS), not invented here. `@base-ui/react` is already in this workspace, but
 * `packages/infinite-canvas` does not depend on it and should not start: importing
 * `@base-ui/react/merge-props` pulls `@base-ui/utils` behind it, and this package advertises a
 * ~40 KB gzipped floor with React as its only required peer. Copying ~40 lines is the honest
 * trade against a dependency edge for one function.
 *
 * The first draft of this file hand-rolled the same idea and got the most important rule
 * backwards, which is the argument for transplanting rather than improvising:
 *
 * - It ran the **framework's** handler first and the consumer's second, so a consumer could only
 *   observe the framework's behaviour, never decline it — `preventDefault` was the suggested
 *   escape, which conflates "do not do the browser's default" with "do not do the library's".
 * - Base UI runs the **consumer's** handler first and gives it
 *   `event.preventInfiniteCanvasHandler()`, an explicit opt-out that says exactly what it does
 *   and leaves `preventDefault` meaning what the DOM says it means.
 *
 * One rule is ours and has no Base UI equivalent: **`data-slot` is framework-owned.** It is the
 * styling contract's only anchor, so a consumer who set it would silently detach the stylesheet
 * from the element while everything still looked wired.
 */

type InfiniteCanvasSlotEvent = Readonly<{
  infiniteCanvasHandlerPrevented?: boolean;
  preventInfiniteCanvasHandler?: () => void;
}>;

type InfiniteCanvasSlotProps = Record<string, unknown> &
  Readonly<{
    className?: string;
    style?: CSSProperties;
  }>;

/** Base UI's charCode test: `on` followed by an uppercase letter. Cheaper than a regex. */
const isEventHandlerKey = (key: string, value: unknown): boolean =>
  key.charCodeAt(0) === 111 &&
  key.charCodeAt(1) === 110 &&
  key.charCodeAt(2) >= 65 &&
  key.charCodeAt(2) <= 90 &&
  (typeof value === "function" || value === undefined);

/** A React synthetic event, which is the only kind that can carry the opt-out flag. */
const isSyntheticEvent = (value: unknown): value is InfiniteCanvasSlotEvent =>
  typeof value === "object" && value !== null && "nativeEvent" in value;

/**
 * Compose a consumer handler with the framework's.
 *
 * The consumer's runs first. The framework's runs after it unless the consumer called
 * `preventInfiniteCanvasHandler()`, which is the only supported way to decline built-in
 * behaviour — dragging a window, focusing it, trapping Tab — without also suppressing the
 * browser's own default for that event.
 */
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

/**
 * Merge framework-owned slot props with consumer-supplied ones, consumer taking precedence
 * except where composition is the only sane answer.
 */
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
      // Spreading `{...rest}` hands through explicit undefineds for every prop the consumer did
      // not pass; treating those as overrides would blank framework values at random.
      continue;
    }

    if (key === "className") {
      // Consumer classes first, matching Base UI, so a consumer's later-defined rule of equal
      // specificity wins on source order. Anything that is not a string is a consumer bug and is
      // dropped rather than stringified, because `[object Object]` in a class list is invisible.
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

  // Ours, not Base UI's: the styling contract's anchor survives whatever the consumer passed.
  if (frameworkProps["data-slot"] !== undefined) {
    merged["data-slot"] = frameworkProps["data-slot"];
  }

  return merged as InfiniteCanvasSlotProps;
}

export { mergeInfiniteCanvasSlotProps };
export type { InfiniteCanvasSlotProps };
