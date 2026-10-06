import { getRunnableCommands, type Canvas } from "@hyphened/infinite-canvas";
import { CanvasPortal, useCanvasViewport } from "@hyphened/infinite-canvas/react";
import { observer } from "@legendapp/state/react";

import { tv } from "../tv.ts";
import { canvasIcons } from "./canvas-icons.ts";
import { Toolbar } from "./toolbar.tsx";
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip.tsx";

const selectionToolbar = tv({
  slots: {
    content:
      "pointer-events-auto gap-0 rounded-pk-control border border-pk-line bg-pk-surface p-1 shadow-pk-tray",
    group: "gap-0.5",
  },
});

export type CanvasSelectionToolbarProps = {
  canvas: Canvas;
  className?: string;
};

/** Shows available editing commands for the selection. */
export const CanvasSelectionToolbar = observer(function CanvasSelectionToolbar({
  canvas,
  className,
}: CanvasSelectionToolbarProps) {
  const { mode } = useCanvasViewport();
  if (mode !== "edit") return null;
  const tools = getRunnableCommands(canvas).filter(
    (command) => command.ready && command.scope === "selection" && command.surface === "edit",
  );
  const styles = selectionToolbar();
  if (tools.length === 0) return null;
  return (
    <CanvasPortal scope="selection" side="top" sideOffset={12}>
      <div className={styles.content({ className })}>
        <Toolbar variant="plain">
          <Toolbar.Group className={styles.group()}>
            {tools.map((tool) => {
              const Icon = canvasIcons[tool.icon] ?? canvasIcons.edit;
              return (
                <Tooltip key={tool.name}>
                  <TooltipTrigger
                    render={
                      <Toolbar.Button
                        size="icon"
                        aria-label={tool.label}
                        onClick={() => void tool.run()}
                      />
                    }
                  >
                    <Icon />
                  </TooltipTrigger>
                  <TooltipContent>{tool.label}</TooltipContent>
                </Tooltip>
              );
            })}
          </Toolbar.Group>
        </Toolbar>
      </div>
    </CanvasPortal>
  );
});
