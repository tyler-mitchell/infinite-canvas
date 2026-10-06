import { act, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vite-plus/test";
import { d } from "typegpu";
import { ShaderSurface, type ShaderSurfaceProps } from "./shader-surface.tsx";

const gpu = vi.hoisted(() => ({
  textures: [] as { destroyed: boolean; size: number[]; format: string }[],
  tick: (() => {}) as () => void,
  draw: vi.fn(),
  write: vi.fn(),
  unsupported: false,
}));

vi.mock("@base-ui/react/unstable-use-media-query", () => ({ useMediaQuery: () => false }));
vi.mock("motion/react", async () => {
  const { createElement, useEffect } = await import("react");
  return {
    usePageInView: () => true,
    motion: {
      canvas: ({ onViewportEnter, onViewportLeave: _, ...props }: Record<string, unknown>) => {
        useEffect(() => {
          (onViewportEnter as () => void)();
        }, []);
        return createElement("canvas", props);
      },
    },
  };
});
vi.mock("@typegpu/react", async () => {
  const { useEffect, useRef } = await import("react");
  const pipeline = {
    with: () => pipeline,
    withColorAttachment: ({ view }: { view: { destroyed?: boolean } }) => {
      expect(view.destroyed).not.toBe(true);
      return pipeline;
    },
    withDepthStencilAttachment: ({ view }: { view: { destroyed: boolean } }) => {
      expect(view.destroyed).toBe(false);
      return pipeline;
    },
    draw: gpu.draw,
  };
  const root = {
    "~unstable": { createCommandEncoder: () => ({ submit: () => {} }) },
    with: () => root,
    createSampler: () => ({}),
    createBindGroup: () => ({}),
    createRenderPipeline: () => pipeline,
    createTexture: (props: { size: number[]; format: string }) => {
      const texture = {
        ...props,
        destroyed: false,
        $usage: () => texture,
        destroy: () => {
          texture.destroyed = true;
        },
      };
      gpu.textures.push(texture);
      return texture;
    },
  };
  const uniform = { write: gpu.write };
  return {
    ClientOnly: ({ children }: { children: React.ReactNode }) => children,
    useRoot: () => {
      if (gpu.unsupported) throw new Error("WebGPU unavailable");
      return root;
    },
    useUniform: () => uniform,
    useConfigureContext: () => {
      const ctxRef = useRef<{ canvas: HTMLCanvasElement } | null>(null);
      return {
        ctxRef,
        ref: (canvas: HTMLCanvasElement | null) => {
          ctxRef.current = canvas ? { canvas } : null;
        },
      };
    },
    useFrame: (callback: (frame: { deltaSeconds: number }) => void) => {
      useEffect(() => {
        gpu.tick = () => callback({ deltaSeconds: 1 / 60 });
      });
    },
  };
});

const host = document.createElement("div");
const root = createRoot(host);
const shader: ShaderSurfaceProps["shader"] = () => d.vec4f(1);
const effect = () => d.vec4f(1);
const geometry = {
  vertex: {} as NonNullable<ShaderSurfaceProps["geometry"]>["vertex"],
  vertexCount: 6,
};

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  gpu.textures.length = 0;
  gpu.draw.mockClear();
  gpu.write.mockClear();
});
afterEach(() => {
  act(() => root.render(null));
  gpu.unsupported = false;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

test("render targets survive Strict Mode and are released on resize and unmount", () => {
  act(() =>
    root.render(
      <StrictMode>
        <ShaderSurface
          shader={shader}
          effect={effect}
          geometry={geometry}
          resolution={{ width: 100, height: 80 }}
        />
      </StrictMode>,
    ),
  );
  act(() => gpu.tick());
  act(() => gpu.tick());
  expect(gpu.draw).toHaveBeenCalled();
  const previous = gpu.textures.filter((texture) => !texture.destroyed);
  expect(previous.map((texture) => texture.size)).toEqual([
    [100, 80],
    [100, 80],
  ]);
  act(() =>
    root.render(
      <StrictMode>
        <ShaderSurface
          shader={shader}
          effect={effect}
          geometry={geometry}
          resolution={{ width: 200, height: 160 }}
        />
      </StrictMode>,
    ),
  );
  act(() => gpu.tick());
  act(() => gpu.tick());
  expect(previous.every((texture) => texture.destroyed)).toBe(true);
  expect(
    gpu.textures.filter((texture) => !texture.destroyed).map((texture) => texture.size),
  ).toEqual([
    [200, 160],
    [200, 160],
  ]);
  act(() => root.render(null));
  expect(gpu.textures.every((texture) => texture.destroyed)).toBe(true);
});

test("a paused full-screen shader draws once without allocating render targets", () => {
  act(() =>
    root.render(<ShaderSurface shader={shader} paused resolution={{ width: 80, height: 80 }} />),
  );
  act(() => gpu.tick());
  act(() => gpu.tick());
  act(() => gpu.tick());
  expect(gpu.textures).toEqual([]);
  expect(gpu.draw).toHaveBeenCalledTimes(1);
});

test("unavailable WebGPU leaves adjacent content visible", () => {
  gpu.unsupported = true;
  const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  act(() =>
    root.render(
      <>
        <span>Profile</span>
        <ShaderSurface shader={shader} />
      </>,
    ),
  );
  expect(host.textContent).toBe("Profile");
  expect(host.querySelector("canvas")).toBeNull();
  expect(warning).toHaveBeenCalled();
});
