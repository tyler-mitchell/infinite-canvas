import {
  getInfiniteCanvasGroupParent,
  getInfiniteCanvasWindowGroup,
  isInfiniteCanvasGroupContainer,
  useInfiniteCanvasActions,
  useInfiniteCanvasSelector,
  useInfiniteCanvasStore,
  type InfiniteCanvasCommand,
  type InfiniteCanvasGroupLayoutMode,
} from "@hyphened/infinite-canvas";
import {
  AlignHorizontalSpaceAround,
  AlignStartVertical,
  Grip,
  Pin,
  RotateCcw,
  Scan,
  Trash2,
  TriangleAlert,
  Ungroup,
  X,
} from "lucide-react";
import { Liquid } from "liquid-gooey";
import { useEffect, useRef, useState, type ComponentType, type ReactNode } from "react";
import { Button } from "ui";
import { tv } from "ui/tv";

import { useValue } from "@legendapp/state/react";
import { useLoaderData } from "@tanstack/react-router";

import { getAppAction, isAppActionEnabled } from "../app-actions";
import { undoableAction$, undoLastAction } from "../content/undoable-action";
import { FLOATING_SURFACE } from "../material";
import { openProject$ } from "../projects/open-project";
import { useGoToCanvas } from "../workspace/use-go-to-canvas";
import { useRefreshRoute } from "../workspace/use-refresh-route";
import { OffscreenIndicators } from "../canvas/offscreen-indicators";
import type { WindowKind } from "../canvas/window-registry";
import { getActionIcon } from "./action-icons";
import { CanvasContextMenu } from "./canvas-context-menu";
import { GROUP_LAYOUTS } from "./group-layouts";
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
    /** The travelling surface behind the active segment. Positioned by `style`, shaped here. */
    layoutIndicator: "pointer-events-none absolute top-0 left-0 rounded-[var(--radius-pill)]",
    /** `relative`, because the indicator above is absolutely placed against this row. */
    layoutRow: "relative flex items-center gap-0.5",
    noticeIcon: "size-3.5 shrink-0 text-[var(--danger)]",
    noticeKinds: "font-mono text-[11px] text-[var(--ink-faint)]",
    noticeRail: `flex items-center gap-2 rounded-[var(--radius-pill)] ${FLOATING_SURFACE} py-1 pr-1 pl-2.5 shadow-[var(--lift-2)]`,
    noticeText: "text-[11.5px] tracking-[-0.005em] text-[var(--ink-muted)]",
    rail: `flex items-center gap-0.5 rounded-[var(--radius-pill)] ${FLOATING_SURFACE} p-1 shadow-[var(--lift-2)]`,
    // Not `--danger` like the notice icon beside it: nothing is wrong, something is offered.
    undoIcon: "size-3.5 shrink-0 text-[var(--ink-faint)]",
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
  pressed,
  variant = "ghost",
}: Readonly<{
  disabled?: boolean;
  icon: ComponentType<Readonly<{ className?: string }>>;
  label: string;
  onPress: () => void;
  /** Set on a verb that is one of a set and can be the current one. Omitted on a plain action. */
  pressed?: boolean;
  variant?: "destructive" | "ghost";
}>) {
  return (
    <Button
      aria-label={label}
      aria-pressed={pressed}
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
  const actions = useInfiniteCanvasActions<WindowKind>();
  const store = useInfiniteCanvasStore<WindowKind>();
  // The route's own answer to which canvas this is. `openProject$` exists because no route names a
  // project; this one does, so there is nothing to publish.
  const canvas = useLoaderData({ from: "/canvas/$canvasId" });
  const projectId = useValue(openProject$) ?? "";
  const selectedCount = useInfiniteCanvasSelector((state) => state.selection.windowIds.length);
  const styles = canvasHud();
  const run = (command: InfiniteCanvasCommand) => () => {
    actions.executeCommand(command);
  };
  /*
   * The verb is in `app-actions`, not here. This is the control that calls it.
   *
   * State is peeked rather than selected: the action reads a rect that is a fresh object every
   * call, so subscribing would re-render this rail on every camera tick for something only a click
   * needs.
   */
  const groupAction = getAppAction("group.createFromSelection");
  /*
   * Whether it is offered is asked of the verb, never restated here. This button used to carry its
   * own `selectedCount < 2`, which is the same threshold `group.createFromSelection` already owns
   * and explains — two copies of one rule, the rail's copy silently wrong the moment the action's
   * changed. Peeked rather than selected for the same reason `run` peeks: the rail already
   * re-renders on selection, which is the only thing this rule reads.
   */
  // Supplied because the vocabulary now holds verbs that change canvas, and a context is one shape
  // wherever it is built. This rail offers none of them; that is the verb's business, not its own.
  const goToCanvas = useGoToCanvas();
  const refreshRoute = useRefreshRoute();
  const canGroup =
    groupAction !== undefined &&
    isAppActionEnabled(groupAction, {
      actions,
      canvasId: canvas.id,
      canvasTitle: canvas.title,
      goToCanvas,
      projectId,
      refreshRoute,
      state: store.state$.peek(),
    });
  const group = () => {
    const context = {
      actions,
      canvasId: canvas.id,
      canvasTitle: canvas.title,
      goToCanvas,
      projectId,
      refreshRoute,
      state: store.state$.peek(),
    };

    if (groupAction !== undefined && isAppActionEnabled(groupAction, context)) {
      void groupAction.run(context);
    }
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
            and moving the buttons beside it. Word and glyph both come from the verb. */}
        <Verb
          disabled={!canGroup}
          icon={getActionIcon("group.createFromSelection")}
          label={groupAction?.label ?? "Group selected"}
          onPress={group}
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
 * Which shape the container is in, said in something you can actually see.
 *
 * The active segment carried `variant="secondary"`, and measured on the live rail that paints
 * `oklch(0.205 0.009 265)` onto a pill painted `oklch(0.205 0.009 265)` — the app's `--secondary`
 * and `--surface` are the same colour, so the state was applied, correct, and invisible. Same
 * family as the header's `justify-content`: present, generated, and no visible effect.
 *
 * The indicator is liquid rather than a static pill because the control is a set of three and the
 * useful thing is watching the surface *travel* between them. `liquid-gooey`'s move effect is built
 * for exactly this — the element is moved by CSS and the liquid trails it on a spring. Screen space
 * only: it measures DOM rects in device pixels, so it must never go inside the camera transform.
 */
function LayoutSelector({
  layout,
  onSelect,
}: Readonly<{
  layout: InfiniteCanvasGroupLayoutMode | null;
  onSelect: (layout: InfiniteCanvasGroupLayoutMode) => void;
}>) {
  const rowRef = useRef<HTMLDivElement>(null);
  const styles = canvasHud();
  const [spot, setSpot] = useState<Readonly<{ height: number; width: number; x: number }> | null>(
    null,
  );

  // The three segments are the only buttons in the row, so index answers without tagging them.
  useEffect(() => {
    const row = rowRef.current;
    const active =
      row?.querySelectorAll("button")[GROUP_LAYOUTS.findIndex((entry) => entry.layout === layout)];

    if (row == null || active == null) {
      return;
    }

    const rowRect = row.getBoundingClientRect();
    const rect = active.getBoundingClientRect();

    setSpot({ height: rect.height, width: rect.width, x: rect.x - rowRect.x });
  }, [layout]);

  return (
    <Liquid className={styles.layoutRow()} fill="var(--surface-raised)" ref={rowRef}>
      {spot === null ? null : (
        <Liquid.Item effect="move" move={{ springiness: 0.55, trail: 0.5 }}>
          <div
            className={styles.layoutIndicator()}
            style={{
              height: spot.height,
              transform: `translateX(${spot.x}px)`,
              width: spot.width,
            }}
          />
        </Liquid.Item>
      )}
      {GROUP_LAYOUTS.map((entry) => (
        <Verb
          icon={entry.icon}
          key={entry.layout}
          label={entry.label}
          onPress={() => {
            onSelect(entry.layout);
          }}
          pressed={entry.layout === layout}
        />
      ))}
    </Liquid>
  );
}

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
  /*
   * Two questions, and conflating them hid the rail.
   *
   * Presence is "is the active window in a group" — when ungroup and undock mean anything. Layout
   * is the *container* holding it, a different node: a nested split inside a tabbed group is where
   * those differ, and the buttons must describe the pane the window is actually in.
   *
   * `getInfiniteCanvasGroupParent` answers `null` for a member that is the tree root — its own doc
   * says so and this keyed presence on it anyway, so grouping produced a group with no rail to
   * manage it. Watched rather than reasoned: the verb made the group, the camera fitted it, and
   * nothing appeared.
   */
  const group = useInfiniteCanvasSelector<
    WindowKind,
    Readonly<{ inGroup: boolean; layout: InfiniteCanvasGroupLayoutMode | null }>
  >((state) => {
    const windowId = state.activeWindowId;
    const tree =
      windowId === null ? undefined : getInfiniteCanvasWindowGroup(state, windowId)?.tree;

    if (tree === undefined || windowId === null) {
      return { inGroup: false, layout: null };
    }

    const container = getInfiniteCanvasGroupParent(tree, windowId);

    return {
      inGroup: true,
      layout: container?.layout ?? (isInfiniteCanvasGroupContainer(tree) ? tree.layout : null),
    };
  });
  const layout = group.layout;

  return (
    <HudSurface anchor="bottom-center-above" present={group.inGroup}>
      <div className={styles.rail()}>
        {/*
          Absent when the group has no arrangement, rather than shown with nothing selected.

          A group can hold one window — undock one member of a pair and the survivor's tree root is
          the window node itself. The framework then drops every `group.setLayout` verb from its
          contextual list; measured on a live canvas, not merely disabled but absent. This rail drew
          the selector anyway: three segments, all `aria-pressed="false"`, none of which did
          anything, and nothing on screen saying why.

          Undock and ungroup stay — both are still enabled for a lone grouped window, and both mean
          something: one frees it, the other dissolves the group around it.
        */}
        {layout === null ? null : (
          <>
            <LayoutSelector
              layout={layout}
              onSelect={(next) => {
                actions.executeCommand({ layout: next, type: "group.setLayout" });
              }}
            />
            <span className={styles.divider()} />
          </>
        )}
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
 * The last reversible thing you did, offered where you just did it.
 *
 * `undoableAction$` has existed since archiving became reversible and its only surface was a
 * palette row — so the app's whole confirmation doctrine ("no dialog, because it is reversible")
 * rested on a recovery nobody could see. Archive a note and nothing tells you it can come back;
 * you have to already know to open the palette and read the rows.
 *
 * The button's label *is* `describe`, rather than a sentence plus an "Undo". One phrasing serves
 * both surfaces — this is the palette row, shown transiently — so the two can never word one act
 * differently, which is the same rule the action's own docstring gives for carrying its inverse.
 *
 * **Transient, while the palette row stays.** Eight seconds is long enough to notice and act on and
 * short enough not to become furniture; after it, the row is still there for someone who went
 * looking. The notice is the discovery path, not the only one. Keyed on the action object, so a
 * second reversible act shows fresh rather than inheriting the first one's remaining time.
 */
function UndoNotice() {
  const action = useValue(undoableAction$);
  const [spent, setSpent] = useState(false);
  const styles = canvasHud();

  useEffect(() => {
    if (action === null) {
      return;
    }

    // Cleared here rather than held per action: the effect keys on the action, so a second
    // reversible act runs this again and shows fresh instead of inheriting the first one's clock.
    setSpent(false);

    const timer = setTimeout(() => {
      setSpent(true);
    }, 8000);

    return () => {
      clearTimeout(timer);
    };
  }, [action]);

  return (
    <HudSurface anchor="bottom-center-above" present={action !== null && !spent}>
      <div className={styles.noticeRail()} role="status">
        <RotateCcw className={styles.undoIcon()} />
        <Button
          onClick={() => {
            void undoLastAction();
          }}
          size="sm"
          variant="ghost"
        >
          {action?.describe ?? ""}
        </Button>
        <Button
          aria-label="Dismiss"
          onClick={() => {
            setSpent(true);
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
        {/* Above the selection rail rather than beside it, which is what that anchor exists for:
            neither moves when the other appears. */}
        <UndoNotice />
        {/* Opens where the pointer is, so it is not anchored like the rails above. */}
        <CanvasContextMenu />
        {/* Inside the inset root, unlike the offscreen ring: this is an ordinary corner surface,
            and it should sit inside whatever the library leaves rather than under it. */}
        {minimap}
        {/* Outside the anchored surfaces: it is a modal, not a corner. */}
        {commandPalette}
      </HudRoot>
    </>
  );
}
