import { interpolateZoom } from "d3-interpolate";
import { norm } from "@thi.ng/math";
import type { Camera } from "./camera";

// Van Wijk–Nuij view interpolation: https://d3js.org/d3-interpolate/zoom
export function interpolateCamera({
  from,
  to,
  width,
  curvature = Math.SQRT2,
  startProgress = 0,
}: {
  from: Camera;
  to: Camera;
  width: number;
  curvature?: number;
  startProgress?: number;
}): (progress: number) => Camera {
  const interpolate = interpolateZoom.rho(curvature)(
    [from.center.x, from.center.y, width / from.zoom],
    [to.center.x, to.center.y, width / to.zoom],
  );
  return (progress) => {
    const [x, y, extent] = interpolate(
      startProgress === 1 ? 1 : norm(progress, startProgress, 1),
    );
    return { center: { x, y }, zoom: width / extent };
  };
}
