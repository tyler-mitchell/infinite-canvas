import { Button } from "@base-ui/react/button";
import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { tv } from "../../tv.ts";
import { collapsibleVariants } from "../collapsible.tsx";
import {
  motion,
  useTransform,
  useMotionValueEvent,
  useReducedMotion,
  useSpring,
  type MotionValue,
} from "motion/react";
import {
  createContext,
  use,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";

export type DisclosureSpring = NonNullable<Parameters<typeof useSpring>[1]>;
const disclosure = tv({
  slots: { item: "empty:hidden", trigger: collapsibleVariants().trigger() },
});

export const DISCLOSURE_SPRINGS = {
  expand: { stiffness: 240, damping: 28, mass: 1 },
  transform: { stiffness: 230, damping: 27, mass: 1 },
  unfold: { stiffness: 250, damping: 27, mass: 1 },
} as const satisfies Record<string, DisclosureSpring>;

export interface DisclosureRootProps {
  readonly open: boolean;
  readonly onOpenChange?: (open: boolean) => void;
  readonly spring?: DisclosureSpring;
  readonly children?: ReactNode;
}

interface DisclosureState {
  readonly open: boolean;
  readonly onOpenChange: DisclosureRootProps["onOpenChange"];
  readonly progress: MotionValue<number>;
  readonly spring: DisclosureSpring;
  readonly reducedMotion: boolean;
  readonly panelId: string;
  readonly triggerRef: RefObject<HTMLElement | null>;
}

const DisclosureContext = createContext<DisclosureState | null>(null);

export function DisclosureRoot({
  open,
  onOpenChange,
  spring = DISCLOSURE_SPRINGS.expand,
  children,
}: DisclosureRootProps) {
  const reducedMotion = useReducedMotion() === true;
  const progress = useSpring(open ? 1 : 0, spring);
  const panelId = useId();
  const triggerRef = useRef<HTMLElement | null>(null);

  useLayoutEffect(() => {
    if (reducedMotion) {
      progress.jump(open ? 1 : 0);
    } else {
      progress.set(open ? 1 : 0);
    }
  }, [open, progress, reducedMotion]);

  const state = useMemo(
    () => ({ open, onOpenChange, progress, spring, reducedMotion, panelId, triggerRef }),
    [open, onOpenChange, progress, spring, reducedMotion, panelId],
  );

  return <DisclosureContext value={state}>{children}</DisclosureContext>;
}

export function useDisclosureState(): DisclosureState {
  const state = use(DisclosureContext);

  if (state === null) {
    throw new Error("Motion disclosure parts require their Root.");
  }

  return state;
}

export type DisclosureTriggerProps = Button.Props;

export function DisclosureItem({
  children,
  index,
  count,
  stagger,
  distance,
  start = 0,
}: Readonly<{
  children: ReactNode;
  index: number;
  count: number;
  stagger: number;
  distance: number;
  start?: number;
}>) {
  const { progress, reducedMotion } = useDisclosureState();
  const opacity = useTransform(progress, (value) =>
    getStaggerProgress({ progress: value, index, count, stagger, start }),
  );
  const y = useTransform(opacity, (value) => (reducedMotion ? 0 : (1 - value) * distance));
  return (
    <motion.div className={disclosure().item()} style={{ opacity, y }}>
      {children}
    </motion.div>
  );
}

/** An explicit trigger; content clicks do not change disclosure state. */
export function DisclosureTrigger({
  render,
  ref,
  disabled,
  className,
  ...props
}: DisclosureTriggerProps) {
  const { open, onOpenChange, panelId, triggerRef } = useDisclosureState();
  return useRender({
    ref: [triggerRef, ref ?? null],
    render: (
      <Button
        {...mergeProps<typeof Button>(
          {
            "aria-controls": panelId,
            "aria-expanded": open,
            onClick: () => onOpenChange?.(!open),
          },
          props,
        )}
        disabled={disabled || onOpenChange === undefined}
        className={(state) =>
          disclosure().trigger({
            className: typeof className === "function" ? className(state) : className,
          })
        }
        render={render}
      />
    ),
  });
}

/** Measured dimensions initialize directly and retarget smoothly after that. */
export function useSpringSize(value: number | undefined): MotionValue<number> {
  const { spring, reducedMotion } = useDisclosureState();
  const motionValue = useSpring(value ?? 0, spring);
  const initialized = useRef(false);

  useLayoutEffect(() => {
    if (value === undefined) {
      return;
    }

    if (!initialized.current || reducedMotion) {
      motionValue.jump(value);
      initialized.current = true;
    } else {
      motionValue.set(value);
    }
  }, [value, motionValue, reducedMotion]);

  return motionValue;
}

/** Hidden or arriving views cannot receive focus. */
export function useMotionPresence({
  progress,
  active,
  ref,
}: Readonly<{
  progress: MotionValue<number>;
  active: boolean;
  ref: RefObject<HTMLElement | null>;
}>) {
  const { triggerRef } = useDisclosureState();
  const [arrived, setArrived] = useState(progress.get() >= 0.9);
  const arrivedRef = useRef(arrived);

  useMotionValueEvent(progress, "change", (value) => {
    const next = value >= 0.9;

    if (next !== arrivedRef.current) {
      arrivedRef.current = next;
      setArrived(next);
    }
  });

  useLayoutEffect(() => {
    const element = ref.current;

    if (!active && element?.contains(element.ownerDocument.activeElement)) {
      triggerRef.current?.focus({ preventScroll: true });
    }
  }, [active, ref, triggerRef]);

  return active && arrived;
}

/** Normalized staggering lets every child finish, regardless of the count. */
export function getStaggerProgress({
  progress,
  index,
  count,
  start = 0,
  stagger = 0.1,
}: Readonly<{ progress: number; index: number; count: number; start?: number; stagger?: number }>) {
  const step = Math.min(stagger, ((1 - start) / Math.max(count, 1)) * 0.62);
  const window = 1 - start - (Math.max(count, 1) - 1) * step;

  return Math.max(0, Math.min(1, (progress - start - index * step) / window));
}
