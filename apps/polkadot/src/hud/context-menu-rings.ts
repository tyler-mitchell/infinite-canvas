import type { InfiniteCanvasCommandId } from "@hyphened/infinite-canvas";
import {
  AlignHorizontalSpaceAround,
  FlipHorizontal,
  Grip,
  Maximize,
  Maximize2,
  Minus,
  MousePointerSquareDashed,
  Pin,
  Scan,
  Undo2,
  Ungroup,
  X,
} from "lucide-react";
import type { ComponentType } from "react";

import { GROUP_LAYOUTS } from "./group-layouts";

/**
 * What each ring of the right-click wheel offers, as data.
 *
 * A ring is six verbs in a fixed order, and that is all it is — no state, no rendering. Keeping it
 * here rather than inside the menu component is what lets a test read it, which matters because the
 * failure mode is quiet: a spoke naming a verb that no longer exists still draws, still animates,
 * and labels itself with the raw id.
 */

/**
 * A framework verb brings its glyph and its word; only its behaviour is read from the framework.
 *
 * The framework's own labels are written for a palette row, where a verb sits in a list beside its
 * siblings and needs to say which family it belongs to: `group.setLayout.split` is "Layout: Split",
 * `group.flipAxis` is "Flip Pane Orientation". Read aloud in a list those are right. Under a 44px
 * icon they are a different register — the wheel says "Side by side" and "Flip axis", because a
 * tooltip on a picture is a reminder, not an entry in an index.
 *
 * So this is presentation and it lives with the surface, exactly like `action-icons.ts`. What is
 * *not* duplicated is anything behavioural: which command runs and whether it is offered both come
 * from the framework, and getting those from two places is the mistake this file was built to stop.
 */
type CanvasRingEntry = Readonly<{
  icon: ComponentType<Readonly<{ className?: string }>>;
  id: InfiniteCanvasCommandId;
  label: string;
  source: "canvas";
}>;

/**
 * An app verb brings neither: `action-icons.ts` answers for the glyph and `app-actions.ts` for the
 * word, because this app wrote that vocabulary in this app's own register already.
 */
type AppRingEntry = Readonly<{ id: string; source: "app" }>;

type RingEntry = AppRingEntry | CanvasRingEntry;

/**
 * Three rings, chosen by what was pressed, rather than one ring trying to serve all of them.
 *
 * The three vocabularies barely overlap — closing and pinning mean nothing on bare canvas, creating
 * a note has nothing to do with the window you pressed, and reshaping a container means nothing
 * without one. Offering all eighteen would be a list wearing a wheel's shape, and reusing six
 * angles with different meanings would put a different verb under the same direction, which is
 * precisely what a wheel must never do.
 */
const CANVAS_RING: readonly RingEntry[] = [
  { id: "note.create", source: "app" },
  { id: "group.createFromSelection", source: "app" },
  { icon: Scan, id: "view.fitSelection", label: "Fit selection", source: "canvas" },
  { icon: Maximize, id: "view.fitAll", label: "Fit all", source: "canvas" },
  {
    icon: MousePointerSquareDashed,
    id: "selection.selectAllVisible",
    label: "Select all",
    source: "canvas",
  },
  { icon: Undo2, id: "history.undo", label: "Undo", source: "canvas" },
];

const WINDOW_RING: readonly RingEntry[] = [
  { icon: Maximize2, id: "activeWindow.toggleMaximized", label: "Maximize", source: "canvas" },
  { icon: Pin, id: "activeWindow.togglePinned", label: "Pin", source: "canvas" },
  { icon: Grip, id: "window.undock", label: "Undock", source: "canvas" },
  { icon: X, id: "activeWindow.close", label: "Close", source: "canvas" },
  { icon: Minus, id: "activeWindow.minimize", label: "Minimize", source: "canvas" },
  // "Fit", not "Fit selection": on a window ring the subject is the window you pressed.
  { icon: Scan, id: "view.fitSelection", label: "Fit", source: "canvas" },
];

const GROUP_RING: readonly RingEntry[] = [
  /*
   * The rail's own list, in the rail's own order. Shared so the same shape cannot end up with one
   * glyph on the rail and another on the wheel — and so a container's three states read
   * left-to-right on one control in the order they read clockwise on the other.
   *
   * The return is annotated because this id is built rather than written: without it the template
   * literal widens to `string` and stops being checked against the framework's command ids, and a
   * computed id is the one that most needs checking.
   */
  ...GROUP_LAYOUTS.map((entry): CanvasRingEntry => ({
    icon: entry.icon,
    id: `group.setLayout.${entry.layout}`,
    label: entry.label,
    source: "canvas",
  })),
  { icon: FlipHorizontal, id: "group.flipAxis", label: "Flip axis", source: "canvas" },
  {
    icon: AlignHorizontalSpaceAround,
    id: "group.equalizeChildren",
    label: "Equalize",
    source: "canvas",
  },
  { icon: Ungroup, id: "group.dissolve", label: "Ungroup", source: "canvas" },
];

const CONTEXT_MENU_RINGS = { canvas: CANVAS_RING, group: GROUP_RING, window: WINDOW_RING };

/**
 * Which ring a press opens.
 *
 * Group chrome is consulted only where no window was pressed. The framework draws the two as
 * disjoint layers, so a press lands on a pane or on the shell around it and never ambiguously on
 * both — but stating the precedence says which one wins if that ever stops being true.
 */
function getRing(press: Readonly<{ groupId: string | null; windowId: string | null }>) {
  if (press.windowId !== null) {
    return WINDOW_RING;
  }

  if (press.groupId !== null) {
    return GROUP_RING;
  }

  return CANVAS_RING;
}

export { CONTEXT_MENU_RINGS, getRing };
export type { CanvasRingEntry, RingEntry };
