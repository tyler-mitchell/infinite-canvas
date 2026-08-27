import { motion } from "motion/react";
import { Button } from "ui";
import { tv } from "ui/tv";

/**
 * What the workspace looks like when there is no canvas to show yet, or never will be.
 *
 * These are full-ground surfaces rather than overlays: until a canvas is hydrated there is nothing
 * underneath for a dialog to sit on, and a spinner floating over a blank page reads as a failure
 * even when it is working. They share the workspace's own ground and type so the transition into
 * the canvas is a change of content rather than a change of application.
 */

const canvasState = tv({
  slots: {
    action: "mt-1",
    detail:
      "max-w-[46ch] text-center text-[12.5px] leading-[1.6] text-balance text-[var(--ink-faint)]",
    mark: "grid size-9 place-items-center rounded-[10px] bg-[var(--accent)] font-mono text-[15px] font-semibold text-[var(--primary-foreground)] shadow-[var(--lift-2)]",
    panel: "flex w-full max-w-[34rem] flex-col items-center gap-3.5 px-8",
    root: "grid h-dvh place-items-center bg-[var(--ground)]",
    sweep: "mt-1 h-px w-28 overflow-hidden rounded-full bg-[var(--border)]",
    sweepFill: "h-full w-1/3 rounded-full bg-[var(--accent)]",
    title: "text-[15px] font-medium tracking-[-0.012em] text-[var(--ink)]",
  },
  variants: {
    tone: {
      danger: { mark: "bg-[var(--danger)]" },
      neutral: {},
    },
  },
});

/**
 * The local database is an 11 MB WebAssembly engine, so a first run has a real wait behind it.
 * The mark breathes rather than spins: a spinner claims indeterminate progress on something that
 * usually takes under a second, and reads as slower than the wait actually is.
 */
function CanvasLoading() {
  const styles = canvasState();

  return (
    <div className={styles.root()}>
      <div className={styles.panel()}>
        <motion.div
          animate={{ opacity: [0.62, 1, 0.62], scale: [1, 1.04, 1] }}
          className={styles.mark()}
          transition={{ duration: 1.9, ease: "easeInOut", repeat: Number.POSITIVE_INFINITY }}
        >
          P
        </motion.div>
        <div className={styles.title()}>Opening your workspace</div>
        <div className={styles.sweep()}>
          <motion.div
            animate={{ x: ["-100%", "300%"] }}
            className={styles.sweepFill()}
            transition={{ duration: 1.5, ease: "easeInOut", repeat: Number.POSITIVE_INFINITY }}
          />
        </div>
      </div>
    </div>
  );
}

function CanvasFailure({
  detail,
  onRetry,
  title,
}: Readonly<{ detail: string; onRetry: () => void; title: string }>) {
  const styles = canvasState({ tone: "danger" });

  return (
    <div className={styles.root()}>
      <div className={styles.panel()}>
        <div className={styles.mark()}>!</div>
        <div className={styles.title()}>{title}</div>
        <div className={styles.detail()}>{detail}</div>
        {/*
          The one action on the screen, so it is the primary one.

          This was `variant="secondary"`, which paints `--secondary` — aliased to `--surface` — onto
          this panel's `--ground`. Measured: `rgb(21,23,27)` on `rgb(11,12,16)`, a contrast of
          1.09:1 against the 3:1 a UI boundary needs. The button was there, labelled, focusable and
          shaped like nothing. No step of the surface ramp fixes it either — raised reaches 1.18 and
          hover 1.29 — because those surfaces are meant to read through shadow and an inset ring,
          which a bare secondary Button has neither of.

          The accent reads 9.36:1 on the same ground, and is what this control actually is: when a
          canvas has failed to open, trying again is not a secondary option.
        */}
        <div className={styles.action()}>
          <Button onClick={onRetry} size="sm">
            Try again
          </Button>
        </div>
      </div>
    </div>
  );
}

export { CanvasFailure, CanvasLoading };
