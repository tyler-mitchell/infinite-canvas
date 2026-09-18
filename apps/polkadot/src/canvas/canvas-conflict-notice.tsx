import type { InfiniteCanvasStore } from "@hyphened/infinite-canvas";
import { useGoToCanvas } from "../workspace/use-go-to-canvas";
import { useObservable, useValue } from "@legendapp/state/react";
import { CopyPlus, RotateCcw, TriangleAlert } from "lucide-react";
import { Button } from "ui";
import { tv } from "ui/tv";

import { FLOATING_SURFACE } from "../material";
import { forkCanvas } from "../workspace/fork-canvas";
import type { WindowKind } from "./window-registry";

const conflictNotice = tv({
  slots: {
    actions: "flex shrink-0 items-center gap-1",
    body: "min-w-0",
    detail: "text-[11px] text-[var(--ink-faint)]",
    icon: "size-4 shrink-0 text-[var(--danger)]",
    rail: `flex max-w-[26rem] items-center gap-2.5 rounded-[var(--radius-lg)] ${FLOATING_SURFACE} py-2 pr-2 pl-3 shadow-[var(--lift-3)]`,
    title: "text-[12.5px] font-medium text-[var(--ink)]",
  },
});

export function CanvasConflictNotice({
  canvasTitle,
  store,
  projectId,
}: Readonly<{
  canvasTitle: string;
  store: InfiniteCanvasStore<WindowKind>;
  projectId: string;
}>) {
  const goToCanvas = useGoToCanvas();
  const busy$ = useObservable(false);
  const busy = useValue(busy$);
  const styles = conflictNotice();

  const fork = async () => {
    busy$.set(true);

    try {
      const created = await forkCanvas({ canvasTitle, layout: store.snapshot(), projectId });

      await goToCanvas({ canvasId: created.id });
    } finally {
      busy$.set(false);
    }
  };

  return (
    <div className={styles.rail()} role="alert">
      <TriangleAlert className={styles.icon()} />
      <div className={styles.body()}>
        <p className={styles.title()}>This canvas changed somewhere else</p>
        <p className={styles.detail()}>
          Nothing you do here is being saved. Keep this arrangement as its own canvas, or reload to
          take the other version and lose what you have done since.
        </p>
      </div>
      <div className={styles.actions()}>
        <Button
          disabled={busy}
          onClick={() => {
            void fork();
          }}
          size="sm"
          variant="ghost"
        >
          <CopyPlus />
          Keep mine
        </Button>
        <Button
          aria-label="Reload this canvas and discard changes since the conflict"
          disabled={busy}
          onClick={() => {
            globalThis.location.reload();
          }}
          size="icon-sm"
          title="Reload and discard"
          variant="ghost"
        >
          <RotateCcw />
        </Button>
      </div>
    </div>
  );
}
