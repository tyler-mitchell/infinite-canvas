import { getRunnableCommands, type Canvas } from "@hyphened/infinite-canvas/next";
import { useCanvasViewport } from "@hyphened/infinite-canvas/next/react";
import { observer } from "@legendapp/state/react";
import { Fragment, type ComponentProps } from "react";

import { tv } from "../tv.ts";
import { canvasIcons } from "./canvas-icons.ts";
import { Popover, PopoverContent } from "./popover.tsx";
import { Toolbar } from "./toolbar.tsx";
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip.tsx";

const selectionToolbar = tv({
  slots: { content: "w-auto max-w-none gap-0 p-1", group: "gap-0.5" },
});

type Placement = Pick<ComponentProps<typeof PopoverContent>, "side" | "sideOffset" | "align">;

export type CanvasSelectionToolbarProps = Placement & {
  canvas: Canvas;
  className?: string;
};

/**
 * The commands that apply to what is selected, over the selection itself. Tools come from the same
 * registry the launcher and an agent read, so nothing is listed by hand.
 */
export const CanvasSelectionToolbar = observer(function CanvasSelectionToolbar({
  canvas,
  className,
  side = "top",
  sideOffset = 12,
  align = "center",
}: CanvasSelectionToolbarProps) {
  const { selectionAnchor } = useCanvasViewport();
  const actions = canvas.computed.selectionActions.get();
  const tools = getRunnableCommands(canvas).filter(
    (command) => command.scope === "selection" && command.surface === "edit",
  );
  const styles = selectionToolbar();
  const clusters = [
    actions.map((action) => ({
      key: action.input.action,
      label: action.label,
      icon: action.icon,
      run: () => void canvas.commands.runComponentAction.run(action.input),
    })),
    tools.map((tool) => ({
      key: tool.name,
      label: tool.label,
      icon: tool.icon,
      run: () => void tool.run(),
    })),
  ].filter((cluster) => cluster.length > 0);
  return (
    <Popover open={selectionAnchor !== null && clusters.length > 0}>
      <PopoverContent
        anchor={selectionAnchor}
        side={side}
        sideOffset={sideOffset}
        align={align}
        initialFocus={false}
        className={styles.content({ className })}
      >
        <Toolbar variant="plain">
          {clusters.map((cluster, index) => (
            <Fragment key={cluster[0].key}>
              {index === 0 ? null : <Toolbar.Separator />}
              <Toolbar.Group className={styles.group()}>
                {cluster.map((tool) => {
                  const Icon = canvasIcons[tool.icon] ?? canvasIcons.edit;
                  return (
                    <Tooltip key={tool.key}>
                      <TooltipTrigger
                        render={
                          <Toolbar.Button size="icon" aria-label={tool.label} onClick={tool.run} />
                        }
                      >
                        <Icon />
                      </TooltipTrigger>
                      <TooltipContent>{tool.label}</TooltipContent>
                    </Tooltip>
                  );
                })}
              </Toolbar.Group>
            </Fragment>
          ))}
        </Toolbar>
      </PopoverContent>
    </Popover>
  );
});
