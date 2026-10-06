import { attest } from "@ark/attest";
import type { Observable } from "@legendapp/state";
import { test } from "vite-plus/test";
import type { WindowState } from "./document.types";
import type { Result } from "./model";
import type { Canvas } from "./state.types";

test("canvas resize accepts an optional ID, dimensions, and a relative change", () => {
  attest<
    {
      window?: string;
      width?: number;
      height?: number;
      by?: { x: number; y: number; unit?: "step" | "largeStep" };
    },
    Parameters<Canvas["actions"]["resizeWindow"]["run"]>[0]
  >();
  attest<Observable<WindowState>, Canvas["inputs"]["resizeWindow"]["infer"]["window"]>();
  attest<Result<null>, Awaited<ReturnType<Canvas["commands"]["resizeWindow"]["run"]>>>();
});
