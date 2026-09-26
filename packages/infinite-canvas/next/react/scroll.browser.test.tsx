import { expect, onTestFinished, test, vi } from "vite-plus/test";
import { act, StrictMode, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { createCanvasState } from "../state";
import type { Canvas } from "../state.types";
import type { CameraMotion } from "../camera";
import { CanvasPortal } from "./context";
import { CanvasScroll } from "./scroll";
import { Sections } from "./sections";
import { CanvasViewport, useCanvasOccluder } from "./viewport";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const createReading = (cameraMotion?: CameraMotion) =>
  createCanvasState({
    cameraMotion,
    windowDefinitions: { card: { size: { width: 200, height: 100 } } },
    document: {
      content: {
        windows: {
          a: { kind: "card", title: "A", rect: { x: 0, y: 0, width: 800, height: 100 } },
          b: { kind: "card", title: "B", rect: { x: 0, y: 150, width: 800, height: 100 } },
        },
      },
      canvasView: { camera: { center: { x: 400, y: 300 }, zoom: 1 } },
    },
  });

const settle = (change?: () => unknown) =>
  act(async () => {
    change?.();
    await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));
  });

const mount = async ({
  canvas = createReading(), content, section = "a",
}: { canvas?: Canvas; content?: ReactNode; section?: string | null }) => {
  const host = document.createElement("div");
  host.style.cssText = "position:fixed;left:0;top:0;width:800px;height:600px";
  document.body.append(host);
  const root = createRoot(host);
  onTestFinished(async () => {
    await act(() => root.unmount());
    host.remove();
  });
  const render = async ({
    children = content,
    reading = true,
    editing = false,
    attached = true,
    onSectionChange,
  }: {
    children?: ReactNode;
    reading?: boolean;
    editing?: boolean;
    attached?: boolean;
    onSectionChange?: (section: string) => void;
  }) => {
    const viewport = (
      <CanvasViewport
        canvas={canvas}
        mode={editing ? "edit" : undefined}
        renderWindow={(window) => window.title.get()}
      >
        {children}
      </CanvasViewport>
    );
    await act(async () =>
      root.render(
        <StrictMode>
          {reading ? (
            <CanvasScroll
              canvas={canvas}
              section={section ?? undefined}
              attached={attached}
              onSectionChange={onSectionChange}
            >
              {viewport}
            </CanvasScroll>
          ) : viewport}
        </StrictMode>,
      ),
    );
    await settle();
  };
  await render({});
  return {
    canvas,
    host,
    render,
    first: () => host.querySelector("[data-window-id='a']")!.getBoundingClientRect(),
  };
};

function Band() {
  return (
    <div
      ref={useCanvasOccluder<HTMLDivElement>()}
      style={{ position: "absolute", left: 0, right: 0, top: 0, height: 60 }}
    />
  );
}

test("reading puts the camera on the route when it opens and whenever a panel changes the insets", async () => {
  const { canvas, first } = await mount({});
  expect(first().top).toBeCloseTo(36, 1);
  expect(first().left).toBeCloseTo(36, 1);

  await settle(() =>
    canvas.actions.setViewportOccluder.run({
      source: "controls",
      rect: { x: 0, y: 0, width: 800, height: 60 },
    }),
  );
  expect(first().top).toBeCloseTo(96, 1);
});

test("opening without a section places the camera without a navigation animation", async () => {
  const canvas = createReading({ reducedMotion: "never", transition: { duration: 1 } });
  const navigate = vi.spyOn(canvas.commands.navigateCamera, "run");
  await mount({ canvas, section: null });
  expect(navigate).not.toHaveBeenCalled();
  expect(canvas.computed.camera.peek()).toEqual(canvas.computed.cameraTrack.peek()!.at(0));
  navigate.mockRestore();
});

test("scrolling returns an off-route camera through navigation to the latest scroll offset", async () => {
  const { canvas, host } = await mount({
    canvas: createReading({ reducedMotion: "never", transition: { duration: 0.1 } }),
  });
  const viewport = host.querySelector<HTMLElement>("[data-slot='canvas-scroll'] > div")!;
  const track = canvas.computed.cameraTrack.peek()!;
  const initial = canvas.computed.camera.peek();
  await settle(() =>
    canvas.actions.setCamera.run({
      center: { x: initial.center.x + 600, y: initial.center.y },
    }),
  );
  const scroll = (offset: number) => {
    viewport.scrollTop = offset;
    viewport.dispatchEvent(new Event("scroll"));
  };
  const navigate = vi.spyOn(canvas.camera, "navigate");
  const committed = canvas.computed.view.camera.peek();
  act(() => scroll(track.length / 3));
  expect(canvas.computed.camera.peek().center.x).toBeGreaterThan(initial.center.x + 300);
  await settle();
  act(() => scroll(track.length * 2 / 3));
  expect(navigate).toHaveBeenCalledTimes(1);
  expect(canvas.computed.view.camera.peek()).toEqual(committed);
  const destination = track.at(viewport.scrollTop);
  await act(async () => {
    await expect.poll(() => canvas.computed.camera.peek()).toEqual(destination);
  });

  act(() => scroll(track.length));
  expect(canvas.computed.camera.peek()).toEqual(track.at(viewport.scrollTop));
  navigate.mockRestore();
});

test("editing preserves mounted windows and does not unlock scroll navigation", async () => {
  const { host, render } = await mount({});
  const window = host.querySelector("[data-window-id='a']");
  await render({ editing: true });
  expect(host.querySelector("[data-window-id='a']")).toBe(window);
  const viewport = host.querySelector("[data-slot='canvas-viewport']")!;
  const locked = new WheelEvent("wheel", { deltaY: 40, bubbles: true, cancelable: true });
  viewport.dispatchEvent(locked);
  expect(locked.defaultPrevented).toBe(false);

  await render({ editing: true, attached: false });
  const unlocked = new WheelEvent("wheel", { deltaY: 40, bubbles: true, cancelable: true });
  await act(async () => { viewport.dispatchEvent(unlocked); });
  expect(unlocked.defaultPrevented).toBe(true);
  expect(viewport.getAttribute("data-mode")).toBe("edit");
  expect(host.querySelector("[data-window-id='a']")).toBe(window);
});

test("a band keeps the route below it after the viewport remounts into reading, until it unmounts", async () => {
  const { first, render } = await mount({ content: <Band /> });
  await render({ reading: false });
  await render({ reading: true });
  expect(first().top).toBeCloseTo(96, 1);

  await render({ children: null });
  expect(first().top).toBeCloseTo(36, 1);
});

test("reading shows none of the author's selection, and editing the same canvas shows it", async () => {
  const { canvas, host, render } = await mount({
    content: (
      <CanvasPortal scope="selection">
        <div data-testid="bar" />
      </CanvasPortal>
    ),
  });
  await settle(() => canvas.actions.selectWindow.run({ window: "a" }));
  expect(host.querySelector("[data-selected]")).toBeNull();
  expect(host.querySelector("[data-slot='canvas-selection-bounds']")).toBeNull();
  expect(host.querySelector("[data-testid='bar']")).toBeNull();

  await render({ reading: false });
  expect(host.querySelector("[data-selected]")?.getAttribute("data-window-id")).toBe("a");
  expect(host.querySelector("[data-slot='canvas-selection-bounds']")).not.toBeNull();
  expect(host.querySelector("[data-testid='bar']")).not.toBeNull();
});

test("cards that share a row share one stop in the section list, named after both", async () => {
  const { host } = await mount({
    canvas: createCanvasState({
      windowDefinitions: { card: { size: { width: 200, height: 100 } } },
      document: {
        content: {
          windows: {
            a: { kind: "card", title: "A", rect: { x: 0, y: 0, width: 390, height: 100 } },
            b: { kind: "card", title: "B", rect: { x: 410, y: 0, width: 390, height: 100 } },
            c: { kind: "card", title: "C", rect: { x: 0, y: 150, width: 800, height: 100 } },
          },
        },
      },
    }),
    content: (
      <Sections.Root>{(section) => <Sections.Item key={section.id} section={section} />}</Sections.Root>
    ),
  });
  const stops = [...host.querySelectorAll("[data-slot='canvas-section']")];
  expect(stops.map((stop) => stop.textContent)).toEqual(["A, B", "C"]);
  expect(stops.map((stop) => stop.getAttribute("aria-label"))).toEqual(["A, B", "C"]);
  expect(stops.map((stop) => stop.getAttribute("aria-current"))).toEqual(["true", null]);
});
