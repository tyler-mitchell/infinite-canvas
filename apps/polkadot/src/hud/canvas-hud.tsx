import {
  useInfiniteCanvasActions,
  useInfiniteCanvasSelector,
  type InfiniteCanvasCommand,
} from "@hyphened/infinite-canvas";
import {
  AlignHorizontalSpaceAround,
  AlignStartVertical,
  Pin,
  Scan,
  Trash2,
  TriangleAlert,
  X,
} from "lucide-react";
import { useState, type ComponentType, type ReactNode } from "react";
import { Button } from "ui";
import { tv } from "ui/tv";

import { HudRoot, HudSurface } from "./hud-surfaces";

/**
 * The HUD surfaces the framework does not already provide.
 *
 * The framework's own HUD supplies zoom, camera navigation, the minimized dock, the status card,
 * and pointer-mode switching — each with enablement, keyboard reachability, and a live announcer
 * already attached. They are enabled through the `hud` policy and themed with the `--icx-hud-*`
 * tokens, and they are **not** reimplemented here. An earlier version of this file rebuilt the
 * zoom and camera rails from scratch; both versions then rendered side by side on the canvas,
 * which is what that mistake looks like from the outside.
 *
 * What is left is the one surface the framework has no opinion about, because it is a product
 * decision rather than a canvas one: what a person does with several notes at once.
 *
 * Placement is identity top-left, selection verbs bottom-centre, framework navigation bottom-right
 * where it puts itself. The selection rail is fixed rather than following the selection — a rail
 * that chases occludes the canvas beside the thing just selected, which is where the eye goes next.
 */

const canvasHud = tv({
  slots: {
    count: "px-1.5 font-mono text-[11px] tracking-[0.02em] text-[var(--ink-faint)] tabular-nums",
    divider: "mx-0.5 h-4 w-px bg-[var(--border)]",
    noticeIcon: "size-3.5 shrink-0 text-[var(--danger)]",
    noticeKinds: "font-mono text-[11px] text-[var(--ink-faint)]",
    noticeRail:
      "flex items-center gap-2 rounded-[var(--radius-pill)] bg-[var(--surface)] py-1 pr-1 pl-2.5 shadow-[var(--lift-2)] inset-ring-1 inset-ring-[var(--edge-light)] backdrop-blur-2xl",
    noticeText: "text-[11.5px] tracking-[-0.005em] text-[var(--ink-muted)]",
    rail: "flex items-center gap-0.5 rounded-[var(--radius-pill)] bg-[var(--surface)] p-1 shadow-[var(--lift-2)] inset-ring-1 inset-ring-[var(--edge-light)] backdrop-blur-2xl",
  },
});

/**
 * A verb in the selection rail.
 *
 * `ui`'s Button already carries the variants, focus ring, disabled handling, and icon sizing —
 * it is Base UI underneath — so this adds only what is specific to living on a canvas: an
 * accessible name that doubles as the tooltip, because a rail of unlabelled glyphs is the failure
 * mode of every canvas tool, and stopping `pointerdown` from reaching the canvas root, which would
 * otherwise start a marquee underneath the control being pressed.
 */
function Verb({
  disabled = false,
  icon: Icon,
  label,
  onPress,
  variant = "ghost",
}: Readonly<{
  disabled?: boolean;
  icon: ComponentType<Readonly<{ className?: string }>>;
  label: string;
  onPress: () => void;
  variant?: "destructive" | "ghost";
}>) {
  return (
    <Button
      aria-label={label}
      disabled={disabled}
      onClick={onPress}
      onPointerDown={(event) => {
        event.stopPropagation();
      }}
      size="icon-sm"
      title={label}
      variant={variant}
    >
      <Icon />
    </Button>
  );
}

/**
 * Two windows is where spatial verbs start meaning anything: aligning one is a no-op, and
 * distributing fewer than three is the same as aligning. The framework refuses both already, so
 * these stay visible and dim rather than appearing and disappearing as a selection grows — a rail
 * whose buttons move is harder to aim at than one whose buttons grey.
 */
function SelectionRail() {
  const actions = useInfiniteCanvasActions();
  const selectedCount = useInfiniteCanvasSelector((state) => state.selection.windowIds.length);
  const styles = canvasHud();
  const run = (command: InfiniteCanvasCommand) => () => {
    actions.executeCommand(command);
  };

  return (
    <HudSurface anchor="bottom-center" present={selectedCount > 0}>
      <div className={styles.rail()}>
        <span className={styles.count()}>{selectedCount}</span>
        <Verb
          disabled={selectedCount < 2}
          icon={AlignStartVertical}
          label="Align left"
          onPress={run({ alignment: "left", type: "window.align" })}
        />
        <Verb
          disabled={selectedCount < 3}
          icon={AlignHorizontalSpaceAround}
          label="Distribute horizontally"
          onPress={run({ distribution: "horizontal", type: "window.distribute" })}
        />
        <span className={styles.divider()} />
        <Verb icon={Pin} label="Pin or unpin" onPress={run({ type: "selection.togglePinned" })} />
        <Verb icon={Scan} label="Fit selection" onPress={run({ type: "view.fitSelection" })} />
        <span className={styles.divider()} />
        <Verb
          icon={Trash2}
          label="Close selected"
          onPress={run({ type: "selection.close" })}
          variant="destructive"
        />
      </div>
    </HudSurface>
  );
}

/**
 * What was left behind when this canvas opened.
 *
 * A layout can name a window kind this build does not register — a canvas saved by a newer
 * version, or one whose kind was removed. The framework drops those and keeps everything else, so
 * the canvas opens normally; without a notice the loss would be silent and read as data missing.
 *
 * Dismissible, because it describes something that already happened and cannot be acted on here.
 */
function RecoveryNotice({ droppedKinds }: Readonly<{ droppedKinds: readonly string[] }>) {
  const [dismissed, setDismissed] = useState(false);
  const styles = canvasHud();

  return (
    <HudSurface anchor="top-right" present={droppedKinds.length > 0 && !dismissed}>
      <div className={styles.noticeRail()} role="status">
        <TriangleAlert className={styles.noticeIcon()} />
        <span className={styles.noticeText()}>
          {droppedKinds.length === 1 ? "One window kind" : `${droppedKinds.length} window kinds`}{" "}
          could not be opened:
        </span>
        <span className={styles.noticeKinds()}>{droppedKinds.join(", ")}</span>
        <Button
          aria-label="Dismiss"
          onClick={() => {
            setDismissed(true);
          }}
          size="icon-sm"
          title="Dismiss"
          variant="ghost"
        >
          <X />
        </Button>
      </div>
    </HudSurface>
  );
}

export function CanvasHud({
  droppedKinds,
  identity,
}: Readonly<{ droppedKinds?: readonly string[]; identity: ReactNode }>) {
  return (
    <HudRoot>
      <HudSurface anchor="top-left" persistent>
        {identity}
      </HudSurface>
      {droppedKinds === undefined ? null : <RecoveryNotice droppedKinds={droppedKinds} />}
      <SelectionRail />
    </HudRoot>
  );
}
