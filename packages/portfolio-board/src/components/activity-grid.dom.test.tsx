import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, test, vi } from "vite-plus/test";
import { ActivityGrid } from "./activity-grid.tsx";

vi.mock("motion/react", async (original) => ({
  ...(await original<typeof import("motion/react")>()),
  useReducedMotion: () => true,
  useInView: () => true,
}));

const days = Array.from({ length: 14 }, (_, index) => ({
  date: new Date(2026, 1, index + 1),
  count: index + 1,
}));

afterEach(() => vi.unstubAllGlobals());

test("pointer and keyboard selection update one cell and clear on exit", () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const host = document.createElement("div");
  const root = createRoot(host);
  document.body.append(host);
  try {
    act(() => root.render(<ActivityGrid days={days} playback={false} weeks={2} />));
    const grid = host.querySelector<HTMLElement>('[data-slot="activity-grid"]')!;
    const cells = [...host.querySelectorAll<HTMLElement>('[data-slot="activity-day"]')];
    const select = (index: number) =>
      act(() => cells[index]!.dispatchEvent(new PointerEvent("pointerover", { bubbles: true })));

    select(0);
    expect(host.querySelectorAll("[data-hot]")).toHaveLength(1);
    expect(cells[0]!.hasAttribute("data-hot")).toBe(true);
    expect(host.textContent).toContain("1 activity · Sun Feb 01");
    select(1);
    expect(cells[0]!.hasAttribute("data-hot")).toBe(false);
    expect(cells[1]!.hasAttribute("data-hot")).toBe(true);
    act(() =>
      grid.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })),
    );
    expect(cells[8]!.hasAttribute("data-hot")).toBe(true);
    expect(host.querySelectorAll("[data-hot]")).toHaveLength(1);
    expect(host.querySelectorAll('[data-slot="activity-day"]')[8]).toBe(cells[8]);
    act(() => cells[8]!.dispatchEvent(new PointerEvent("pointerout", { bubbles: true })));
    expect(host.querySelector("[data-hot]")).toBeNull();
    expect(host.textContent).not.toContain("activity ·");
  } finally {
    act(() => root.unmount());
    host.remove();
  }
});
