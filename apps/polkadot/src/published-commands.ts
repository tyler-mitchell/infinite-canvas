import {
  getInfiniteCanvasContextualCommands,
  type InfiniteCanvasContextualCommand,
  type InfiniteCanvasState,
} from "@hyphened/infinite-canvas";

import { APP_ACTIONS } from "./app-actions";
import type { WindowKind } from "./canvas/window-registry";

/**
 * Which of the framework's own verbs this app offers to a caller that cannot see the screen.
 *
 * `getInfiniteCanvasContextualCommands` returns, per verb, an id, a description, live enablement and
 * the command to run — a tool registry in all but name. So the app publishes that list rather than
 * a hand-written one, which would need keeping in step with a framework surface of eighty-odd verbs
 * and would silently fall behind the first time one was added.
 *
 * Two are held back, and both exclusions are about the caller rather than about the verb.
 */
const getPublishedCanvasCommands = (
  state: InfiniteCanvasState<WindowKind>,
): readonly InfiniteCanvasContextualCommand[] =>
  getInfiniteCanvasContextualCommands(state).filter(
    (descriptor) =>
      /*
       * A descriptor whose command carries an empty string is a template waiting for an argument —
       * `{ type: "workspace.enter", workspaceId: "" }`. Published as it stands it would act on a
       * workspace called "", which is not a refusal a caller could understand. Five verbs are in
       * this state and each needs an `AppAction` with an `input` instead, the way `window.reveal`
       * already has one.
       */
      !Object.values(descriptor.command).some((value) => value === "") &&
      /*
       * And a framework id this app has already wrapped stays the app's. `window.reveal` is both a
       * framework command taking a window id and an app verb that resolves one against live state,
       * and two tools under one name is a caller's problem rather than a subtlety.
       */
      !APP_ACTIONS.some((action) => action.id === descriptor.id),
  );

export { getPublishedCanvasCommands };
