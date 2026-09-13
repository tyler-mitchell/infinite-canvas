import type { VariantProps } from "tailwind-variants";

import { tv } from "../tv.ts";

const terminal = tv({
  slots: {
    root: "flex w-full min-w-0 flex-col gap-1.5 overflow-x-auto font-pk-mono text-pk-mono outline-none select-text focus-visible:inset-ring-2 focus-visible:inset-ring-pk-accent/50",
    command: "flex gap-2 whitespace-pre",
    prompt: "flex-none text-pk-ink-faint select-none",
    text: "text-pk-ink-muted",
    output: "whitespace-pre text-pk-ink-faint",
    caret: "ml-px inline-block w-[7px] animate-pk-caret bg-pk-accent text-transparent select-none",
    /* The accent is the whole of what a running command looks like, so it is said as well. */
    state: "sr-only",
  },
  variants: {
    running: {
      true: { text: "text-pk-accent", prompt: "text-pk-accent/60" },
      false: {},
    },
  },
  defaultVariants: { running: false },
});

export type TerminalProps = React.ComponentProps<"div">;

/** A log composed of commands and output. */
function Terminal({ className, ...props }: TerminalProps) {
  return (
    <div
      data-slot="terminal"
      role="log"
      aria-label="Terminal output"
      tabIndex={0}
      className={terminal().root({ className })}
      {...props}
    />
  );
}

export type TerminalCommandProps = React.ComponentProps<"div"> &
  VariantProps<typeof terminal> & {
    /** A decorative prompt. Set null to omit it. */
    readonly prompt?: React.ReactNode;
    readonly runningLabel?: string;
  };

function TerminalCommand({
  running,
  prompt = "$",
  runningLabel = "running",
  children,
  className,
  ...props
}: TerminalCommandProps) {
  const styles = terminal({ running });

  return (
    <div data-slot="terminal-command" className={styles.command({ className })} {...props}>
      {prompt == null || typeof prompt === "boolean" ? null : (
        <span aria-hidden className={styles.prompt()}>
          {prompt}
        </span>
      )}
      <span className={styles.text()}>{children}</span>
      {running ? <span className={styles.state()}>{runningLabel}</span> : null}
    </div>
  );
}

export type TerminalOutputProps = React.ComponentProps<"div"> & {
  /** Puts a blinking block after the text, for the line the log is still writing. */
  readonly caret?: boolean;
};

function TerminalOutput({ caret, children, className, ...props }: TerminalOutputProps) {
  const styles = terminal();

  return (
    <div data-slot="terminal-output" className={styles.output({ className })} {...props}>
      {children}
      {caret ? (
        <span aria-hidden className={styles.caret()}>
          {" "}
        </span>
      ) : null}
    </div>
  );
}

Terminal.Command = TerminalCommand;
Terminal.Output = TerminalOutput;

export { Terminal, TerminalCommand, TerminalOutput, terminal as terminalVariants };
