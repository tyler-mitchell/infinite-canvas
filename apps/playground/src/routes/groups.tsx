import { createFileRoute } from "@tanstack/react-router";
import {
  createInfiniteCanvasState,
  createInfiniteCanvasWindow,
  defineInfiniteCanvasWindowRegistry,
  InfiniteCanvasDesktop,
  useInfiniteCanvasActions,
  useInfiniteCanvasSelector,
} from "@infinite-canvas/react";
import { Button } from "ui";
import { exposeCanvasDevHandle } from "../showcases/dev-handle.ts";

export const Route = createFileRoute("/groups")({
  component: GroupsShowcase,
  staticData: {
    showcase: {
      description: "Windows compose into a movable local layout region.",
      order: 7,
      title: "Groups",
    },
  },
});

type Kind = "pane";

const GROUP_ID = "workbench";
const GROUP_RECT = { height: 360, width: 720, x: 0, y: 0 };

const registry = defineInfiniteCanvasWindowRegistry<Kind>({
  pane: {
    kind: "pane",
    overflowY: "auto",
    renderBody: ({ window }) => (
      <div className="grid content-start gap-2 p-4 text-xs leading-relaxed text-white/60">
        <div className="font-mono text-[10px] tracking-wider text-white/40 uppercase">
          {window.id}
        </div>
        <p>
          A grouped window has no rect of its own. The group&apos;s tree owns its placement, and the
          reducer projects the solved rect back onto <code>window.rect</code>.
        </p>
        <p className="text-white/40">
          Drag this header to move the whole shell. Drag the seam between panes to reweight them.
        </p>
      </div>
    ),
  },
});

/**
 * `left` and `right` start as free-floating windows. `Group them` docks both into
 * a split shell; from there the layout mode can be swapped and the shell moved,
 * and the windows follow because their rects are derived, never stored.
 */
const initialState = createInfiniteCanvasState<Kind>({
  camera: { center: { x: 360, y: 180 }, zoom: 0.9 },
  windows: [
    createInfiniteCanvasWindow({
      id: "left",
      kind: "pane",
      rect: { height: 260, width: 320, x: -80, y: -40 },
      title: "Left",
    }),
    createInfiniteCanvasWindow({
      id: "right",
      kind: "pane",
      rect: { height: 260, width: 320, x: 420, y: 120 },
      title: "Right",
    }),
  ],
});

function GroupControls() {
  const actions = useInfiniteCanvasActions();
  const groups = useInfiniteCanvasSelector((state) => state.groups);
  const group = groups.find((candidate) => candidate.id === GROUP_ID) ?? null;

  if (group === null) {
    return (
      <Button
        onClick={() => {
          actions.createGroup({
            groupId: GROUP_ID,
            rect: GROUP_RECT,
            title: "Workbench",
            windowIds: ["left", "right"],
          });
        }}
        size="xs"
        variant="ghost"
      >
        Group them
      </Button>
    );
  }

  return (
    <>
      {(["split", "tabs", "accordion"] as const).map((layout) => (
        <Button
          key={layout}
          onClick={() => {
            actions.setGroupLayoutMode({ containerId: GROUP_ID, groupId: GROUP_ID, layout });
          }}
          size="xs"
          variant="ghost"
        >
          {layout}
        </Button>
      ))}
      <Button
        onClick={() => {
          actions.setGroupRect({
            groupId: GROUP_ID,
            rect: { ...group.rect, x: group.rect.x + 40 },
          });
        }}
        size="xs"
        variant="ghost"
      >
        Nudge shell
      </Button>
      <Button
        onClick={() => {
          actions.undockWindow({
            rect: { height: 260, width: 320, x: group.rect.x, y: group.rect.y + 400 },
            windowId: "right",
          });
        }}
        size="xs"
        variant="ghost"
      >
        Tear out right
      </Button>
      <Button
        onClick={() => {
          actions.closeGroup(GROUP_ID);
        }}
        size="xs"
        variant="ghost"
      >
        Dissolve
      </Button>
    </>
  );
}

function GroupsShowcase() {
  return (
    <div className="absolute inset-0">
      <InfiniteCanvasDesktop
        initialState={initialState}
        renderOverlay={(context) => {
          exposeCanvasDevHandle(context);
          return (
            <div className="pointer-events-auto absolute bottom-4 left-4 flex items-center gap-1.5 rounded-lg border border-border bg-popover/90 p-1.5 backdrop-blur">
              <GroupControls />
            </div>
          );
        }}
        subtitle="Drag a header to move the shell; drag a seam to reweight. The tree owns every rect."
        title="Groups"
        windowDefinitions={registry}
      />
    </div>
  );
}
