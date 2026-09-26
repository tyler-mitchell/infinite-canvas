import type { AnimationPlaybackControls } from "motion";
import { useAnimate, useInView, usePageInView, useReducedMotion } from "motion/react";
import { useObservable, useValue } from "@legendapp/state/react";
import { useEffect, useEffectEvent, useLayoutEffect, useMemo, useRef } from "react";
import { activitySchedule, timelineDuration } from "@hyphened/math/cpu";
import type { TimedDOMSegment } from "../motion.ts";
import { particleBurstSequence, type ParticleOptions } from "./particle-field.tsx";
import type { ActivityDay } from "./activity-grid.tsx";

export interface ActivityPlaybackOptions {
  readonly waitForPageLoad?: boolean;
  /** Delay after playback becomes ready, in seconds. */
  readonly startDelay?: number;
  readonly completionShimmer?: boolean;
  readonly shimmerDuration?: number;
  readonly shimmerStrength?: number;
  readonly cursor?: boolean;
  readonly cursorTrail?: number;
  readonly impactDuration?: number;
  readonly impactDelay?: number;
  readonly comboStrength?: number;
  readonly comboWindow?: number;
  /** Target pass duration, in seconds. */
  readonly duration?: number;
  /** Minimum transition time per cell, in seconds. */
  readonly cellDuration?: number;
  readonly settleDuration?: number;
  readonly resetDuration?: number;
  readonly loop?: boolean;
  readonly impact?: number;
  readonly minorImpact?: number;
  readonly particles?: false | ParticleOptions;
  /** Hold color progression after an impact, in seconds. */
  readonly impactPause?: number;
}

const durationOr = (value: number | undefined, fallback: number) =>
  Number.isFinite(value) ? Math.max(0.01, Math.min(3600, value!)) : fallback;

export function useActivityPlayback({
  days,
  playback,
  loading,
  replayKey,
  columns,
  cellSize,
  gap,
  ready,
  thresholds,
}: {
  readonly days: readonly ActivityDay[];
  readonly playback: boolean | ActivityPlaybackOptions;
  readonly loading: boolean;
  readonly replayKey: string | number | undefined;
  readonly columns: (days: readonly ActivityDay[]) => readonly (ActivityDay | null)[];
  readonly cellSize: number;
  readonly gap: number;
  readonly ready: boolean;
  readonly thresholds: readonly number[];
}) {
  const options = typeof playback === "object" ? playback : {};
  const reduced = useReducedMotion();
  const enabled = playback !== false && !reduced;
  const signature = JSON.stringify([
    days.map((day) => [day.date.getTime(), day.count]),
    replayKey,
    playback,
    thresholds,
  ]);
  const state$ = useObservable({
    snapshot: { days, signature, revision: 0 },
    phase: "idle",
    pageLoaded: typeof document !== "undefined" && document.readyState === "complete",
  });
  const snapshot = useValue(state$.snapshot);
  const [plot, animate] = useAnimate<HTMLDivElement>();
  const visible = useInView(plot);
  const pageVisible = usePageInView();
  const controls = useRef(new Set<AnimationPlaybackControls>());
  const paused = useValue(
    () =>
      loading ||
      !visible ||
      !pageVisible ||
      (options.waitForPageLoad === true && !state$.pageLoaded.get()),
  );
  const onPlaybackStart = useEffectEvent((control: AnimationPlaybackControls) => {
    controls.current.add(control);
    if (paused) control.pause();
  });
  const request = useRef(0);
  const transitioning = useRef(false);
  const onExitComplete = useEffectEvent((revision: number) => {
    if (request.current !== revision) return;
    transitioning.current = false;
    state$.snapshot.set({ days, signature, revision });
  });
  const shown = useMemo(() => columns(snapshot.days), [columns, snapshot.days]);
  const duration = durationOr(options.duration, 4);
  const cellDuration = durationOr(options.cellDuration, 0.016);
  const particleLifetime = durationOr(
    options.particles === false ? undefined : options.particles?.lifetime,
    0.48,
  );
  const particleGroups = Math.min(12, Math.ceil(particleLifetime / cellDuration) + 1);
  const settleDuration = durationOr(options.settleDuration, 1.2);
  const resetDuration = durationOr(options.resetDuration, 0.4);
  const impact = Number.isFinite(options.impact) ? Math.max(0, Math.min(3, options.impact!)) : 1;
  const impactPause = Number.isFinite(options.impactPause)
    ? Math.max(0, Math.min(10, options.impactPause!))
    : 0;

  useEffect(() => {
    if (!options.waitForPageLoad) return;
    const onLoad = () => state$.pageLoaded.set(true);
    window.addEventListener("load", onLoad, { once: true });
    if (document.readyState === "complete") onLoad();
    return () => window.removeEventListener("load", onLoad);
  }, [options.waitForPageLoad, state$]);

  useEffect(() => {
    controls.current.forEach((control) => {
      if (paused) control.pause();
      else control.play();
    });
  }, [paused]);

  useEffect(() => {
    if (signature === snapshot.signature && !transitioning.current) return;
    const id = ++request.current;
    transitioning.current = true;
    controls.current.forEach((control) => control.stop());
    controls.current.clear();
    state$.phase.set("resetting");
    const element = plot.current;
    if (!enabled || !element) {
      onExitComplete(id);
      return;
    }
    const exit = animate(element, { opacity: 0 }, { duration: resetDuration });
    controls.current.add(exit);
    void exit.finished.then(() => {
      controls.current.delete(exit);
      onExitComplete(id);
    });
    return () => {
      exit.stop();
      controls.current.delete(exit);
    };
  }, [signature, snapshot.signature, enabled, resetDuration, state$, plot, animate]);

  const startPlayback = useEffectEvent(() => {
    const element = plot.current;
    if (!element || !ready) return;
    const state = { cancelled: false };
    const isCurrent = () => !state.cancelled && snapshot.revision === request.current;
    const cells = shown.flatMap((day, index) =>
      day ? [{ day, index, selector: `[data-index="${index}"]` }] : [],
    );
    if (!enabled || !cells.length) {
      animate(
        '[data-slot="activity-cursor"], [data-slot="activity-flash"], [data-slot="particle"]',
        { opacity: 0 },
        { duration: 0 },
      ).complete();
      animate(element, { opacity: 1 }, { duration: 0 }).complete();
      animate('[data-slot="activity-fill"]', { opacity: 1 }, { duration: 0 }).complete();
      animate("[data-index]", { transform: "none" }, { duration: 0 }).complete();
      state$.phase.set("complete");
      return;
    }
    const schedule = activitySchedule({
      days: shown,
      duration,
      cellDuration,
      thresholds,
      impactPause,
    });
    const impacts = schedule.filter((segment) => segment.impactAt !== undefined);
    const impactIndices = new Map(impacts.map((segment, index) => [segment, index]));
    const sequence = cells.flatMap(({ day, index, selector: cell }): TimedDOMSegment[] => {
      const segment = schedule[index];
      if (!segment) return [];
      const fill = `${cell} [data-slot="activity-fill"]`;
      const hit = segment.impactAt;
      const colorEnd = hit ?? segment.end;
      const entries: TimedDOMSegment[] = [];
      const burst: TimedDOMSegment[] = [];
      const cursor = options.cursor === false ? null : `${cell} [data-slot="activity-cursor"]`;
      const level = thresholds.filter(
        (threshold) => Number.isFinite(threshold) && day.count >= threshold,
      ).length;
      if (level > 0) {
        entries.push([
          fill,
          { opacity: [0, 1] },
          { at: segment.start, duration: colorEnd - segment.start, ease: "easeOut" },
        ]);
      }
      if (hit === undefined && level > 0 && Number.isFinite(day.count) && day.count > 0) {
        const minorImpact = Number.isFinite(options.minorImpact)
          ? Math.max(0, Math.min(3, options.minorImpact!))
          : 1.4;
        const displacement =
          minorImpact * impact * Math.min(1, level / 3) * (0.85 + Math.random() * 0.15);
        const direction = Math.random() * Math.PI * 2;
        const offsetX = Math.cos(direction) * displacement;
        const offsetY = Math.sin(direction) * displacement;
        if (displacement > 0) {
          entries.push([
            cell,
            {
              transform: [
                "translate(0px, 0px)",
                `translate(${offsetX}px, ${offsetY}px)`,
                `translate(${-offsetX * 0.35}px, ${-offsetY * 0.35}px)`,
                "translate(0px, 0px)",
              ],
            },
            {
              at: colorEnd,
              duration: 0.1 + Math.random() * 0.06,
              times: [0, 0.2, 0.5, 1],
              ease: "linear",
            },
          ]);
        }
      }
      if (hit !== undefined) {
        const impactIndex = impactIndices.get(segment)!;
        const comboWindow = durationOr(options.comboWindow, 0.35);
        const comboStrength = Number.isFinite(options.comboStrength)
          ? Math.max(0, Math.min(0.5, options.comboStrength!))
          : 0.18;
        const recentImpacts = impacts
          .slice(Math.max(0, impactIndex - 3), impactIndex)
          .filter((entry) => hit - entry.impactAt! <= comboWindow).length;
        const strength = 1 + recentImpacts * comboStrength;
        const displacement = impact * strength * (1.5 + Math.random() * 0.5);
        const direction = Math.random() * Math.PI * 2;
        const offsetX = Math.cos(direction) * displacement;
        const offsetY = Math.sin(direction) * displacement;
        const impactDuration = durationOr(options.impactDuration, 0.65);
        const impactDelay = Number.isFinite(options.impactDelay)
          ? Math.max(0, Math.min(1, options.impactDelay!))
          : 0.09;
        const detonation = colorEnd + impactDelay;
        const flash = `${cell} [data-slot="activity-flash"]`;
        if (level === 4) {
          entries.push([
            flash,
            { opacity: [0, 1, 0.8, 0] },
            {
              at: detonation,
              duration: impactDuration,
              times: [0, 0.04, 0.3, 1],
              ease: "easeOut",
            },
          ]);
          const core = `${flash} [data-slot="activity-core"]`;
          entries.push([
            core,
            { opacity: [1, 1, 0] },
            {
              at: detonation,
              duration: Math.min(0.25, impactDuration),
              times: [0, 0.2, 1],
              ease: "easeOut",
            },
          ]);
        }
        entries.push([
          cell,
          {
            transform: [
              "translate(0px, 0px)",
              `translate(${offsetX}px, ${offsetY}px)`,
              `translate(${-offsetX * 0.38}px, ${-offsetY * 0.38}px)`,
              `translate(${offsetX * 0.12}px, ${offsetY * 0.12}px)`,
              "translate(0px, 0px)",
            ],
          },
          {
            at: detonation,
            duration: Math.min(impactDuration, 0.13 + Math.random() * 0.07),
            times: [0, 0.16, 0.4, 0.65, 1],
            ease: "linear",
          },
        ]);
        if (cursor) {
          entries.push([
            cursor,
            { opacity: [1, 0.85, 0.4, 0] },
            { at: detonation, duration: impactDuration, times: [0, 0.3, 0.65, 1], ease: "easeOut" },
          ]);
        }
        if (options.particles !== false) {
          burst.push(
            ...particleBurstSequence({
              ...options.particles,
              speed: (options.particles?.speed ?? 190) * strength,
              x: Math.floor(index / 7) * (cellSize + gap) + cellSize / 2,
              y: (index % 7) * (cellSize + gap) + cellSize / 2,
              at: detonation,
              group: impactIndex % particleGroups,
              lifetime: Math.min(
                durationOr(options.particles?.lifetime, 0.48),
                (impacts[impactIndex + particleGroups]?.impactAt ?? Infinity) - hit,
              ),
            }),
          );
        }
      }
      const activeDuration = colorEnd - segment.start;
      const cursorDuration =
        activeDuration + (hit === undefined ? durationOr(options.cursorTrail, 0.2) : 0);
      const cursorTrack: TimedDOMSegment[] = cursor
        ? [
            [
              cursor,
              { opacity: [0, 1, 0.32, 0] },
              {
                at: segment.start,
                duration: cursorDuration,
                times: [
                  0,
                  (activeDuration * 0.12) / cursorDuration,
                  activeDuration / cursorDuration,
                  1,
                ],
                ease: "linear",
              },
            ],
          ]
        : [];
      return [...cursorTrack, ...entries, ...burst];
    });
    const shimmerDuration = durationOr(options.shimmerDuration, 1.1);
    const shimmerStrength = Number.isFinite(options.shimmerStrength)
      ? Math.max(0, Math.min(1, options.shimmerStrength!))
      : 0.45;
    const completionAt = timelineDuration(sequence.map(([, , transition]) => transition));
    const shimmer: TimedDOMSegment[] =
      options.completionShimmer === false
        ? []
        : cells.flatMap(({ selector }, index): TimedDOMSegment[] => {
            const cursor = `${selector} [data-slot="activity-cursor"]`;
            return [
              [
                cursor,
                { opacity: [0, shimmerStrength, 0] },
                {
                  at:
                    completionAt + (index / Math.max(1, cells.length - 1)) * shimmerDuration * 0.72,
                  duration: shimmerDuration * 0.28,
                  times: [0, 0.3, 1],
                  ease: "easeInOut",
                },
              ],
            ];
          });
    const play = async (control: AnimationPlaybackControls) => {
      onPlaybackStart(control);
      await control.finished;
      controls.current.delete(control);
    };
    const playSequence = (sequence: TimedDOMSegment[]) => {
      const animations = [...Map.groupBy(sequence, ([element]) => element).values()].map(
        (segments) => animate(segments),
      );
      return Promise.all(animations.map(play));
    };
    const run = async () => {
      if (!isCurrent()) return;
      animate(
        '[data-slot="activity-cursor"], [data-slot="activity-flash"], [data-slot="particle"]',
        { opacity: 0 },
        { duration: 0 },
      ).complete();
      animate('[data-slot="activity-fill"]', { opacity: 0 }, { duration: 0 }).complete();
      const startDelay = Number.isFinite(options.startDelay)
        ? Math.max(0, Math.min(3600, options.startDelay!))
        : 0;
      const reveal = animate(
        element,
        { opacity: 1 },
        { duration: resetDuration, delay: startDelay },
      );
      await play(reveal);
      if (!isCurrent()) return;
      state$.phase.set("playing");
      if (sequence.length || shimmer.length) await playSequence([...sequence, ...shimmer]);
      if (!isCurrent()) return;
      state$.phase.set("complete");
      if (!options.loop) return;
      const exit = animate(
        element,
        { opacity: 0 },
        { duration: resetDuration, delay: settleDuration },
      );
      await play(exit);
      if (isCurrent()) void run();
    };
    void run();
    return () => {
      state.cancelled = true;
      controls.current.forEach((control) => control.stop());
      controls.current.clear();
    };
  });
  useLayoutEffect(() => startPlayback(), [snapshot, enabled, ready]);

  return {
    days: snapshot.days,
    columns: shown,
    plot,
    particleGroups,
    paused,
    phase$: state$.phase,
  };
}
