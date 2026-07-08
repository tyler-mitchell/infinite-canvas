import { createFileRoute } from "@tanstack/react-router";
import {
  captureInfiniteCanvasRecipe,
  createInfiniteCanvasState,
  createInfiniteCanvasWindow,
  defineInfiniteCanvasWindowRegistry,
  InfiniteCanvasDesktop,
  parseInfiniteCanvasRecipe,
  useInfiniteCanvasActions,
  useInfiniteCanvasSelector,
  useInfiniteCanvasStore,
  type InfiniteCanvasRecipe,
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
          Drag this header to move the whole shell, or the shell&apos;s outer edge to resize it.
          Drag the seam between panes to reweight them. Hold <kbd>Alt</kbd> while dragging a
          floating window over another — the pointer has to be over the target, not just the windows
          overlapping — to dock it.
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

const RECIPE_STORAGE_KEY = "playground.groups.recipe.v1";

/**
 * Recipes are values the consumer owns: the framework captures and applies them,
 * and never decides where they live. Here that is `localStorage`, parsed
 * structurally on the way back in — a recipe crossing storage is untrusted input
 * exactly like persisted canvas state.
 */
function readStoredRecipe(): InfiniteCanvasRecipe | null {
  const raw = globalThis.localStorage.getItem(RECIPE_STORAGE_KEY);

  if (raw === null) {
    return null;
  }

  try {
    return parseInfiniteCanvasRecipe(JSON.parse(raw));
  } catch {
    return null;
  }
}

function RecipeControls() {
  const actions = useInfiniteCanvasActions();
  const store = useInfiniteCanvasStore();

  return (
    <>
      <Button
        onClick={() => {
          const recipe = captureInfiniteCanvasRecipe(store.state$.peek(), {
            name: "Workbench layout",
            recipeId: "workbench",
          });

          if (recipe !== null) {
            globalThis.localStorage.setItem(RECIPE_STORAGE_KEY, JSON.stringify(recipe));
          }
        }}
        size="xs"
        variant="ghost"
      >
        Save recipe
      </Button>
      <Button
        onClick={() => {
          const recipe = readStoredRecipe();

          if (recipe !== null) {
            // Centred in the region, at its natural size: recipes translate, never scale.
            actions.applyRecipe({
              placement: { rect: { height: 600, width: 900, x: -100, y: -100 } },
              recipe,
            });
          }
        }}
        size="xs"
        variant="ghost"
      >
        Apply recipe
      </Button>
    </>
  );
}

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
              <span className="mx-1 h-4 w-px bg-border" />
              <RecipeControls />
            </div>
          );
        }}
        subtitle="Alt+drag to dock. Save the arrangement as a recipe and put it back anywhere. Mod+Z undoes."
        title="Groups"
        windowDefinitions={registry}
      />
    </div>
  );
}
