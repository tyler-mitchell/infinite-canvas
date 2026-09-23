import { createCanvasState } from "@hyphened/infinite-canvas/next";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vite-plus/test";
import { components } from "../portfolio/components.tsx";

const playback = vi.hoisted(() => ({ replayKey: undefined as string | number | undefined }));
vi.mock("./components/activity-playback.ts", async (original) => {
  const module = await original<typeof import("./components/activity-playback.ts")>();
  return {
    ...module,
    useActivityPlayback: (options: Parameters<typeof module.useActivityPlayback>[0]) => {
      playback.replayKey = options.replayKey;
      return module.useActivityPlayback(options);
    },
  };
});

test("the contribution card replays from its header and keyboard control", () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const canvas = createCanvasState({
    windowDefinitions: components,
    document: {
      content: {
        windows: {
          contributions: {
            kind: "contributions",
            title: "Contributions",
            rect: { x: 0, y: 0, width: 600, height: 220 },
            data: { totalContributions: 0, weeks: [] },
          },
        },
      },
    },
  });
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  try {
    act(() =>
      root.render(
        <components.contributions.View
          canvas={canvas}
          window={canvas.state.document.content.windows.contributions}
        />,
      ),
    );
    expect(playback.replayKey).toBe(0);
    const header = host.querySelector('[data-slot="card-body"]')!.firstElementChild as HTMLElement;
    act(() => header.click());
    expect(playback.replayKey).toBe(1);

    const control = host.querySelector<HTMLElement>('[role="button"]')!;
    act(() => {
      control.focus();
      control.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    });
    expect(playback.replayKey).toBe(2);
    act(() => control.click());
    expect(playback.replayKey).toBe(3);
    expect(host.textContent).toContain("0 this year");
  } finally {
    act(() => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
  }
});
