"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { shaderMaterial } from "@react-three/drei";
import { Canvas, extend, useFrame, useThree } from "@react-three/fiber";
import { motion, useAnimationFrame, useMotionValue } from "motion/react";
import { Vector2, Vector4 } from "three";

const maxInfluenceRects = 8;
const maxPulses = 6;
const nodeSize = 132;
const initialNodeSize = 132;
const targetFrameRate = 60;
const targetFrameMs = 1000 / targetFrameRate;

const gridMotionConfig = {
  hoverAnchorEase: 0.2,
  hoverEase: 0.18,
  hoverSnapResetDistance: 96,
  latticeStep: 40,
  rectStrengthEase: 0.15,
  rectVelocityDamping: 0.75,
  rectVelocityGain: 0.08,
} as const;

const connectionVisualConfig = {
  elbowRadius: 28,
  horizontalBend: 0.06,
  routeRadius: 34,
} as const;

const frameRatioFromSeconds = (deltaSeconds: number) =>
  Math.min(Math.max(deltaSeconds * targetFrameRate, 0), 2.5);
const frameRatioFromMilliseconds = (deltaMs: number) =>
  Math.min(Math.max(deltaMs / targetFrameMs, 0), 2.5);
const frameAlpha = (alpha: number, frameRatio: number) => 1 - (1 - alpha) ** frameRatio;
const frameDamping = (damping: number, frameRatio: number) => damping ** frameRatio;
const snapToGrid = (value: number) =>
  Math.round(value / gridMotionConfig.latticeStep) * gridMotionConfig.latticeStep;

type GridNode = Readonly<{
  height: number;
  id: string;
  width: number;
  x: number;
  y: number;
}>;

type PointerState = {
  active: boolean;
  x: number;
  y: number;
};

type ClientPointEvent = Pick<
  React.MouseEvent<HTMLElement> | React.PointerEvent<HTMLElement>,
  "clientX" | "clientY"
>;

type Point = Readonly<{
  x: number;
  y: number;
}>;

type CubicPathSegment = Readonly<{
  c1: Point;
  c2: Point;
  end: Point;
  type: "cubic";
}>;

type LinePathSegment = Readonly<{
  end: Point;
  type: "line";
}>;

type PulseState = Readonly<{
  id: number;
  intensity: number;
  startTime: number;
  x: number;
  y: number;
}>;

type RoutedConnection = Readonly<{
  segments: readonly (CubicPathSegment | LinePathSegment)[];
  start: Point;
}>;

type VelocitySample = Readonly<{
  t: number;
  x: number;
  y: number;
}>;

type FieldRectState = {
  height: number;
  id: string;
  strength: number;
  targetHeight: number;
  targetStrength: number;
  targetWidth: number;
  targetX: number;
  targetY: number;
  velocityHeight: number;
  velocityWidth: number;
  velocityX: number;
  velocityY: number;
  width: number;
  x: number;
  y: number;
};

type DragSession = {
  originX: number;
  originY: number;
  offsetX: number;
  offsetY: number;
  pointerId: number;
  started: boolean;
};

type MomentumState = {
  bouncedX: boolean;
  bouncedY: boolean;
  vx: number;
  vy: number;
};

type NodeBounds = Readonly<{
  maxX: number;
  maxY: number;
  minX: number;
  minY: number;
}>;

type PulseRequest = Readonly<{
  intensity: number;
  x: number;
  y: number;
}>;

const initialNodes: readonly GridNode[] = [
  { height: initialNodeSize, id: "grid-node-a", width: initialNodeSize, x: 72, y: 48 },
  { height: initialNodeSize, id: "grid-node-b", width: initialNodeSize, x: 48, y: 300 },
  { height: initialNodeSize, id: "grid-node-c", width: initialNodeSize, x: 300, y: 466 },
  { height: initialNodeSize, id: "grid-node-d", width: initialNodeSize, x: 456, y: 78 },
] as const;

const panelMotionConfig = {
  baseFriction: 0.975,
  bounceDamping: 0.45,
  bounceFrictionBoost: 0.85,
  boundaryMargin: 8,
  dragScale: 1.018,
  dragShadowBlur: 40,
  dragShadowOpacity: 0.55,
  dragShadowSpread: -8,
  dragShadowY: 32,
  highSpeedFriction: 0.94,
  idleShadowBlur: 24,
  idleShadowOpacity: 0.25,
  idleShadowSpread: -12,
  idleShadowY: 24,
  maxVelocity: 40,
  minVelocity: 0.15,
  momentumThreshold: 1.5,
  panelWidth: 280,
  soundEnabled: true,
  soundMaxVolume: 0.15,
  soundMinVolume: 0.015,
  velocitySampleCount: 6,
} as const;

const panelTransition = {
  duration: 0.15,
  ease: [0.4, 0, 0.2, 1],
} as const;

const connectionPairs: readonly (readonly [string, string])[] = [
  ["grid-node-a", "grid-node-d"],
  ["grid-node-b", "grid-node-c"],
] as const;

const replaceNodePosition = (nodes: readonly GridNode[], id: string, x: number, y: number) =>
  nodes.map((node) =>
    node.id === id
      ? {
          ...node,
          x,
          y,
        }
      : node,
  );

const nodeBounds = (
  containerRef: React.RefObject<HTMLDivElement | null>,
  width: number,
  height: number,
): NodeBounds => {
  const rect = containerRef.current?.getBoundingClientRect();
  const viewportWidth = rect?.width ?? window.innerWidth;
  const viewportHeight = rect?.height ?? window.innerHeight;

  return {
    maxX: Math.max(
      panelMotionConfig.boundaryMargin,
      viewportWidth - width - panelMotionConfig.boundaryMargin,
    ),
    maxY: Math.max(
      panelMotionConfig.boundaryMargin,
      viewportHeight - height - panelMotionConfig.boundaryMargin,
    ),
    minX: panelMotionConfig.boundaryMargin,
    minY: panelMotionConfig.boundaryMargin,
  };
};

const clampNodePosition = (x: number, y: number, bounds: NodeBounds): Point => ({
  x: Math.max(bounds.minX, Math.min(bounds.maxX, x)),
  y: Math.max(bounds.minY, Math.min(bounds.maxY, y)),
});

const appendVelocitySample = (
  samples: readonly VelocitySample[],
  x: number,
  y: number,
  t: number,
) =>
  [
    ...samples,
    {
      t,
      x,
      y,
    },
  ].slice(-panelMotionConfig.velocitySampleCount);

const calculatePanelVelocity = (samples: readonly VelocitySample[], now: number): Point => {
  if (samples.length < 2 || now - samples[samples.length - 1].t > 80) {
    return {
      x: 0,
      y: 0,
    };
  }

  const weighted = samples.slice(1).reduce(
    (result, sample, index) => {
      const previous = samples[index];
      const elapsed = sample.t - previous.t;

      if (now - sample.t > 80 || elapsed < 8 || elapsed >= 100) {
        return result;
      }

      const weight = (index + 1) / samples.length;

      return {
        total: result.total + weight,
        x: result.x + ((sample.x - previous.x) / elapsed) * targetFrameMs * weight,
        y: result.y + ((sample.y - previous.y) / elapsed) * targetFrameMs * weight,
      };
    },
    {
      total: 0,
      x: 0,
      y: 0,
    },
  );

  if (weighted.total === 0) {
    return {
      x: 0,
      y: 0,
    };
  }

  return {
    x: weighted.x / weighted.total,
    y: weighted.y / weighted.total,
  };
};

const clampPanelVelocity = ({ x, y }: Point) => {
  const speed = Math.hypot(x, y);

  if (speed <= panelMotionConfig.maxVelocity) {
    return {
      vx: x,
      vy: y,
    };
  }

  const scale = panelMotionConfig.maxVelocity / speed;

  return {
    vx: x * scale,
    vy: y * scale,
  };
};

const stepPanelMomentum = ({
  bounds,
  frameRatio,
  momentum,
  node,
  position,
}: Readonly<{
  bounds: NodeBounds;
  frameRatio: number;
  momentum: MomentumState;
  node: GridNode;
  position: Point;
}>) => {
  const speedRatio = Math.min(
    Math.hypot(momentum.vx, momentum.vy) / panelMotionConfig.maxVelocity,
    1,
  );
  const friction =
    panelMotionConfig.baseFriction -
    speedRatio * (panelMotionConfig.baseFriction - panelMotionConfig.highSpeedFriction);
  const xFriction = momentum.bouncedX ? panelMotionConfig.bounceFrictionBoost : 1;
  const yFriction = momentum.bouncedY ? panelMotionConfig.bounceFrictionBoost : 1;
  let vx = momentum.vx * frameDamping(friction * xFriction, frameRatio);
  let vy = momentum.vy * frameDamping(friction * yFriction, frameRatio);
  let nextX = position.x + vx * frameRatio;
  let nextY = position.y + vy * frameRatio;
  let bouncedX = false;
  let bouncedY = false;
  let pulses: readonly PulseRequest[] = [];
  const speed = Math.hypot(vx, vy);
  const bounceIntensity = Math.min(speed / panelMotionConfig.maxVelocity, 1);

  if (nextX < bounds.minX) {
    nextX = bounds.minX;
    vx = Math.abs(vx) * panelMotionConfig.bounceDamping;
    bouncedX = true;
    pulses = [
      ...pulses,
      {
        intensity: Math.max(0.22, bounceIntensity),
        x: nextX,
        y: nextY + node.height / 2,
      },
    ];
  } else if (nextX > bounds.maxX) {
    nextX = bounds.maxX;
    vx = -Math.abs(vx) * panelMotionConfig.bounceDamping;
    bouncedX = true;
    pulses = [
      ...pulses,
      {
        intensity: Math.max(0.22, bounceIntensity),
        x: nextX + node.width,
        y: nextY + node.height / 2,
      },
    ];
  }

  if (nextY < bounds.minY) {
    nextY = bounds.minY;
    vy = Math.abs(vy) * panelMotionConfig.bounceDamping;
    bouncedY = true;
    pulses = [
      ...pulses,
      {
        intensity: Math.max(0.22, bounceIntensity),
        x: nextX + node.width / 2,
        y: nextY,
      },
    ];
  } else if (nextY > bounds.maxY) {
    nextY = bounds.maxY;
    vy = -Math.abs(vy) * panelMotionConfig.bounceDamping;
    bouncedY = true;
    pulses = [
      ...pulses,
      {
        intensity: Math.max(0.22, bounceIntensity),
        x: nextX + node.width / 2,
        y: nextY + node.height,
      },
    ];
  }

  const nextMomentum =
    Math.hypot(vx, vy) <= panelMotionConfig.minVelocity
      ? null
      : {
          bouncedX,
          bouncedY,
          vx,
          vy,
        };

  return {
    momentum: nextMomentum,
    position: {
      x: nextX,
      y: nextY,
    },
    pulses,
  };
};

function panelShadow({
  blur,
  opacity,
  spread,
  y,
}: Readonly<{ blur: number; opacity: number; spread: number; y: number }>) {
  return `0 ${y}px ${blur}px ${spread}px rgba(0, 0, 0, ${opacity})`;
}

const idlePanelShadow = panelShadow({
  blur: panelMotionConfig.idleShadowBlur,
  opacity: panelMotionConfig.idleShadowOpacity,
  spread: panelMotionConfig.idleShadowSpread,
  y: panelMotionConfig.idleShadowY,
});

const dragPanelShadow = panelShadow({
  blur: panelMotionConfig.dragShadowBlur,
  opacity: panelMotionConfig.dragShadowOpacity,
  spread: panelMotionConfig.dragShadowSpread,
  y: panelMotionConfig.dragShadowY,
});

const vertexShader = `
varying vec2 vUv;

void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const fragmentShader = `
precision highp float;

#define MAX_RECTS 8
#define MAX_PULSES 6

uniform vec2 uResolution;
uniform float uDpr;
uniform float uTime;
uniform vec2 uPointer;
uniform float uPointerActive;
uniform vec2 uHoverGrid;
uniform vec4 uRects[MAX_RECTS];
uniform float uRectStrengths[MAX_RECTS];
uniform vec4 uPulses[MAX_PULSES];

varying vec2 vUv;

float sat(float value) {
  return clamp(value, 0.0, 1.0);
}

float random(vec2 st) {
  return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
}

float rectDistance(vec2 point, vec4 rect) {
  vec2 minCorner = rect.xy;
  vec2 maxCorner = rect.xy + rect.zw;
  vec2 closest = clamp(point, minCorner, maxCorner);
  return length(point - closest);
}

vec2 rectForce(vec2 point, vec4 rect, float strength) {
  if (strength <= 0.001 || rect.z <= 0.0 || rect.w <= 0.0) {
    return vec2(0.0);
  }

  vec2 minCorner = rect.xy;
  vec2 maxCorner = rect.xy + rect.zw;
  vec2 closest = clamp(point, minCorner, maxCorner);
  vec2 delta = point - closest;
  float distanceToRect = length(delta);
  float radius = min(distanceToRect / 420.0, 1.0);
  float forceMagnitude = distanceToRect > 0.0 ? pow(1.0 - radius, 2.05) * 10.5 : 0.0;

  return distanceToRect > 0.0 ? normalize(delta) * forceMagnitude * strength : vec2(0.0);
}

float nearestRectDistance(vec2 point) {
  float nearest = 100000.0;

  for (int index = 0; index < MAX_RECTS; index++) {
    float strength = uRectStrengths[index];
    vec4 rect = uRects[index];

    if (strength > 0.001 && rect.z > 0.0 && rect.w > 0.0) {
      nearest = min(nearest, rectDistance(point, rect));
    }
  }

  return nearest;
}

vec2 fieldForce(vec2 point) {
  vec2 force = vec2(0.0);

  for (int index = 0; index < MAX_RECTS; index++) {
    force += rectForce(point, uRects[index], uRectStrengths[index]);
  }

  float forceLength = length(force);

  return forceLength > 18.0 ? normalize(force) * 18.0 : force;
}

float pulseField(vec2 point) {
  float field = 0.0;

  for (int index = 0; index < MAX_PULSES; index++) {
    vec4 pulse = uPulses[index];
    float ageMs = pulse.z;
    float intensity = pulse.w;

    if (intensity > 0.001 && ageMs >= 0.0 && ageMs <= 2000.0) {
      float amp = 0.5 + intensity * 0.5;
      float radius = (ageMs / 1000.0) * (amp * 400.0);
      float halfWidth = amp * 80.0;
      float ringDistance = abs(length(point - pulse.xy) - radius);

      if (ringDistance < halfWidth) {
        float contribution =
          (1.0 - ringDistance / halfWidth) * (1.0 - ageMs / 2000.0) * intensity;
        field = max(field, contribution);
      }
    }
  }

  return field;
}

float mouseField(vec2 point) {
  float distanceToPointer = length(point - uPointer);

  if (uPointerActive <= 0.001 || distanceToPointer > 90.0) {
    return 0.0;
  }

  return pow(1.0 - distanceToPointer / 90.0, 2.0) * 0.22 * uPointerActive;
}

float lineMask(float distanceToLine, float width) {
  return 1.0 - smoothstep(width, width + 1.1, distanceToLine);
}

float hoverLineIllumination(vec2 point, vec2 warpedPoint) {
  if (uPointerActive <= 0.001) {
    return 0.0;
  }

  vec2 pointerOffset = point - uPointer;
  float beamDistance = length(pointerOffset / vec2(1.08, 0.9));
  float beam = pow(1.0 - smoothstep(18.0, 132.0, beamDistance), 1.62);
  float core = pow(1.0 - smoothstep(10.0, 54.0, length(pointerOffset)), 1.4);
  vec2 nearestPointerGrid = round(warpedPoint / 40.0) * 40.0;
  float pointerGridDistance = length(warpedPoint - nearestPointerGrid);
  float intersectionCatch = (1.0 - smoothstep(0.8, 3.0, pointerGridDistance)) * beam;

  return sat(beam * 0.78 + core * 0.12 + intersectionCatch * 0.1) * uPointerActive;
}

float hoverIntersection(vec2 point, vec2 warpedPoint) {
  if (uPointerActive <= 0.001) {
    return 0.0;
  }

  vec2 nearestHoverGrid = round(warpedPoint / 40.0) * 40.0;
  float distanceToHoverGrid = length(warpedPoint - nearestHoverGrid);
  vec2 pointerOffset = point - uPointer;
  float hoverExtent = pow(
    1.0 - smoothstep(20.0, 126.0, length(pointerOffset / vec2(1.08, 0.9))),
    1.45
  );
  float dot = 1.0 - smoothstep(0.58, 1.5, distanceToHoverGrid);

  return dot * hoverExtent * uPointerActive;
}

vec3 hoverSpotlight(vec2 point, vec2 warpedPoint) {
  if (uPointerActive <= 0.001) {
    return vec3(0.0);
  }

  vec2 pointerOffset = point - uPointer;
  vec2 ellipticalPointer = pointerOffset / vec2(1.1, 0.9);
  float radial = 1.0 - smoothstep(20.0, 148.0, length(ellipticalPointer));
  float core = 1.0 - smoothstep(12.0, 58.0, length(pointerOffset));
  float light = pow(radial, 1.74);
  float lineLight = light * (0.7 + core * 0.3);
  float dotLight = pow(light, 1.26) * (0.82 + core * 0.2);
  float glintLight = pow(core, 1.8) * 0.62 + pow(light, 2.4) * 0.22;

  return vec3(lineLight, dotLight, glintLight) * uPointerActive;
}

void main() {
  vec2 frag = vec2(gl_FragCoord.x / uDpr, (uResolution.y - gl_FragCoord.y) / uDpr);
  vec2 force = fieldForce(frag);
  vec2 warped = frag - force;
  float gridStep = 40.0;
  vec2 nearestGrid = round(warped / gridStep) * gridStep;
  float dotDistance = length(warped - nearestGrid);
  float verticalDistance = abs(warped.x - nearestGrid.x);
  float horizontalDistance = abs(warped.y - nearestGrid.y);
  float nearestDistance = nearestRectDistance(nearestGrid);
  float rectNear110 = 1.0 - pow(min(nearestDistance / 110.0, 1.0), 2.0);
  float rectNear400 = 1.0 - min(nearestDistance / 400.0, 1.0);
  float pulse = pulseField(frag);
  float pointer = mouseField(frag);
  float hoverLight = hoverLineIllumination(frag, warped);
  float hoverDot = hoverIntersection(frag, warped);
  vec3 spotlight = hoverSpotlight(frag, warped);
  float spotlightLine = spotlight.x;
  float spotlightDot = spotlight.y;
  float spotlightGlint = spotlight.z;
  float dynamicSignal = max(max(pulse, pointer * 0.72), max(hoverLight * 0.38, hoverDot * 0.28));
  float verticalFade = 1.0 - smoothstep(uResolution.y / uDpr * 0.7, uResolution.y / uDpr * 1.08, frag.y);
  float edgeFade =
    smoothstep(0.0, 92.0, frag.x) *
    smoothstep(0.0, 82.0, frag.y) *
    smoothstep(0.0, 150.0, uResolution.x / uDpr - frag.x);
  float largeCellNoise = random(floor((frag + vec2(31.0, 79.0)) / 180.0));
  float mediumCellNoise = random(floor((frag + vec2(97.0, 17.0)) / 80.0));
  float fieldTexture = 0.72 + largeCellNoise * 0.18 + mediumCellNoise * 0.1;
  float fieldVisibility =
    clamp((verticalFade * edgeFade * 1.14 * fieldTexture) + dynamicSignal * 0.46, 0.0, 1.0);
  float sparseSeed = random(nearestGrid * 0.037 + vec2(3.7, 8.1));
  float sparseDot = (0.58 + pow(sparseSeed, 0.72) * 0.42) * (0.86 + mediumCellNoise * 0.22);
  float dotShimmer =
    0.9 + sin(uTime * (0.74 + sparseSeed * 1.2) + sparseSeed * 6.2831853) * 0.1;
  float targetDotSize = 0.42 + sin(min(nearestDistance / 320.0, 1.0) * 3.14159265) * 0.62;
  float dotRadius = max(0.42, mix(0.52, targetDotSize, sat(rectNear400 + dynamicSignal)));
  float dotMask = 1.0 - smoothstep(dotRadius, dotRadius + 1.0, dotDistance);
  float lineDistance = min(verticalDistance, horizontalDistance);
  vec2 nearestHalfGrid = round(warped / 20.0) * 20.0;
  float halfLineDistance =
    min(abs(warped.x - nearestHalfGrid.x), abs(warped.y - nearestHalfGrid.y));
  float hoverLineSignal = max(hoverLight * 0.88, spotlightLine * 0.18);
  float hoverDotSignal = max(hoverDot * 0.86, spotlightDot);
  float litFieldVisibility = clamp(fieldVisibility + hoverLineSignal * 0.33, 0.0, 1.0);
  float litDotVisibility = clamp(fieldVisibility + hoverDotSignal * 0.62, 0.0, 1.0);
  float halfLineCore = lineMask(halfLineDistance, 0.08);
  float majorLineCore = lineMask(lineDistance, 0.32 + dynamicSignal * 0.5);
  float baseLineAlpha =
    (0.0045 + (1.0 - min(nearestDistance / 400.0, 1.0)) * 0.028) *
    (0.82 + largeCellNoise * 0.24);
  float lineAlpha =
    majorLineCore *
    max(baseLineAlpha + hoverLineSignal * 0.041 + spotlightGlint * 0.011, dynamicSignal * 0.18) *
    litFieldVisibility;
  float halfLineAlpha =
    halfLineCore *
    (0.005 + hoverLineSignal * 0.0034) *
    (1.0 - dotMask * 0.78) *
    litFieldVisibility;
  float dotAlpha =
    dotMask *
    sparseDot *
    (0.5 + rectNear110 * 0.5 + dynamicSignal * 0.24 + hoverDotSignal * 0.64 + spotlightGlint * 0.2) *
    dotShimmer * litDotVisibility;
  float dotChannel = (146.0 + rectNear110 * 109.0) / 255.0;
  vec3 base = vec3(0.086, 0.086, 0.082);
  float vignette = smoothstep(0.95, 0.25, length(vUv - 0.5));
  base *= 0.86 + vignette * 0.18;
  float fineGrain =
    random((frag / max(uResolution / uDpr, vec2(1.0))) * 1000.0 + uTime * 0.1) - 0.5;
  float coarseGrain = random(floor((frag + uTime * 5.0) / 3.0)) - 0.5;
  float grain = (fineGrain * 0.019 + coarseGrain * 0.006) * (0.46 + verticalFade * 0.54);
  vec3 greyLine = vec3(0.68);
  vec3 blueLine = vec3(0.145, 0.388 + dynamicSignal * 0.235, 0.922);
  vec3 lineColor = mix(greyLine, blueLine, sat(dynamicSignal * 1.35 + hoverLineSignal * 1.44));
  vec3 dotColor = mix(vec3(dotChannel), vec3(0.82, 0.92, 1.0), sat(dynamicSignal * 0.42 + hoverDotSignal * 0.7));
  vec3 color = base;

  color = mix(color, greyLine, sat(halfLineAlpha));
  color = mix(color, lineColor, sat(lineAlpha));
  color = mix(color, dotColor, sat(dotAlpha));
  color += vec3(0.045, 0.14, 0.34) * hoverLineSignal * max(majorLineCore, halfLineCore) * 0.2;
  color += vec3(0.2, 0.4, 0.86) * hoverDot * 0.2;
  color += vec3(grain);

  gl_FragColor = vec4(color, 1.0);
}
`;

const DynamicGridMaterial = shaderMaterial(
  {
    uDpr: 1,
    uHoverGrid: new Vector2(-9999, -9999),
    uPointer: new Vector2(-9999, -9999),
    uPointerActive: 0,
    uPulses: Array.from({ length: maxPulses }, () => new Vector4(-9999, -9999, 9999, 0)),
    uRectStrengths: Array.from({ length: maxInfluenceRects }, () => 0),
    uRects: Array.from({ length: maxInfluenceRects }, () => new Vector4(-9999, -9999, 0, 0)),
    uResolution: new Vector2(1, 1),
    uTime: 0,
  },
  vertexShader,
  fragmentShader,
);
const DynamicGridMaterialElement = extend(DynamicGridMaterial);
type DynamicGridMaterialInstance = InstanceType<typeof DynamicGridMaterial>;

function useDynamicGridPointer(containerRef: React.RefObject<HTMLDivElement | null>) {
  const pointerRef = useRef<PointerState>({ active: false, x: -9999, y: -9999 });

  const updatePointer = useCallback(
    (event: ClientPointEvent) => {
      const rect = containerRef.current?.getBoundingClientRect();

      if (!rect) return;

      pointerRef.current = {
        active: true,
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      };
    },
    [containerRef],
  );

  const clearPointer = useCallback(() => {
    pointerRef.current = {
      ...pointerRef.current,
      active: false,
    };
  }, []);

  return {
    clearPointer,
    pointerRef,
    updatePointer,
  } as const;
}

function useDynamicGridPulseModel() {
  const pulsesRef = useRef<readonly PulseState[]>([]);
  const nextPulseId = useRef(1);

  const addPulse = useCallback((x: number, y: number, intensity: number) => {
    const pulse: PulseState = {
      id: nextPulseId.current++,
      intensity,
      startTime: performance.now(),
      x,
      y,
    };

    pulsesRef.current = [...pulsesRef.current.slice(-maxPulses + 1), pulse];
  }, []);

  return {
    addPulse,
    pulsesRef,
  } as const;
}

function useDynamicGridNodeModel(containerRef: React.RefObject<HTMLDivElement | null>) {
  const nodesRef = useRef<readonly GridNode[]>(initialNodes);
  const renderFrameRef = useRef<number | null>(null);
  const nextNodeId = useRef(1);
  const [nodes, setNodes] = useState<readonly GridNode[]>(initialNodes);

  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  useEffect(
    () => () => {
      if (renderFrameRef.current !== null) {
        cancelAnimationFrame(renderFrameRef.current);
      }
    },
    [],
  );

  const publishNodesForRender = useCallback(() => {
    if (renderFrameRef.current !== null) return;

    renderFrameRef.current = requestAnimationFrame(() => {
      renderFrameRef.current = null;
      setNodes(nodesRef.current);
    });
  }, []);

  const commitNodesForRender = useCallback((next: readonly GridNode[]) => {
    if (renderFrameRef.current !== null) {
      cancelAnimationFrame(renderFrameRef.current);
      renderFrameRef.current = null;
    }

    nodesRef.current = next;
    setNodes(next);
  }, []);

  const createNode = useCallback(
    (x: number, y: number) => {
      const bounds = nodeBounds(containerRef, nodeSize, nodeSize);
      const position = clampNodePosition(x - nodeSize / 2, y - nodeSize / 2, bounds);
      const node: GridNode = {
        height: nodeSize,
        id: `grid-node-${nextNodeId.current++}`,
        width: nodeSize,
        x: position.x,
        y: position.y,
      };

      commitNodesForRender([...nodesRef.current.slice(-(maxInfluenceRects - 1)), node]);
    },
    [commitNodesForRender, containerRef],
  );

  const updateNodePosition = useCallback(
    (id: string, x: number, y: number) => {
      nodesRef.current = replaceNodePosition(nodesRef.current, id, x, y);
      publishNodesForRender();
    },
    [publishNodesForRender],
  );

  const commitNodePosition = useCallback(
    (id: string, x: number, y: number) => {
      commitNodesForRender(replaceNodePosition(nodesRef.current, id, x, y));
    },
    [commitNodesForRender],
  );

  return {
    commitNodePosition,
    createNode,
    nodes,
    nodesRef,
    updateNodePosition,
  } as const;
}

function InfiniteCanvasDynamicGridExperiment() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { clearPointer, pointerRef, updatePointer } = useDynamicGridPointer(containerRef);
  const { addPulse, pulsesRef } = useDynamicGridPulseModel();
  const { commitNodePosition, createNode, nodes, nodesRef, updateNodePosition } =
    useDynamicGridNodeModel(containerRef);

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.target !== event.currentTarget) return;

      updatePointer(event);
      createNode(pointerRef.current.x, pointerRef.current.y);
    },
    [createNode, updatePointer],
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      updatePointer(event);
    },
    [updatePointer],
  );

  const handleMouseMove = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      updatePointer(event);
    },
    [updatePointer],
  );

  return (
    <main
      ref={containerRef}
      className="relative h-full min-h-[calc(100svh-var(--header-height))] overflow-hidden bg-[#171717] text-white"
      onPointerDown={handlePointerDown}
      onPointerLeave={clearPointer}
      onPointerMove={handlePointerMove}
      onMouseMove={handleMouseMove}
    >
      <DynamicGridBackdrop nodesRef={nodesRef} pointerRef={pointerRef} pulsesRef={pulsesRef} />
      <GridConnections nodes={nodes} />
      <GridNodeLayer
        containerRef={containerRef}
        nodes={nodes}
        onPointerActivity={updatePointer}
        onPositionChange={updateNodePosition}
        onPositionCommit={commitNodePosition}
        onPulse={addPulse}
      />
    </main>
  );
}

function DynamicGridBackdrop({
  nodesRef,
  pointerRef,
  pulsesRef,
}: Readonly<{
  nodesRef: React.RefObject<readonly GridNode[]>;
  pointerRef: React.RefObject<PointerState>;
  pulsesRef: React.RefObject<readonly PulseState[]>;
}>) {
  return (
    <div className="pointer-events-none absolute inset-0">
      <Canvas
        orthographic
        camera={{ position: [0, 0, 1], zoom: 1 }}
        dpr={[1, 2]}
        background="#171717"
        style={{
          height: "100%",
          pointerEvents: "none",
          width: "100%",
        }}
      >
        <DynamicGridShader nodesRef={nodesRef} pointerRef={pointerRef} pulsesRef={pulsesRef} />
      </Canvas>
    </div>
  );
}

const nodeCenter = (node: GridNode): Point => ({
  x: node.x + node.width / 2,
  y: node.y + node.height / 2,
});

const pointCommand = ({ x, y }: Point) => `${x.toFixed(1)} ${y.toFixed(1)}`;

const routeToPath = ({ segments, start }: RoutedConnection) =>
  [
    `M ${pointCommand(start)}`,
    ...segments.map((segment) =>
      segment.type === "line"
        ? `L ${pointCommand(segment.end)}`
        : `C ${pointCommand(segment.c1)}, ${pointCommand(segment.c2)}, ${pointCommand(segment.end)}`,
    ),
  ].join(" ");

function horizontalConnectionRoute(fromNode: GridNode, toNode: GridNode): RoutedConnection {
  const fromCenter = nodeCenter(fromNode);
  const toCenter = nodeCenter(toNode);
  const start = {
    x: fromNode.x + fromNode.width,
    y: fromCenter.y,
  };
  const end = {
    x: toNode.x,
    y: toCenter.y,
  };
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const controlOffset = Math.max(44, dx * 0.42);
  const bendY = dy * connectionVisualConfig.horizontalBend;

  return {
    segments: [
      {
        c1: {
          x: start.x + controlOffset,
          y: start.y + bendY,
        },
        c2: {
          x: end.x - controlOffset,
          y: end.y - bendY,
        },
        end,
        type: "cubic",
      },
    ],
    start,
  };
}

function downwardConnectionRoute(fromNode: GridNode, toNode: GridNode): RoutedConnection {
  const fromCenter = nodeCenter(fromNode);
  const toCenter = nodeCenter(toNode);
  const start = {
    x: fromNode.x + fromNode.width,
    y: fromCenter.y,
  };
  const end = {
    x: toCenter.x,
    y: toNode.y,
  };
  const elbowX = snapToGrid(end.x);
  const radius = connectionVisualConfig.routeRadius;

  return {
    segments: [
      {
        end: {
          x: elbowX - radius * 1.15,
          y: start.y,
        },
        type: "line",
      },
      {
        c1: {
          x: elbowX - radius * 0.52,
          y: start.y,
        },
        c2: {
          x: elbowX,
          y: start.y + radius * 0.46,
        },
        end: {
          x: elbowX,
          y: start.y + radius,
        },
        type: "cubic",
      },
      {
        c1: {
          x: elbowX,
          y: start.y + radius + 14,
        },
        c2: {
          x: elbowX,
          y: end.y - 34,
        },
        end: {
          x: elbowX,
          y: end.y,
        },
        type: "cubic",
      },
    ],
    start,
  };
}

function upwardConnectionRoute(fromNode: GridNode, toNode: GridNode): RoutedConnection {
  const fromCenter = nodeCenter(fromNode);
  const start = {
    x: fromNode.x + fromNode.width,
    y: fromCenter.y,
  };
  const end = {
    x: toNode.x + toNode.width / 2,
    y: toNode.y + toNode.height,
  };
  const radius = connectionVisualConfig.elbowRadius;

  return {
    segments: [
      {
        c1: {
          x: start.x + 44,
          y: start.y,
        },
        c2: {
          x: end.x - radius,
          y: start.y,
        },
        end: {
          x: end.x,
          y: start.y,
        },
        type: "cubic",
      },
      {
        c1: {
          x: end.x + 8,
          y: start.y,
        },
        c2: {
          x: end.x,
          y: start.y - radius,
        },
        end: {
          x: end.x,
          y: start.y - radius,
        },
        type: "cubic",
      },
      {
        end,
        type: "line",
      },
    ],
    start,
  };
}

function fallbackConnectionRoute(fromNode: GridNode, toNode: GridNode): RoutedConnection {
  const start = {
    x: fromNode.x + fromNode.width / 2,
    y: fromNode.y + fromNode.height,
  };
  const end = {
    x: toNode.x + toNode.width,
    y: toNode.y + toNode.height / 2,
  };
  const verticalMid = start.y + Math.max(34, Math.abs(end.y - start.y) * 0.52);

  return {
    segments: [
      {
        c1: {
          x: start.x,
          y: verticalMid,
        },
        c2: {
          x: end.x,
          y: end.y - 36,
        },
        end,
        type: "cubic",
      },
    ],
    start,
  };
}

function connectionPath(fromNode: GridNode, toNode: GridNode) {
  const fromCenter = nodeCenter(fromNode);
  const toCenter = nodeCenter(toNode);

  if (toNode.x > fromNode.x && Math.abs(toCenter.y - fromCenter.y) < fromNode.height * 0.85) {
    return routeToPath(horizontalConnectionRoute(fromNode, toNode));
  }

  if (toNode.y > fromNode.y) {
    return routeToPath(downwardConnectionRoute(fromNode, toNode));
  }

  if (toNode.y < fromNode.y) {
    return routeToPath(upwardConnectionRoute(fromNode, toNode));
  }

  return routeToPath(fallbackConnectionRoute(fromNode, toNode));
}

function GridConnections({ nodes }: Readonly<{ nodes: readonly GridNode[] }>) {
  const nodeById = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);

  return (
    <svg
      className="pointer-events-none absolute inset-0"
      fill="none"
      height="100%"
      preserveAspectRatio="none"
      width="100%"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="dynamic-grid-connection-core" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="rgba(59, 130, 246, 0.14)" />
          <stop offset="0.42" stopColor="rgba(0, 190, 235, 0.58)" />
          <stop offset="1" stopColor="rgba(59, 130, 246, 0.16)" />
        </linearGradient>
        <linearGradient id="dynamic-grid-connection-shine" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="rgba(0, 200, 255, 0)" />
          <stop offset="0.5" stopColor="rgba(0, 200, 255, 0.36)" />
          <stop offset="1" stopColor="rgba(0, 200, 255, 0)" />
        </linearGradient>
      </defs>
      {connectionPairs.map(([fromId, toId]) => {
        const fromNode = nodeById.get(fromId);
        const toNode = nodeById.get(toId);

        if (!fromNode || !toNode) return null;

        const path = connectionPath(fromNode, toNode);

        return (
          <g key={`${fromId}-${toId}`}>
            <path
              d={path}
              stroke="rgba(0, 190, 235, 0.04)"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="6"
            />
            <path
              d={path}
              stroke="rgba(59, 130, 246, 0.19)"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2.5"
            />
            <path
              d={path}
              stroke="url(#dynamic-grid-connection-core)"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.35"
            />
            <path
              d={path}
              stroke="url(#dynamic-grid-connection-shine)"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="0.85"
            />
          </g>
        );
      })}
    </svg>
  );
}

function GridNodeLayer({
  containerRef,
  nodes,
  onPointerActivity,
  onPositionChange,
  onPositionCommit,
  onPulse,
}: Readonly<{
  containerRef: React.RefObject<HTMLDivElement | null>;
  nodes: readonly GridNode[];
  onPointerActivity: (event: ClientPointEvent) => void;
  onPositionChange: (id: string, x: number, y: number) => void;
  onPositionCommit: (id: string, x: number, y: number) => void;
  onPulse: (x: number, y: number, intensity: number) => void;
}>) {
  return (
    <div className="pointer-events-none absolute inset-0">
      {nodes.map((node) => (
        <MotionGridNode
          key={node.id}
          containerRef={containerRef}
          node={node}
          onPointerActivity={onPointerActivity}
          onPositionChange={onPositionChange}
          onPositionCommit={onPositionCommit}
          onPulse={onPulse}
        />
      ))}
    </div>
  );
}

function MotionGridNode({
  containerRef,
  node,
  onPointerActivity,
  onPositionChange,
  onPositionCommit,
  onPulse,
}: Readonly<{
  containerRef: React.RefObject<HTMLDivElement | null>;
  node: GridNode;
  onPointerActivity: (event: ClientPointEvent) => void;
  onPositionChange: (id: string, x: number, y: number) => void;
  onPositionCommit: (id: string, x: number, y: number) => void;
  onPulse: (x: number, y: number, intensity: number) => void;
}>) {
  const x = useMotionValue(node.x);
  const y = useMotionValue(node.y);
  const dragSession = useRef<DragSession | null>(null);
  const momentum = useRef<MomentumState | null>(null);
  const position = useRef({ x: node.x, y: node.y });
  const velocitySamples = useRef<VelocitySample[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isHovering, setIsHovering] = useState(false);

  const setPosition = useCallback(
    (nextX: number, nextY: number) => {
      position.current = {
        x: nextX,
        y: nextY,
      };
      x.set(nextX);
      y.set(nextY);
      onPositionChange(node.id, nextX, nextY);
    },
    [node.id, onPositionChange, x, y],
  );

  const getBounds = useCallback(() => {
    return nodeBounds(containerRef, node.width, node.height);
  }, [containerRef, node.height, node.width]);

  const clampPosition = useCallback(
    (nextX: number, nextY: number) => {
      return clampNodePosition(nextX, nextY, getBounds());
    },
    [getBounds],
  );

  const sampleVelocity = useCallback((nextX: number, nextY: number) => {
    velocitySamples.current = appendVelocitySample(
      velocitySamples.current,
      nextX,
      nextY,
      performance.now(),
    );
  }, []);

  const calculateVelocity = useCallback(() => {
    return calculatePanelVelocity(velocitySamples.current, performance.now());
  }, []);

  const stopMomentum = useCallback(() => {
    momentum.current = null;
  }, []);

  const commitPosition = useCallback(() => {
    onPositionCommit(node.id, position.current.x, position.current.y);
  }, [node.id, onPositionCommit]);

  useEffect(
    () => () => {
      document.body.style.cursor = "";
    },
    [],
  );

  useEffect(() => {
    if (dragSession.current || momentum.current) return;

    position.current = {
      x: node.x,
      y: node.y,
    };
    x.set(node.x);
    y.set(node.y);
  }, [node.x, node.y, x, y]);

  useAnimationFrame((_, deltaMs) => {
    const activeMomentum = momentum.current;

    if (!activeMomentum) return;

    const frameRatio = frameRatioFromMilliseconds(deltaMs);
    const bounds = getBounds();
    const step = stepPanelMomentum({
      bounds,
      frameRatio,
      momentum: activeMomentum,
      node,
      position: position.current,
    });

    momentum.current = step.momentum;
    step.pulses.forEach((pulse) => onPulse(pulse.x, pulse.y, pulse.intensity));
    setPosition(step.position.x, step.position.y);

    if (!step.momentum) {
      commitPosition();
    }
  });

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      if (event.button !== 0) return;

      event.stopPropagation();
      onPointerActivity(event);
      stopMomentum();
      event.currentTarget.setPointerCapture(event.pointerId);
      document.body.style.cursor = "grabbing";

      dragSession.current = {
        offsetX: event.clientX - event.currentTarget.getBoundingClientRect().left,
        offsetY: event.clientY - event.currentTarget.getBoundingClientRect().top,
        originX: position.current.x,
        originY: position.current.y,
        pointerId: event.pointerId,
        started: false,
      };
      velocitySamples.current = [
        {
          t: performance.now(),
          x: position.current.x,
          y: position.current.y,
        },
      ];
    },
    [onPointerActivity, stopMomentum],
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      onPointerActivity(event);

      const session = dragSession.current;
      const rect = containerRef.current?.getBoundingClientRect();

      if (!session || !rect) return;

      event.preventDefault();
      event.stopPropagation();

      const rawX = event.clientX - rect.left - session.offsetX;
      const rawY = event.clientY - rect.top - session.offsetY;
      const deltaX = rawX - session.originX;
      const deltaY = rawY - session.originY;

      if (!session.started && Math.hypot(deltaX, deltaY) > 2) {
        session.started = true;
        setIsDragging(true);
      }

      if (!session.started) return;

      const adjustedX = event.shiftKey ? snapToGrid(rawX) : rawX;
      const adjustedY = event.shiftKey ? snapToGrid(rawY) : rawY;
      const clamped = clampPosition(adjustedX, adjustedY);

      setPosition(clamped.x, clamped.y);
      sampleVelocity(clamped.x, clamped.y);
    },
    [clampPosition, containerRef, onPointerActivity, sampleVelocity, setPosition],
  );

  const handleMouseMove = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      onPointerActivity(event);
    },
    [onPointerActivity],
  );

  const finishDrag = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      const session = dragSession.current;

      if (!session) return;

      event.preventDefault();
      event.stopPropagation();

      if (event.currentTarget.hasPointerCapture(session.pointerId)) {
        event.currentTarget.releasePointerCapture(session.pointerId);
      }

      document.body.style.cursor = "";
      dragSession.current = null;
      setIsDragging(false);

      if (!session.started) {
        commitPosition();

        return;
      }

      onPulse(position.current.x + node.width / 2, position.current.y + node.height / 2, 0.38);

      const sampledVelocity = calculateVelocity();
      const clampedVelocity = clampPanelVelocity(sampledVelocity);

      if (
        Math.hypot(clampedVelocity.vx, clampedVelocity.vy) > panelMotionConfig.momentumThreshold
      ) {
        momentum.current = {
          bouncedX: false,
          bouncedY: false,
          vx: clampedVelocity.vx,
          vy: clampedVelocity.vy,
        };
      } else {
        commitPosition();
      }
    },
    [calculateVelocity, commitPosition, node.height, node.width, onPulse],
  );

  return (
    <motion.button
      type="button"
      className="pointer-events-auto absolute touch-none appearance-none overflow-hidden rounded-[9px] border bg-[#282828]/98 outline-none"
      style={{
        borderColor:
          isDragging || isHovering ? "rgb(255 255 255 / 0.16)" : "rgb(255 255 255 / 0.105)",
        height: node.height,
        left: 0,
        top: 0,
        width: node.width,
        x,
        y,
      }}
      initial={{
        opacity: 0,
        scale: 0.8,
      }}
      animate={{
        boxShadow: isDragging || isHovering ? dragPanelShadow : idlePanelShadow,
        opacity: 1,
        scale: isDragging ? panelMotionConfig.dragScale : 1,
      }}
      transition={panelTransition}
      aria-label="Grid influence node"
      onPointerCancel={finishDrag}
      onPointerDown={handlePointerDown}
      onPointerEnter={() => setIsHovering(true)}
      onPointerLeave={() => setIsHovering(false)}
      onPointerMove={handlePointerMove}
      onPointerUp={finishDrag}
      onMouseMove={handleMouseMove}
    >
      <span className="pointer-events-none absolute inset-0 rounded-[9px] bg-[radial-gradient(circle_at_50%_44%,rgba(255,255,255,0.024),transparent_60%)]" />
      <span className="pointer-events-none absolute inset-0 rounded-[9px] shadow-[inset_0_1px_0_rgba(255,255,255,0.036),inset_0_-1px_0_rgba(0,0,0,0.32)]" />
      <span className="pointer-events-none absolute left-2 top-2 size-1 rounded-full bg-white/[0.055]" />
      <span className="pointer-events-none absolute right-2 top-2 size-1 rounded-full bg-white/[0.055]" />
      <span className="pointer-events-none absolute bottom-2 left-2 size-1 rounded-full bg-white/[0.055]" />
      <span className="pointer-events-none absolute bottom-2 right-2 size-1 rounded-full bg-white/[0.055]" />
      <span className="pointer-events-none absolute left-1/2 top-1/2 size-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/58 shadow-[0_0_6px_rgba(255,255,255,0.24)]" />
    </motion.button>
  );
}

const createFieldRectState = (node: GridNode): FieldRectState => ({
  height: node.height,
  id: node.id,
  strength: 0,
  targetHeight: node.height,
  targetStrength: 1,
  targetWidth: node.width,
  targetX: node.x,
  targetY: node.y,
  velocityHeight: 0,
  velocityWidth: 0,
  velocityX: 0,
  velocityY: 0,
  width: node.width,
  x: node.x,
  y: node.y,
});

const retargetFieldRect = (fieldRect: FieldRectState, node: GridNode) => {
  fieldRect.targetX = node.x;
  fieldRect.targetY = node.y;
  fieldRect.targetWidth = node.width;
  fieldRect.targetHeight = node.height;
  fieldRect.targetStrength = 1;
};

const syncPointerUniforms = ({
  frameRatio,
  hoverStrength,
  hoverTarget,
  material,
  pointer,
}: Readonly<{
  frameRatio: number;
  hoverStrength: number;
  hoverTarget: Vector2;
  material: DynamicGridMaterialInstance;
  pointer: PointerState;
}>) => {
  const hoverAlpha = frameAlpha(gridMotionConfig.hoverEase, frameRatio);
  const hoverGridAlpha = frameAlpha(gridMotionConfig.hoverAnchorEase, frameRatio);
  const nextHoverStrength = hoverStrength + ((pointer.active ? 1 : 0) - hoverStrength) * hoverAlpha;

  material.uPointer.set(pointer.x, pointer.y);
  material.uPointerActive = nextHoverStrength;

  if (pointer.active) {
    hoverTarget.set(snapToGrid(pointer.x), snapToGrid(pointer.y));

    if (
      material.uHoverGrid.x < -1000 ||
      material.uHoverGrid.distanceTo(hoverTarget) > gridMotionConfig.hoverSnapResetDistance
    ) {
      material.uHoverGrid.copy(hoverTarget);
    } else {
      material.uHoverGrid.lerp(hoverTarget, hoverGridAlpha);
    }
  }

  return nextHoverStrength;
};

const syncFieldRectTargets = (
  fieldRects: Map<string, FieldRectState>,
  nodes: readonly GridNode[],
) => {
  const activeNodeIds = new Set(nodes.map((node) => node.id));

  nodes.forEach((node) => {
    const fieldRect = fieldRects.get(node.id);

    if (fieldRect) {
      retargetFieldRect(fieldRect, node);
    } else {
      fieldRects.set(node.id, createFieldRectState(node));
    }
  });

  fieldRects.forEach((fieldRect, id) => {
    if (!activeNodeIds.has(id)) {
      fieldRect.targetStrength = 0;
    }
  });
};

const integrateFieldRects = (fieldRects: Map<string, FieldRectState>, frameRatio: number) => {
  const rectVelocityGain = gridMotionConfig.rectVelocityGain * frameRatio;
  const rectVelocityDamping = frameDamping(gridMotionConfig.rectVelocityDamping, frameRatio);
  const rectStrengthAlpha = frameAlpha(gridMotionConfig.rectStrengthEase, frameRatio);

  fieldRects.forEach((fieldRect, id) => {
    fieldRect.velocityX =
      (fieldRect.velocityX + (fieldRect.targetX - fieldRect.x) * rectVelocityGain) *
      rectVelocityDamping;
    fieldRect.velocityY =
      (fieldRect.velocityY + (fieldRect.targetY - fieldRect.y) * rectVelocityGain) *
      rectVelocityDamping;
    fieldRect.velocityWidth =
      (fieldRect.velocityWidth + (fieldRect.targetWidth - fieldRect.width) * rectVelocityGain) *
      rectVelocityDamping;
    fieldRect.velocityHeight =
      (fieldRect.velocityHeight + (fieldRect.targetHeight - fieldRect.height) * rectVelocityGain) *
      rectVelocityDamping;
    fieldRect.x += fieldRect.velocityX;
    fieldRect.y += fieldRect.velocityY;
    fieldRect.width += fieldRect.velocityWidth;
    fieldRect.height += fieldRect.velocityHeight;
    fieldRect.strength += (fieldRect.targetStrength - fieldRect.strength) * rectStrengthAlpha;

    if (fieldRect.targetStrength === 0 && fieldRect.strength < 0.01) {
      fieldRects.delete(id);
    }
  });
};

const writeFieldRectUniforms = (
  fieldRects: Map<string, FieldRectState>,
  rects: Vector4[],
  rectStrengths: number[],
) => {
  const orderedRects = Array.from(fieldRects.values()).slice(0, maxInfluenceRects);

  for (let index = 0; index < maxInfluenceRects; index++) {
    const fieldRect = orderedRects[index];

    if (fieldRect) {
      rects[index].set(fieldRect.x, fieldRect.y, fieldRect.width, fieldRect.height);
      rectStrengths[index] = fieldRect.strength;
    } else {
      rects[index].set(-9999, -9999, 0, 0);
      rectStrengths[index] = 0;
    }
  }
};

const writePulseUniforms = (
  pulseStates: readonly PulseState[],
  pulseUniforms: Vector4[],
  now: number,
) => {
  for (let index = 0; index < maxPulses; index++) {
    const pulse = pulseStates[index];

    if (pulse) {
      pulseUniforms[index].set(pulse.x, pulse.y, now - pulse.startTime, pulse.intensity);
    } else {
      pulseUniforms[index].set(-9999, -9999, 9999, 0);
    }
  }
};

function DynamicGridShader({
  nodesRef,
  pointerRef,
  pulsesRef,
}: Readonly<{
  nodesRef: React.RefObject<readonly GridNode[]>;
  pointerRef: React.RefObject<PointerState>;
  pulsesRef: React.RefObject<readonly PulseState[]>;
}>) {
  const renderer = useThree((state) => state.renderer);
  const size = useThree((state) => state.size);
  const drawingBufferSize = useMemo(() => new Vector2(), []);
  const rects = useMemo(
    () => Array.from({ length: maxInfluenceRects }, () => new Vector4(-9999, -9999, 0, 0)),
    [],
  );
  const rectStrengths = useMemo(() => Array.from({ length: maxInfluenceRects }, () => 0), []);
  const pulses = useMemo(
    () => Array.from({ length: maxPulses }, () => new Vector4(-9999, -9999, 9999, 0)),
    [],
  );
  const fieldRects = useRef(new Map<string, FieldRectState>());
  const hoverStrength = useRef(0);
  const hoverTarget = useMemo(() => new Vector2(-9999, -9999), []);
  const materialRef = useRef<InstanceType<typeof DynamicGridMaterial>>(null);

  useFrame(
    ({ delta, elapsed }) => {
      const material = materialRef.current;

      if (!material) return;

      const frameRatio = frameRatioFromSeconds(delta);
      renderer.getDrawingBufferSize(drawingBufferSize);

      const dpr = size.width > 0 ? drawingBufferSize.x / size.width : 1;
      const pointer = pointerRef.current;
      const activeNodes = nodesRef.current.slice(0, maxInfluenceRects);
      const now = performance.now();

      material.uResolution.copy(drawingBufferSize);
      material.uDpr = dpr;
      material.uTime = elapsed;

      hoverStrength.current = syncPointerUniforms({
        frameRatio,
        hoverStrength: hoverStrength.current,
        hoverTarget,
        material,
        pointer,
      });

      syncFieldRectTargets(fieldRects.current, activeNodes);
      integrateFieldRects(fieldRects.current, frameRatio);
      writeFieldRectUniforms(fieldRects.current, rects, rectStrengths);
      writePulseUniforms(pulsesRef.current, pulses, now);
    },
    { phase: "update" },
  );

  return (
    <mesh frustumCulled={false}>
      <planeGeometry args={[2, 2]} />
      <DynamicGridMaterialElement
        attach="material"
        ref={materialRef}
        key={DynamicGridMaterial.key}
        depthTest={false}
        depthWrite={false}
        uPulses={pulses}
        uRectStrengths={rectStrengths}
        uRects={rects}
      />
    </mesh>
  );
}

export { InfiniteCanvasDynamicGridExperiment };
