import {
  getInfiniteCanvasGroupParent,
  getInfiniteCanvasWindowGroup,
  isInfiniteCanvasGroupContainer,
  useInfiniteCanvasActions,
  useInfiniteCanvasAnnounce,
  useInfiniteCanvasState,
  useInfiniteCanvasSelector,
  useInfiniteCanvasStore,
  type InfiniteCanvasCommand,
  type InfiniteCanvasGroupLayoutMode,
} from "@hyphened/infinite-canvas";
import {
  AlignHorizontalSpaceAround,
  AlignStartVertical,
  Grip,
  LayoutGrid,
  Pin,
  RotateCcw,
  Scan,
  Trash2,
  TriangleAlert,
  Ungroup,
  Unlink2,
  X,
} from "lucide-react";
import { Liquid } from "liquid-gooey";
import { useEffect, useRef, useState, type ComponentType, type ReactNode } from "react";
import { Button } from "ui";
import { tv } from "ui/tv";

import { useValue } from "@legendapp/state/react";

import { getSelectedRelations } from "../canvas/connector-geometry";
import { actionFailure$, watchForUnhandledRejections } from "../content/action-failure";
import { disconnectRelations, relations$ } from "../relations/relation-store";
import { useLoaderData } from "@tanstack/react-router";

import { getAppAction, isAppActionEnabled } from "../app-actions";
import { undoableAction$, undoLastAction } from "../content/undoable-action";
import { FLOATING_SURFACE } from "../material";
import { useGoToCanvas } from "../workspace/use-go-to-canvas";
import { useRefreshRoute } from "../workspace/use-refresh-route";
import { OffscreenIndicators } from "../canvas/offscreen-indicators";
import type { WindowKind } from "../canvas/window-registry";
import { getActionIcon } from "./action-icons";
import { CanvasContextMenu } from "./canvas-context-menu";
import { GROUP_LAYOUTS } from "./group-layouts";
import { HudRoot, HudSurface } from "./hud-surfaces";

const canvasHud = tv({
  slots: {
    count: "px-1.5 font-mono text-[11px] tracking-[0.02em] text-[var(--ink-faint)] tabular-nums",
    divider: "mx-0.5 h-4 w-px bg-[var(--border)]",
    layoutIndicator: "pointer-events-none absolute top-0 left-0 rounded-[var(--radius-pill)]",
    layoutRow: "relative flex items-center gap-0.5",
    noticeIcon: "size-3.5 shrink-0 text-[var(--danger)]",
    noticeKinds: "font-mono text-[11px] text-[var(--ink-faint)]",
    noticeRail: `flex items-center gap-2 rounded-[var(--radius-pill)] ${FLOATING_SURFACE} py-1 pr-1 pl-2.5 shadow-[var(--lift-2)]`,
    noticeText: "text-[11.5px] tracking-[-0.005em] text-[var(--ink-muted)]",
    rail: `flex items-center gap-0.5 rounded-[var(--radius-pill)] ${FLOATING_SURFACE} p-1 shadow-[var(--lift-2)]`,
    undoIcon: "size-3.5 shrink-0 text-[var(--ink-faint)]",
  },
});

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

/** Matches the canvas gutter, so packed windows read as one block rather than a sheet. */
const SELECTION_PACK_GAP_PX = 16;

function SelectionRail() {
  const actions = useInfiniteCanvasActions<WindowKind>();
  const store = useInfiniteCanvasStore<WindowKind>();
  const canvas = useLoaderData({ from: "/canvas/$canvasId" });
  const projectId = canvas.projectId;
  const selectedCount = useInfiniteCanvasSelector((state) => state.selection.windowIds.length);
  const styles = canvasHud();
  const run = (command: InfiniteCanvasCommand) => () => {
    actions.executeCommand(command);
  };
  const groupAction = getAppAction("group.createFromSelection");
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
        <Verb
          disabled={selectedCount < 2}
          icon={LayoutGrid}
          label="Pack into rows"
          // The packer itself leaves no gap. A workbench wants the windows to breathe.
          onPress={run({ gapPx: SELECTION_PACK_GAP_PX, type: "window.pack" })}
        />
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

function ConnectorRail() {
  const state = useInfiniteCanvasState<WindowKind>();
  const relations = useValue(relations$);
  const { projectId } = useLoaderData({ from: "/canvas/$canvasId" });
  const styles = canvasHud();
  const selected = getSelectedRelations(state.selection, relations);

  return (
    <HudSurface anchor="bottom-center" present={selected.length > 0}>
      <div className={styles.rail()}>
        <span className={styles.count()}>{selected.length}</span>
        <Verb
          icon={Unlink2}
          label={selected.length === 1 ? "Cut connection" : "Cut connections"}
          onPress={() => {
            void disconnectRelations({ projectId, relations: selected });
          }}
          variant="destructive"
        />
      </div>
    </HudSurface>
  );
}

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

function GroupRail() {
  const actions = useInfiniteCanvasActions();
  const styles = canvasHud();
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

function UndoNotice() {
  const action = useValue(undoableAction$);
  const [spent, setSpent] = useState(false);
  const styles = canvasHud();
  const announce = useInfiniteCanvasAnnounce();
  const offered = useRef(action);

  useEffect(() => {
    if (offered.current !== null && action === null) {
      announce("Undone.");
    }

    offered.current = action;
  }, [action, announce]);

  useEffect(() => {
    if (action === null) {
      return;
    }

    announce(action.describe);

    setSpent(false);

    const timer = setTimeout(() => {
      setSpent(true);
    }, 8000);

    return () => {
      clearTimeout(timer);
    };
  }, [action, announce]);

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

function FailureNotice() {
  const failure = useValue(actionFailure$);
  const announce = useInfiniteCanvasAnnounce();
  const styles = canvasHud();

  useEffect(() => {
    if (failure !== null) {
      announce(failure);
    }
  }, [announce, failure]);

  return (
    <HudSurface anchor="top-right" present={failure !== null}>
      <div className={styles.noticeRail()} role="status">
        <TriangleAlert className={styles.noticeIcon()} />
        <span className={styles.noticeText()}>{failure}</span>
        <Button
          aria-label="Dismiss"
          onClick={() => {
            actionFailure$.set(null);
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
  conflict?: ReactNode;
  droppedKinds?: readonly string[];
  identity: ReactNode;
  library?: ReactNode;
  libraryInset?: number;
  minimap?: ReactNode;
}>) {
  const failure = useValue(actionFailure$);

  useEffect(watchForUnhandledRejections, []);

  return (
    <>
      {library === undefined || library === null ? null : (
        <HudRoot>
          <HudSurface anchor="left" persistent>
            {library}
          </HudSurface>
        </HudRoot>
      )}
      <OffscreenIndicators />
      <HudRoot insetLeft={libraryInset}>
        <HudSurface anchor="top-left" persistent>
          {identity}
        </HudSurface>
        {conflict === undefined || conflict === null ? (
          failure === null ? (
            droppedKinds === undefined ? null : (
              <RecoveryNotice droppedKinds={droppedKinds} />
            )
          ) : (
            <FailureNotice />
          )
        ) : (
          <HudSurface anchor="top-right" persistent present>
            {conflict}
          </HudSurface>
        )}
        <GroupRail />
        <SelectionRail />
        <ConnectorRail />
        <UndoNotice />
        <CanvasContextMenu />
        {minimap}
        {commandPalette}
      </HudRoot>
    </>
  );
}
