import { batch } from "@legendapp/state";

import { showsContentItem } from "../canvas/content-window-data";
import type { WindowPlacement } from "../canvas/open-window";
import { archiveProjectItem } from "./project-content";

async function archiveItem(
  input: WindowPlacement & Readonly<{ itemId: string; projectId: string }>,
) {
  if (!(await archiveProjectItem(input))) return;
  batch(() => {
    for (const window of input.state.windows) {
      if (showsContentItem(window, input.itemId)) {
        input.dispatch({ type: "window.close", windowId: window.id });
      }
    }
  });
}

export { archiveItem };
