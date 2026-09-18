import { useInfiniteCanvasDispatch, useInfiniteCanvasState } from "@hyphened/infinite-canvas";
import { useValue } from "@legendapp/state/react";
import { Route, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "ui";

import { getCanvasTour, getCanvasTourPoint, type CanvasTour } from "../canvas/tour";
import type { WindowKind } from "../canvas/window-registry";
import { relations$ } from "../relations/relation-store";
import { HudSurface } from "./hud-surfaces";

/*
 * World units per second.
 *
 * Constant speed rather than a fixed total: a canvas of forty notes should take longer to walk than
 * one of four, and a per-stop dwell table would be a second set of numbers to keep true.
 */
const TOUR_SPEED = 900;

/** Below this the walk is a jump, and a jump is what `view.navigate` already does. */
const MINIMUM_TOUR_SECONDS = 1.2;

export function TourControl({ projectId }: Readonly<{ projectId: string }>) {
  const dispatch = useInfiniteCanvasDispatch<WindowKind>();
  const state = useInfiniteCanvasState<WindowKind>();
  const relations = useValue(relations$[projectId]) ?? [];
  const [walking, setWalking] = useState(false);
  /*
   * Frozen while walking, and read through a ref rather than as an effect dependency.
   *
   * A walk drives the camera, so `state` changes on every frame of it. Recomputing would rebuild
   * the adjacency graph and the path sixty times a second to answer a question whose answer cannot
   * change: the walk owns one path from the moment it starts. A dependency on `tour` would also
   * tear the effect down mid-walk and restart it.
   */
  const tourRef = useRef<CanvasTour | null>(null);
  const tour = walking ? tourRef.current : getCanvasTour(state, relations);

  tourRef.current = tour;

  useEffect(() => {
    const walked = tourRef.current;

    if (!walking || walked === null) {
      return;
    }

    const seconds = Math.max(walked.path.length / TOUR_SPEED, MINIMUM_TOUR_SECONDS);
    const startedAt = performance.now();
    // A tour that ignores the person watching it is a trap, so their first touch ends it.
    const interrupt = () => {
      setWalking(false);
    };
    let frame = 0;

    const step = () => {
      const progress = Math.min((performance.now() - startedAt) / (seconds * 1000), 1);

      dispatch({
        request: {
          behavior: { type: "center" },
          target: { point: getCanvasTourPoint(walked, progress), type: "point" },
        },
        type: "camera.navigate",
      });

      if (progress < 1) {
        frame = requestAnimationFrame(step);
        return;
      }

      setWalking(false);
    };

    frame = requestAnimationFrame(step);
    window.addEventListener("pointerdown", interrupt);
    window.addEventListener("wheel", interrupt, { passive: true });

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointerdown", interrupt);
      window.removeEventListener("wheel", interrupt);
    };
  }, [dispatch, walking]);

  if (tour === null) {
    return null;
  }

  const label = walking ? "Stop the walk" : `Walk the ${tour.stops.length} connected notes`;

  // Not bottom-right: the minimap already owns that corner and the two would sit on each other.
  return (
    <HudSurface anchor="bottom-center" persistent>
      <Button
        aria-label={label}
        onClick={() => {
          setWalking(!walking);
        }}
        size="icon-sm"
        title={label}
        variant={walking ? "default" : "ghost"}
      >
        {walking ? <Square /> : <Route />}
      </Button>
    </HudSurface>
  );
}
