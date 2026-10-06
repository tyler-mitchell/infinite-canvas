import { Button } from "@base-ui/react/button";
import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import type { Observable } from "@legendapp/state";
import { useObservable, useValue } from "@legendapp/state/react";
import { useMeasure } from "@legendapp/state/react-hooks/useMeasure";
import { motion, useReducedMotion } from "motion/react";
import { createContext, use, useId, useMemo, useRef, type ReactNode } from "react";
import { buttonVariants } from "./button.tsx";
import { tv } from "../tv.ts";

type Phase = "idle" | "printing" | "retracting" | "ready";
export type PrinterProps = useRender.ComponentProps<"div"> &
  Readonly<{
    printed: boolean;
    onPrintedChange: (printed: boolean) => void;
    feedDuration?: number;
    retractDuration?: number;
  }>;
type PrinterState = Pick<PrinterProps, "printed" | "onPrintedChange"> & {
  phase$: Observable<Phase>;
  panelId: string;
  feedDuration: number;
  retractDuration: number;
};
const Context = createContext<PrinterState | null>(null);
const printer = tv({
  slots: {
    root: "relative isolate min-w-0",
    machine: "relative z-20 rounded-pk-inner border border-pk-line bg-pk-surface",
    mouth:
      "pointer-events-none absolute inset-x-3 bottom-0 h-(--pk-printer-mouth-height) translate-y-1/2 rounded-pk-pill bg-pk-scrim shadow-inner",
    feed: "relative z-10 -mt-[calc(var(--pk-printer-mouth-height)/2)] overflow-hidden px-3",
    paper: "min-w-0 pb-3",
    status: "font-pk-sans text-pk-label text-pk-ink-dim",
  },
});

function usePrinter() {
  const context = use(Context);
  if (context === null) throw new Error("Printer parts require their Printer root.");
  return context;
}

function Printer({
  printed,
  onPrintedChange,
  feedDuration = 1.75,
  retractDuration = 0.6,
  className,
  render,
  children,
  ...props
}: PrinterProps) {
  const phase$ = useObservable<Phase>(printed ? "ready" : "idle");
  const panelId = useId();
  const value = useMemo(
    () => ({ printed, onPrintedChange, phase$, panelId, feedDuration, retractDuration }),
    [printed, onPrintedChange, phase$, panelId, feedDuration, retractDuration],
  );
  const element = useRender({
    defaultTagName: "div",
    render,
    props: { ...props, children, "data-slot": "printer", className: printer().root({ className }) },
  });
  return <Context value={value}>{element}</Context>;
}

export type PrinterMachineProps = useRender.ComponentProps<"div">;
function PrinterMachine({ className, render, ...props }: PrinterMachineProps) {
  return useRender({
    defaultTagName: "div",
    render,
    props: {
      ...props,
      "data-slot": "printer-machine",
      className: printer().machine({ className }),
    },
  });
}
function PrinterMouth({ className, render, ...props }: PrinterMachineProps) {
  return useRender({
    defaultTagName: "div",
    render,
    props: {
      ...props,
      "aria-hidden": true,
      "data-slot": "printer-mouth",
      className: printer().mouth({ className }),
    },
  });
}

export type PrinterFeedProps = useRender.ComponentProps<"div">;
function PrinterFeed({ children, className, render, ref, style, ...props }: PrinterFeedProps) {
  const { printed, phase$, panelId, feedDuration, retractDuration } = usePrinter();
  const phase = useValue(phase$);
  const reducedMotion = useReducedMotion();
  const paperRef = useRef<HTMLDivElement | null>(null);
  const size$ = useMeasure(paperRef as Parameters<typeof useMeasure>[0]);
  const height = useValue(size$.height) ?? 0;
  const feedHeight = printed || phase !== "idle" ? height : 0;
  return useRender({
    defaultTagName: "div",
    render,
    ref,
    props: {
      ...props,
      id: panelId,
      "data-slot": "printer-feed",
      className: printer().feed({ className }),
      style: { ...style, height: feedHeight },
      children: (
        <motion.div
          ref={paperRef}
          className={printer().paper()}
          initial={false}
          animate={{ y: printed ? "0%" : "-100%" }}
          transition={{
            duration: reducedMotion ? 0 : printed ? feedDuration : retractDuration,
            ease: [0.77, 0, 0.175, 1],
          }}
          onAnimationStart={() => phase$.set(printed ? "printing" : "retracting")}
          onAnimationComplete={() => phase$.set(printed ? "ready" : "idle")}
          inert={!printed || phase !== "ready"}
          aria-hidden={!printed || phase !== "ready"}
        >
          {children}
        </motion.div>
      ),
    },
  });
}

export type PrinterTriggerProps = Omit<Button.Props, "className"> & { className?: string };
function PrinterTrigger({ className, ...props }: PrinterTriggerProps) {
  const { printed, onPrintedChange, panelId } = usePrinter();
  return (
    <Button
      className={buttonVariants({ tone: "ghost", size: "sm", className })}
      {...mergeProps<typeof Button>(
        {
          "aria-expanded": printed,
          "aria-controls": panelId,
          children: printed ? "Retract" : "Print",
          onClick: () => onPrintedChange(!printed),
        },
        props,
      )}
    />
  );
}

export type PrinterStatusProps = useRender.ComponentProps<"span"> & {
  labels?: Readonly<Record<Phase, ReactNode>>;
};
function PrinterStatus({
  className,
  render,
  labels = { idle: "Ready", printing: "Printing", retracting: "Retracting", ready: "Paper ready" },
  ...props
}: PrinterStatusProps) {
  const { phase$ } = usePrinter();
  const phase = useValue(phase$);
  return useRender({
    defaultTagName: "span",
    render,
    props: {
      ...props,
      role: "status",
      children: labels[phase],
      "data-slot": "printer-status",
      className: printer().status({ className }),
    },
  });
}

Printer.Machine = PrinterMachine;
Printer.Mouth = PrinterMouth;
Printer.Feed = PrinterFeed;
Printer.Trigger = PrinterTrigger;
Printer.Status = PrinterStatus;
export {
  Printer,
  PrinterMachine,
  PrinterMouth,
  PrinterFeed,
  PrinterTrigger,
  PrinterStatus,
  printer as printerVariants,
};
