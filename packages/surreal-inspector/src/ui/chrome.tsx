import type { ReactNode } from "react";
import { tv } from "ui/tv";

/**
 * Shared building blocks for the panels. Styled with shadcn tokens (`bg-card`,
 * `text-muted-foreground`) rather than fixed colours, so the host's theme applies.
 */

const chrome = tv({
  slots: {
    code: "overflow-x-auto rounded-md bg-black/25 px-2.5 py-2 font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-foreground/85",
    empty: "px-3 py-10 text-center text-[12px] text-muted-foreground",
    notice: "rounded-md px-2.5 py-2 text-[12px] leading-relaxed",
    panel: "flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain p-4",
    section: "flex flex-col gap-2",
    sectionBody: "flex flex-col gap-1.5",
    sectionHint: "text-[11px] leading-relaxed text-muted-foreground",
    sectionTitle: "text-[12px] font-medium tracking-[-0.005em] text-foreground/80",
    stat: "flex min-w-0 flex-col gap-0.5 rounded-lg bg-card px-3 py-2",
    statLabel: "truncate text-[10px] tracking-wide text-muted-foreground uppercase",
    statNote: "truncate text-[10px] text-muted-foreground",
    statRow: "grid gap-1.5 [grid-template-columns:repeat(auto-fit,minmax(140px,1fr))]",
    statValue: "truncate font-mono text-[15px] tabular-nums text-foreground",
  },
  variants: {
    tone: {
      danger: { notice: "bg-destructive/12 text-destructive" },
      neutral: { notice: "bg-card text-muted-foreground" },
      positive: { notice: "bg-primary/10 text-foreground/85" },
    },
  },
  defaultVariants: { tone: "neutral" },
});

const styles = chrome();

function Panel({ children }: Readonly<{ children: ReactNode }>) {
  return <div className={styles.panel()}>{children}</div>;
}

function Section({
  children,
  hint,
  title,
}: Readonly<{ children: ReactNode; hint?: string; title: string }>) {
  return (
    <section className={styles.section()}>
      <h3 className={styles.sectionTitle()}>{title}</h3>
      {hint === undefined ? null : <p className={styles.sectionHint()}>{hint}</p>}
      <div className={styles.sectionBody()}>{children}</div>
    </section>
  );
}

/**
 * A measured value with an optional note. Many figures here are approximate — origin-wide storage,
 * sampled byte counts — and the note says which, so a bare number is not read as exact.
 */
function Stat({
  label,
  note,
  value,
}: Readonly<{ label: string; note?: string; value: ReactNode }>) {
  return (
    <div className={styles.stat()}>
      <span className={styles.statLabel()}>{label}</span>
      <span className={styles.statValue()}>{value}</span>
      {note === undefined ? null : <span className={styles.statNote()}>{note}</span>}
    </div>
  );
}

function StatRow({ children }: Readonly<{ children: ReactNode }>) {
  return <div className={styles.statRow()}>{children}</div>;
}

function Notice({
  children,
  tone = "neutral",
}: Readonly<{ children: ReactNode; tone?: "danger" | "neutral" | "positive" }>) {
  return <p className={chrome({ tone }).notice()}>{children}</p>;
}

function Empty({ children }: Readonly<{ children: ReactNode }>) {
  return <p className={styles.empty()}>{children}</p>;
}

function Code({ children }: Readonly<{ children: ReactNode }>) {
  return <pre className={styles.code()}>{children}</pre>;
}

export { Code, Empty, Notice, Panel, Section, Stat, StatRow };
