import {
  getInfiniteCanvasGroupParent,
  getInfiniteCanvasWindowGroup,
  getSelectedWindowBounds,
  useInfiniteCanvasActions,
  useInfiniteCanvasSelector,
  useInfiniteCanvasStore,
  type InfiniteCanvasCommand,
  type InfiniteCanvasGroupLayoutMode,
} from "@hyphened/infinite-canvas";
import {
  AlignHorizontalSpaceAround,
  AlignStartVertical,
  Columns2,
  Grip,
  Pin,
  Rows3,
  Scan,
  SquareSplitHorizontal,
  Trash2,
  TriangleAlert,
  Ungroup,
  X,
} from "lucide-react";
import { useState, type ComponentType, type ReactNode } from "react";
import { Button } from "ui";
import { tv } from "ui/tv";

import { OffscreenIndicators } from "../canvas/offscreen-indicators";
import type { WindowKind } from "../canvas/window-registry";
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
  variant?: "destructive" | "ghost" | "secondary";
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
  const store = useInfiniteCanvasStore();
  const selectedCount = useInfiniteCanvasSelector((state) => state.selection.windowIds.length);
  const styles = canvasHud();
  const run = (command: InfiniteCanvasCommand) => () => {
    actions.executeCommand(command);
  };
  /*
   * The only thing in the app that invites docking.
   *
   * The framework has had the whole group model since before this app had a second window kind —
   * the Alt-drag gesture, the palette's dock commands, tabs and splits — and Polkadot never offered
   * a way in. A capability reachable only by a modifier nobody presses speculatively, or a palette
   * row nobody searches for, is a capability nobody has.
   *
   * Read from a peek rather than a selector: the bounds are a fresh object every call, so selecting
   * them would re-render this rail on every camera tick to compute a rect only a click needs.
   */
  const group = () => {
    const state = store.state$.peek();
    const rect = getSelectedWindowBounds(state);

    if (rect === null) {
      return;
    }

    actions.createGroup({
      groupId: globalThis.crypto.randomUUID(),
      rect,
      windowIds: state.selection.windowIds,
    });
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
        {/* Same rule as the spatial verbs above: visible and dim below two, rather than appearing
            and moving the buttons beside it. */}
        <Verb disabled={selectedCount < 2} icon={Columns2} label="Group selected" onPress={group} />
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

/** The three shapes a container can take, in the order they escalate: apart, stacked, one at a time. */
const GROUP_LAYOUTS = [
  { icon: SquareSplitHorizontal, label: "Side by side", layout: "split" },
  { icon: Rows3, label: "Folded", layout: "accordion" },
  { icon: Columns2, label: "Tabbed", layout: "tabs" },
] as const satisfies readonly Readonly<{
  icon: ComponentType<Readonly<{ className?: string }>>;
  label: string;
  layout: InfiniteCanvasGroupLayoutMode;
}>[];

/**
 * What a person does with a group once they have one.
 *
 * Creating a group was the discoverability gap; this is the rest of it. A group could be made and
 * then never reshaped or taken apart from the app — the verbs existed as palette rows nobody
 * searches for. Layout is a segmented choice rather than a toggle because there are three shapes,
 * and showing which one is live is most of what the control is for.
 *
 * Sits above the selection rail rather than beside it: both are about the active thing, and a rail
 * that grows sideways as state changes moves the buttons already under the pointer.
 */
function GroupRail() {
  const actions = useInfiniteCanvasActions();
  const styles = canvasHud();
  // The container's own layout, not the group's — a nested split inside a tabbed group is the case
  // where those differ, and the buttons must describe the pane the active window is actually in.
  const layout = useInfiniteCanvasSelector<WindowKind, InfiniteCanvasGroupLayoutMode | null>(
    (state) => {
      const tree =
        state.activeWindowId === null
          ? undefined
          : getInfiniteCanvasWindowGroup(state, state.activeWindowId)?.tree;

      return tree === undefined || state.activeWindowId === null
        ? null
        : (getInfiniteCanvasGroupParent(tree, state.activeWindowId)?.layout ?? null);
    },
  );

  return (
    <HudSurface anchor="bottom-center-above" present={layout !== null}>
      <div className={styles.rail()}>
        {GROUP_LAYOUTS.map((entry) => (
          <Verb
            icon={entry.icon}
            key={entry.layout}
            label={entry.label}
            onPress={() => {
              actions.executeCommand({ layout: entry.layout, type: "group.setLayout" });
            }}
            variant={entry.layout === layout ? "secondary" : "ghost"}
          />
        ))}
        <span className={styles.divider()} />
        <Verb
          icon={Grip}
          label="Undock this window"
          onPress={() => {
            actions.executeCommand({ type: "window.undock" });
          }}
        />
        <Verb
          icon={Ungroup}
          label="Ungroup"
          onPress={() => {
            actions.executeCommand({ type: "group.dissolve" });
          }}
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
  commandPalette,
  conflict,
  droppedKinds,
  identity,
  library,
  libraryInset = 0,
  minimap,
}: Readonly<{
  commandPalette?: ReactNode;
  /**
   * The canvas has stopped saving and needs a decision. Takes the top-right corner outright when
   * present: it and the recovery notice both live there, and stacking two warnings would put the
   * one that is merely historical over the one that is still true.
   */
  conflict?: ReactNode;
  droppedKinds?: readonly string[];
  identity: ReactNode;
  library?: ReactNode;
  libraryInset?: number;
  minimap?: ReactNode;
}>) {
  return (
    <>
      {/*
        Outside the inset root, because it *is* the inset.

        Persistent, unlike every other surface: the HUD's rule is that chrome recedes while the
        pointer is down, since a rail hovering over the window you are dragging occludes the thing
        you are positioning. The library is the exception that proves it — the canvas has reserved
        its space, so it is over nothing, and fading it would make the reserved gap read as a bug
        rather than as a panel.
      */}
      {library === undefined || library === null ? null : (
        <HudRoot>
          <HudSurface anchor="left" persistent>
            {library}
          </HudSurface>
        </HudRoot>
      )}
      {/*
        Not inside the inset root: the framework already projects these onto a ring that respects
        the insets, and the points it returns are in the canvas element's own screen space. Putting
        them in a shifted box would move them a second time.
      */}
      <OffscreenIndicators />
      <HudRoot insetLeft={libraryInset}>
        <HudSurface anchor="top-left" persistent>
          {identity}
        </HudSurface>
        {conflict === undefined || conflict === null ? (
          droppedKinds === undefined ? null : (
            <RecoveryNotice droppedKinds={droppedKinds} />
          )
        ) : (
          <HudSurface anchor="top-right" persistent present>
            {conflict}
          </HudSurface>
        )}
        <GroupRail />
        <SelectionRail />
        {/* Inside the inset root, unlike the offscreen ring: this is an ordinary corner surface,
            and it should sit inside whatever the library leaves rather than under it. */}
        {minimap}
        {/* Outside the anchored surfaces: it is a modal, not a corner. */}
        {commandPalette}
      </HudRoot>
    </>
  );
}
