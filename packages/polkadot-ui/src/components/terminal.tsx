import type { VariantProps } from "tailwind-variants";

import { tv } from "../tv.ts";

const terminal = tv({
  slots: {
    root: "flex w-full flex-col gap-1 overflow-x-auto font-pk-mono text-pk-mono",
    command: "flex gap-2 whitespace-pre",
    prompt: "flex-none text-pk-ink-faint select-none",
    text: "text-pk-ink-muted",
    output: "whitespace-pre text-pk-ink-faint",
    caret: "ml-px inline-block w-[7px] animate-pk-caret bg-pk-accent text-transparent select-none",
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

/**
 * A log, composed of parts rather than given lines: `Terminal.Command` prints a prompt and
 * `Terminal.Output` prints a result, optionally with a caret for the line still being written.
 */
function Terminal({ className, ...props }: TerminalProps) {
  return (
    <div data-slot="terminal" role="log" className={terminal().root({ className })} {...props} />
  );
}

export type TerminalCommandProps = React.ComponentProps<"div"> & VariantProps<typeof terminal>;

function TerminalCommand({ running, children, className, ...props }: TerminalCommandProps) {
  const styles = terminal({ running });

  return (
    <div data-slot="terminal-command" className={styles.command({ className })} {...props}>
      <span aria-hidden className={styles.prompt()}>
        $
      </span>
      <span className={styles.text()}>{children}</span>
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
