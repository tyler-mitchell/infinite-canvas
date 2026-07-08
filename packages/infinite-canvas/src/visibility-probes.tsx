"use client";

import { updateFrustum, useFrame } from "@react-three/fiber/webgpu";
import { useEffect, useMemo } from "react";
import * as THREE from "three";

import { useInfiniteCanvasState } from "./store";
import type { InfiniteCanvasWindow } from "./types";
import { useInfiniteCanvasVisibilityContext } from "./visibility";

function InfiniteCanvasWindowFrustumProbeLayer<Kind extends string>() {
  const state = useInfiniteCanvasState<Kind>();
  const visibility = useInfiniteCanvasVisibilityContext();
  // This layer re-renders on every camera tick, so both of these have to be memoized on
  // the window list rather than rebuilt per render. Unmemoized, `probeWindowIds` was a
  // fresh array each frame, which re-fired the retain effect on every pan step — a
  // full sweep of the tracked set, every frame, inside the one subsystem that exists to
  // measure frame cost. The reducers return the identical `state.windows` array when
  // nothing changed, which is what makes this hold across a pan.
  const probeWindows = useMemo(
    () => state.windows.filter(isWindowFrustumProbeEligible),
    [state.windows],
  );
  const probeWindowIds = useMemo(() => probeWindows.map((window) => window.id), [probeWindows]);

  useEffect(() => {
    visibility.retainWindows(probeWindowIds);
  }, [probeWindowIds, visibility]);

  useFrame(({ camera, frustum }) => {
    updateFrustum(camera, frustum);
    visibility.markWindowsFramed(getWindowFrustumVisibilityEntries(frustum, probeWindows));
  });

  return null;
}

function getWindowFrustumVisibilityEntries<Kind extends string>(
  frustum: THREE.Frustum,
  windows: readonly InfiniteCanvasWindow<Kind>[],
) {
  return windows.map((window) => ({
    isFramed: isWindowInsideFrustum(frustum, window),
    windowId: window.id,
  }));
}

function isWindowInsideFrustum<Kind extends string>(
  frustum: THREE.Frustum,
  window: InfiniteCanvasWindow<Kind>,
) {
  return frustum.intersectsBox(getWindowFrustumBox(window));
}

function getWindowFrustumBox<Kind extends string>(window: InfiniteCanvasWindow<Kind>) {
  return new THREE.Box3(
    new THREE.Vector3(window.rect.x, -(window.rect.y + window.rect.height), -1),
    new THREE.Vector3(window.rect.x + window.rect.width, -window.rect.y, 1),
  );
}

function isWindowFrustumProbeEligible(window: Pick<InfiniteCanvasWindow, "mode">) {
  return window.mode !== "minimized";
}

export {
  InfiniteCanvasWindowFrustumProbeLayer,
  getWindowFrustumBox,
  getWindowFrustumVisibilityEntries,
  isWindowFrustumProbeEligible,
  isWindowInsideFrustum,
};
