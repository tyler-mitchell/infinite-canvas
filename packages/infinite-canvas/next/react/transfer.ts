import type { ComponentProps } from "react";
import type { Canvas } from "../state.types";
import {
  getViewportPoint,
  isInteractiveTarget,
  readComponentTransfer,
  report,
} from "../input";

export function getTransferHandlers({
  canvas,
  transferType,
}: {
  canvas: Canvas;
  transferType: string;
}): Pick<ComponentProps<"div">, "onDragOver" | "onDragLeave" | "onDrop" | "onPaste"> {
  return {
    onDragOver: (event) => {
      if (!event.dataTransfer.types.includes(transferType)) return;
      if (event.target instanceof Element && event.target.closest("[data-canvas-control]"))
        return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
      if (canvas.state.session.drop.pointerId.peek() === null)
        report(
          canvas.actions.updateDrop.run(getViewportPoint({ element: event.currentTarget, event })),
        );
    },
    onDragLeave: (event) => {
      if (!(event.target instanceof Node) || !event.currentTarget.contains(event.target)) return;
      if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget))
        return;
      if (canvas.state.session.drop.pointerId.peek() === null)
        report(canvas.actions.cancelDrag.run({}));
    },
    onDrop: (event) => {
      if (!event.dataTransfer.types.includes(transferType)) return;
      if (event.target instanceof Element && event.target.closest("[data-canvas-control]"))
        return;
      event.preventDefault();
      event.stopPropagation();
      const point = getViewportPoint({ element: event.currentTarget, event });
      if (canvas.state.session.drop.pointerId.peek() === null) {
        report(canvas.actions.updateDrop.run(point));
        report(canvas.actions.commitDrop.run({}));
        return;
      }
      const insertion = readComponentTransfer({
        transfer: event.dataTransfer,
        format: transferType,
      });
      if (insertion instanceof Error) {
        report(insertion);
        return;
      }
      if (insertion === null) return;
      const error = canvas.actions.beginDrop.run({ insertion, point });
      report(error);
      if (error === undefined) report(canvas.actions.commitDrop.run({}));
    },
    onPaste: (event) => {
      if (isInteractiveTarget(event.target)) return;
      const insertion = readComponentTransfer({
        transfer: event.clipboardData,
        format: transferType,
      });
      if (insertion instanceof Error) {
        report(insertion);
        return;
      }
      if (insertion === null) return;
      event.preventDefault();
      report(canvas.actions.insertComponent.run({ ...insertion, id: crypto.randomUUID() }));
    },
  };
}
