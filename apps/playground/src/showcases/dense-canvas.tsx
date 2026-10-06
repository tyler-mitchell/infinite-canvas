import { createCanvasState, type WindowState } from "@hyphened/infinite-canvas";
import { useWindowDetail, WindowContent, WindowDragHandle } from "@hyphened/infinite-canvas/react";
import { observer } from "@legendapp/state/react";
import type { Observable } from "@legendapp/state";

const columns = 8;
const cell = { width: 260, height: 190 };
const gap = 40;

const kinds = ["panel", "note", "chart"] as const;

export function createDenseCanvas(count: number) {
  const ids = Array.from({ length: count }, (_, index) => index);
  return createCanvasState({
    windowDefinitions: {
      panel: { minSize: { width: 120, height: 90 }, detail: { summaryBelow: 200, fullAbove: 280 } },
      note: { minSize: { width: 120, height: 90 }, detail: { summaryBelow: 160, fullAbove: 240 } },
      chart: { minSize: { width: 120, height: 90 }, detail: { summaryBelow: 240, fullAbove: 320 } },
    },
    document: {
      content: {
        windows: Object.fromEntries(
          ids.map((index) => [
            `w${index}`,
            {
              kind: kinds[index % kinds.length],
              title: `${kinds[index % kinds.length]}.${index}`,
              rect: {
                x: (index % columns) * (cell.width + gap),
                y: Math.floor(index / columns) * (cell.height + gap),
                ...cell,
              },
            },
          ]),
        ),
      },
    },
  });
}

export const DenseWindow = observer(function DenseWindow({
  window,
}: {
  window: Observable<WindowState>;
}) {
  const detail = useWindowDetail();
  return (
    <WindowDragHandle className="h-full">
      <div className="flex h-full flex-col border border-white/10 bg-white/[0.03]">
        <div className="flex items-center justify-between border-b border-white/10 px-2 py-1 text-[10px] uppercase text-white/50">
          <span>{window.title.get()}</span>
          <span>{detail}</span>
        </div>
        <WindowContent>
          <div className="grid h-full content-start gap-2 p-3 text-[11px] text-white/60">
            {detail === "full" ? (
              <>
                <p>Full detail renders every row.</p>
                {Array.from({ length: 6 }, (_, row) => (
                  <div key={row} className="flex justify-between border-b border-white/5 pb-1">
                    <span>row {row}</span>
                    <span className="tabular-nums">{(row * 37) % 100}</span>
                  </div>
                ))}
              </>
            ) : detail === "summary" ? (
              <p>Summary detail: the body collapses to a single line.</p>
            ) : null}
          </div>
        </WindowContent>
      </div>
    </WindowDragHandle>
  );
});
