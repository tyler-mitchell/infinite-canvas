"use client";

import { type ReactNode } from "react";

import { InfiniteCanvasVisibilityHud } from "./visibility-devtools";
import { InfiniteCanvasVisibilityProvider } from "./visibility";
import { InfiniteCanvasWindowFrustumProbeLayer } from "./visibility-probes";

type InfiniteCanvasDiagnosticsPolicy = Readonly<{
  frustum: boolean;
}>;

type InfiniteCanvasDiagnosticsPolicyInput =
  | boolean
  | Partial<InfiniteCanvasDiagnosticsPolicy>
  | undefined;

const DEFAULT_INFINITE_CANVAS_DIAGNOSTICS: InfiniteCanvasDiagnosticsPolicy = {
  frustum: false,
};

function resolveInfiniteCanvasDiagnosticsPolicy(
  input?: InfiniteCanvasDiagnosticsPolicyInput,
): InfiniteCanvasDiagnosticsPolicy {
  if (input === undefined || input === false) {
    return DEFAULT_INFINITE_CANVAS_DIAGNOSTICS;
  }

  if (input === true) {
    return {
      ...DEFAULT_INFINITE_CANVAS_DIAGNOSTICS,
      frustum: true,
    };
  }

  return {
    ...DEFAULT_INFINITE_CANVAS_DIAGNOSTICS,
    ...input,
  };
}

function InfiniteCanvasDiagnosticsProvider({
  children,
  policy,
}: Readonly<{
  children: ReactNode;
  policy: InfiniteCanvasDiagnosticsPolicy;
}>) {
  if (!policy.frustum) {
    return <>{children}</>;
  }

  return <InfiniteCanvasVisibilityProvider>{children}</InfiniteCanvasVisibilityProvider>;
}

function InfiniteCanvasDiagnosticsWebGpuLayer({
  policy,
}: Readonly<{
  policy: InfiniteCanvasDiagnosticsPolicy;
}>) {
  return policy.frustum ? <InfiniteCanvasWindowFrustumProbeLayer /> : null;
}

function InfiniteCanvasDiagnosticsOverlay({
  policy,
}: Readonly<{
  policy: InfiniteCanvasDiagnosticsPolicy;
}>) {
  return policy.frustum ? <InfiniteCanvasVisibilityHud /> : null;
}

export {
  DEFAULT_INFINITE_CANVAS_DIAGNOSTICS,
  InfiniteCanvasDiagnosticsOverlay,
  InfiniteCanvasDiagnosticsProvider,
  InfiniteCanvasDiagnosticsWebGpuLayer,
  resolveInfiniteCanvasDiagnosticsPolicy,
};

export type { InfiniteCanvasDiagnosticsPolicy, InfiniteCanvasDiagnosticsPolicyInput };
