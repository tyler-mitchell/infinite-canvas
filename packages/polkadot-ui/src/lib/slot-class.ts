import { cn } from "./cn.ts";

/**
 * Joins a `tv` slot with Base UI's `className`, which may be a function of component state.
 *
 * Base UI hands state to `className` so a consumer can vary classes on `pressed`, `open` or
 * `disabled` without writing attribute selectors. Collapsing that to a string would take the
 * affordance away, so the function form is preserved and the slot is prepended inside it.
 */
export const slotClass = <State>(
  slot: string | undefined,
  className: string | ((state: State) => string | undefined) | undefined,
) =>
  typeof className === "function"
    ? (state: State) => cn(slot, className(state))
    : cn(slot, className);

/** The same join where the slot itself varies with state, as a `pressed` or `open` variant does. */
export const stateSlotClass =
  <State>(
    slot: (state: State) => string,
    className: string | ((state: State) => string | undefined) | undefined,
  ) =>
  (state: State) =>
    cn(slot(state), typeof className === "function" ? className(state) : className);
