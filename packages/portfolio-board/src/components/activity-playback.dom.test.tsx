import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { useValue } from "@legendapp/state/react";
import { afterAll, afterEach, beforeAll, expect, test, vi } from "vite-plus/test";
import { useActivityPlayback, type ActivityPlaybackOptions } from "./activity-playback.ts";
import type { ActivityDay } from "./activity-grid.tsx";
import type { TimedDOMSegment } from "../motion.ts";

const animation = vi.hoisted(() => ({
  reduced: false,
  controls: [] as {
    pause: ReturnType<typeof vi.fn>;
    play: ReturnType<typeof vi.fn>;
    stop: ReturnType<typeof vi.fn>;
    complete: ReturnType<typeof vi.fn>;
    finish: () => void;
    update?: (time: number) => void;
    delay?: number;
    segments?: TimedDOMSegment[];
  }[],
}));

vi.mock("motion/react", async (original) => {
  const { useRef } = await import("react");
  const { animate } = await import("motion");
  return {
    ...(await original<typeof import("motion/react")>()),
    useReducedMotion: () => animation.reduced,
    useInView: () => true,
    useAnimate: () => [useRef(null), animate],
  };
});
vi.mock("motion", async (original) => ({
  ...(await original<typeof import("motion")>()),
  animate: (
    from: unknown,
    _to: unknown,
    options?: { onUpdate?: (time: number) => void; delay?: number; duration?: number },
  ) => {
    const completion = { finish: () => {} };
    const promise = new Promise<void>((resolve) => {
      completion.finish = resolve;
    });
    const control = Object.assign(promise, {
      finished: promise,
      pause: vi.fn(),
      play: vi.fn(),
      stop: vi.fn(),
      complete: vi.fn(() => completion.finish()),
      finish: completion.finish,
      update: options?.onUpdate,
      delay: options?.delay,
      segments: Array.isArray(from) ? from : undefined,
    });
    if (options?.duration !== 0) animation.controls.push(control);
    return control;
  },
}));

const days = [1, 6, 10].map((count, index) => ({ count, date: new Date(2026, 0, index + 1) }));
const host = document.createElement("div");
const root = createRoot(host);
beforeAll(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
});
afterAll(() => {
  vi.unstubAllGlobals();
});

function Harness({
  data = days,
  loading = false,
  visible = 3,
  replayKey = 0,
  options = { duration: 14, cellDuration: 0.28 },
}: {
  data?: readonly ActivityDay[];
  loading?: boolean;
  visible?: number;
  replayKey?: number;
  options?: ActivityPlaybackOptions;
}) {
  const playback = useActivityPlayback({
    days: data,
    loading,
    replayKey,
    playback: { particles: false, ...options },
    ready: true,
    thresholds: [1, 3, 6, 10],
    columns: (snapshot) => snapshot.slice(-visible),
    cellSize: 11,
    gap: 4,
  });
  const phase = useValue(playback.phase$);
  return (
    <div
      data-phase={loading ? "loading" : phase}
      ref={playback.plot}
      style={
        {
          "--pk-level-0": "#000000",
          "--pk-level-1": "#111111",
          "--pk-level-2": "#222222",
          "--pk-level-3": "#333333",
          "--pk-level-4": "#444444",
        } as React.CSSProperties
      }
    >
      {playback.days.slice(-visible).map((day, index) => (
        <div key={day.date.getTime()} data-index={index}>
          {day.count}
          <span data-slot="activity-fill" />
          <span data-slot="activity-cursor" />
          {day.count >= 10 && (
            <span data-slot="activity-flash">
              <span data-slot="activity-core" />
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

afterEach(() => {
  act(() => root.render(null));
  animation.controls.length = 0;
  animation.reduced = false;
  vi.restoreAllMocks();
});

test("loading pauses and resumes the same animation", () => {
  act(() => root.render(createElement(Harness)));
  const control = animation.controls.at(-1)!;
  act(() => root.render(createElement(Harness, { loading: true })));
  expect(control.pause).toHaveBeenCalled();
  expect(host.firstElementChild?.getAttribute("data-phase")).toBe("loading");
  act(() => root.render(createElement(Harness)));
  expect(control.play).toHaveBeenCalled();
  expect(animation.controls).toHaveLength(1);
});

test("page load resumes the delayed animation without replacing it", () => {
  vi.spyOn(document, "readyState", "get").mockReturnValue("loading");
  act(() =>
    root.render(
      createElement(Harness, {
        options: { waitForPageLoad: true, startDelay: 0.8 },
      }),
    ),
  );
  const control = animation.controls[0]!;
  expect(control.pause).toHaveBeenCalled();
  expect(control.delay).toBe(0.8);
  act(() => {
    window.dispatchEvent(new Event("load"));
  });
  expect(control.play).toHaveBeenCalled();
  expect(animation.controls).toHaveLength(1);
});

test("an already loaded page keeps the configured start delay", () => {
  vi.spyOn(document, "readyState", "get").mockReturnValue("complete");
  act(() =>
    root.render(
      createElement(Harness, {
        options: { waitForPageLoad: true, startDelay: 1.2 },
      }),
    ),
  );
  expect(animation.controls[0]!.pause).not.toHaveBeenCalled();
  expect(animation.controls[0]!.delay).toBe(1.2);
});

test.each([-1, NaN, Infinity])("invalid start delay %s becomes zero", (startDelay) => {
  act(() => root.render(createElement(Harness, { options: { startDelay } })));
  expect(animation.controls[0]!.delay).toBe(0);
});

test("data replacement retains the old cells until the fade finishes", async () => {
  act(() => root.render(createElement(Harness)));
  const original = animation.controls[0]!;
  act(() => root.render(createElement(Harness, { data: [{ date: days[0]!.date, count: 99 }] })));
  expect(original.stop).toHaveBeenCalled();
  expect(host.textContent).toBe("1610");
  expect(host.firstElementChild?.getAttribute("data-phase")).toBe("resetting");
  await act(async () => {
    await Promise.resolve(animation.controls.at(-1)!.finish());
  });
  expect(host.textContent).toBe("99");
});

test("equivalent data and a resize retain the current clock", () => {
  act(() => root.render(createElement(Harness)));
  act(() =>
    root.render(createElement(Harness, { data: days.map((day) => ({ ...day })), visible: 2 })),
  );
  expect(animation.controls).toHaveLength(1);
  expect(animation.controls[0]!.stop).not.toHaveBeenCalled();
});

test("replay fades before a new pass and unmount stops all controls", () => {
  act(() => root.render(createElement(Harness)));
  act(() => root.render(createElement(Harness, { replayKey: 1 })));
  expect(host.firstElementChild?.getAttribute("data-phase")).toBe("resetting");
  const exit = animation.controls.at(-1)!;
  act(() => root.render(null));
  expect(exit.stop).toHaveBeenCalled();
});

test("reduced motion shows final values without animation", () => {
  animation.reduced = true;
  act(() => root.render(createElement(Harness)));
  expect(animation.controls).toHaveLength(0);
  expect(host.firstElementChild?.getAttribute("data-phase")).toBe("complete");
  expect(host.textContent).toBe("1610");
});

test("a hidden document pauses without replacing its clock", () => {
  act(() => root.render(createElement(Harness)));
  const control = animation.controls[0]!;
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
  vi.spyOn(document, "hidden", "get").mockReturnValue(true);
  act(() => {
    document.dispatchEvent(new Event("visibilitychange"));
  });
  expect(control.pause).toHaveBeenCalled();
  expect(animation.controls).toHaveLength(1);
});

test("a reload that restores the original data still finishes its transition", async () => {
  act(() => root.render(createElement(Harness)));
  act(() => root.render(createElement(Harness, { data: [{ date: days[0]!.date, count: 99 }] })));
  act(() => root.render(createElement(Harness)));
  const exit = animation.controls.at(-1)!;
  await act(async () => {
    await Promise.resolve(exit.finish());
  });
  const reveal = animation.controls.at(-1)!;
  expect(reveal).not.toBe(exit);
  await act(async () => {
    await Promise.resolve(reveal.finish());
  });
  expect(host.firstElementChild?.getAttribute("data-phase")).toBe("playing");
  expect(host.textContent).toBe("1610");
});

test("completion shimmer shares the cell timelines and starts after all cell effects", async () => {
  act(() => root.render(createElement(Harness)));
  await act(async () => {
    animation.controls[0]!.finish();
  });
  const cellControls = animation.controls.slice(1);
  expect(cellControls).toHaveLength(11);
  const cursorControls = cellControls.filter((control) => {
    const element = control.segments?.[0]?.[0];
    return typeof element === "string" && element.endsWith('[data-slot="activity-cursor"]');
  });
  expect(cursorControls).toHaveLength(3);
  const cellSegments = cellControls.flatMap((control) =>
    cursorControls.includes(control) ? control.segments!.slice(0, -1) : control.segments!,
  );
  const completionAt = Math.max(...cellSegments.map(([, , { at, duration }]) => at + duration));
  expect(cursorControls.every((control) => control.segments!.at(-1)![2].at >= completionAt)).toBe(
    true,
  );
  expect(cellControls.every((control) => control.update === undefined)).toBe(true);
  expect(host.firstElementChild?.getAttribute("data-phase")).toBe("playing");
  await act(async () => {
    cellControls.slice(0, -1).forEach((control) => control.finish());
  });
  expect(animation.controls).toHaveLength(1 + cellControls.length);
  expect(host.firstElementChild?.getAttribute("data-phase")).toBe("playing");
  act(() => root.render(createElement(Harness, { loading: true })));
  expect(cellControls.at(-1)!.pause).toHaveBeenCalled();
  expect(cellControls.slice(0, -1).every((control) => control.pause.mock.calls.length === 0)).toBe(
    true,
  );
  act(() => root.render(createElement(Harness)));
  expect(cellControls.at(-1)!.play).toHaveBeenCalled();
  expect(cellControls.slice(0, -1).every((control) => control.play.mock.calls.length === 0)).toBe(
    true,
  );
  await act(async () => cellControls.at(-1)!.finish());
  expect(animation.controls).toHaveLength(1 + cellControls.length);
  expect(host.firstElementChild?.getAttribute("data-phase")).toBe("complete");
});

test("completion shimmer can be disabled", async () => {
  act(() =>
    root.render(
      createElement(Harness, {
        options: { completionShimmer: false },
      }),
    ),
  );
  await act(async () => animation.controls[0]!.finish());
  const cellControls = animation.controls.slice(1);
  await act(async () => {
    cellControls.forEach((control) => control.finish());
  });
  expect(animation.controls.at(-1)).toBe(cellControls.at(-1));
  expect(host.firstElementChild?.getAttribute("data-phase")).toBe("complete");
});

test("unmount prevents delayed cells from starting effects", async () => {
  act(() => root.render(createElement(Harness)));
  await act(async () => animation.controls[0]!.finish());
  const cellControls = animation.controls.slice(1);
  act(() => root.render(null));
  expect(cellControls.every((control) => control.stop.mock.calls.length > 0)).toBe(true);
  await act(async () => {
    cellControls.forEach((control) => control.finish());
  });
  expect(animation.controls).toHaveLength(1 + cellControls.length);
});

test("replaced playback cannot start shimmer during the exit fade", async () => {
  act(() => root.render(createElement(Harness)));
  await act(async () => animation.controls[0]!.finish());
  const cellControls = animation.controls.slice(1);
  act(() => root.render(createElement(Harness, { replayKey: 1 })));
  const exit = animation.controls.at(-1);
  await act(async () => cellControls.forEach((control) => control.finish()));
  expect(animation.controls.at(-1)).toBe(exit);
  expect(host.firstElementChild?.getAttribute("data-phase")).toBe("resetting");
});
