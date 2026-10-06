import { expect, test } from "vite-plus/test";
import { activitySchedule } from "./activity-schedule";

test("busy days receive more time without changing chronological order", () => {
  const schedule = activitySchedule({
    days: [0, 1, 100].map((count) => ({ count, date: new Date() })),
  });
  expect(schedule[0]!.start).toBe(0);
  expect(schedule[1]!.start).toBe(schedule[0]!.end);
  expect(schedule[2]!.start).toBe(schedule[1]!.end);
  expect(schedule[2]!.end).toBeCloseTo(1);
  expect(schedule[2]!.end - schedule[2]!.start).toBeGreaterThan(schedule[0]!.end);
});

test("empty and invalid counts cannot produce invalid time ranges", () => {
  expect(activitySchedule({ days: [] })).toEqual([]);
  const schedule = activitySchedule({
    days: [null, ...[NaN, Infinity, -1].map((count) => ({ count, date: new Date() }))],
  });
  expect(schedule.map((segment) => segment.end - segment.start)).toEqual([0.25, 0.25, 0.25, 0.25]);
});

test("minimum cell duration extends the pass without overlapping cells", () => {
  const schedule = activitySchedule({
    days: Array.from({ length: 100 }, () => ({ count: 1, date: new Date() })),
    duration: 14,
    cellDuration: 0.28,
  });
  schedule.forEach((segment, index) => {
    expect(segment.end - segment.start).toBeCloseTo(0.28);
    expect(segment.start).toBe(schedule[index - 1]?.end ?? 0);
  });
  expect(schedule.at(-1)!.end).toBeCloseTo(28);
});

test("impact pauses extend the schedule without changing color transition time", () => {
  const input = {
    days: [{ count: 20 }, { count: 1 }, { count: 10 }],
    thresholds: [1, 3, 6, 10],
  };
  const baseline = activitySchedule(input);
  const paused = activitySchedule({ ...input, impactPause: 0.25 });
  expect(paused.map((segment) => segment.duration)).toEqual(
    baseline.map((segment) => segment.duration),
  );
  expect(paused[0]!.impactAt).toBe(baseline[0]!.impactAt);
  expect(paused[1]!.start).toBeCloseTo(baseline[1]!.start + 0.25);
  expect(paused[1]!.impactAt).toBeUndefined();
  expect(paused[2]!.start).toBeCloseTo(baseline[2]!.start + 0.25);
  expect(paused.at(-1)!.end).toBeCloseTo(1.5);
});

test.each([
  { count: 9, thresholds: [1, 3, 6, 10], impactAt: undefined },
  { count: 10, thresholds: [1, 3, 6, 10], impactAt: 1 },
  { count: 20, thresholds: [1, 3, 6, 10], impactAt: 0.5 },
  { count: 20, thresholds: [1, 5, 12, 25], impactAt: undefined },
  { count: 0, thresholds: [1, 3, 6, 10], impactAt: undefined },
])(
  "impact timing for count $count and thresholds $thresholds",
  ({ count, thresholds, impactAt }) => {
    const schedule = activitySchedule({ days: [{ count }], thresholds });
    expect(schedule[0]!.impactAt).toBe(impactAt);
  },
);
