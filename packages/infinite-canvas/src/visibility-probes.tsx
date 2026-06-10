"use client";

import { updateFrustum, useFrame } from "@react-three/fiber/webgpu";
import { useEffect } from "react";
import * as THREE from "three";

import { useInfiniteCanvasState } from "./store";
import type { InfiniteCanvasWindow } from "./types";
import { useInfiniteCanvasVisibilityContext } from "./visibility";

function InfiniteCanvasWindowFrustumProbeLayer<Kind extends string>() {
  const state = useInfiniteCanvasState<Kind>();
  const visibility = useInfiniteCanvasVisibilityContext();
  const probeWindows = state.windows.filter(isWindowFrustumProbeEligible);
  const probeWindowIds = probeWindows.map((window) => window.id);

  useEffect(() => {
    visibility.pruneWindows(probeWindowIds);
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
