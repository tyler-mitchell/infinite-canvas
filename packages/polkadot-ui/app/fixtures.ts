import type { ActivityDay } from "polkadot-ui";

export const WRITING = [
  [
    "Why the pure core cannot import React",
    "Geometry as pure functions, enforced by a test that fails when the boundary moves.",
    "08.26",
  ],
  [
    "Snapping is a resolver, not a heuristic",
    "Candidates in, one committed rect out. The guides are the resolver's own reasoning made visible.",
    "06.26",
  ],
  [
    "Semantic summaries at far zoom",
    "What a window should say at eight percent scale, when its body is smaller than its own title.",
    "04.26",
  ],
] as const;

export const ACTIVITY: ActivityDay[] = Array.from({ length: 371 }, (_, i) => {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() - (370 - i));
  const weekend = date.getDay() === 0 || date.getDay() === 6;
  const r = Math.abs(Math.sin(i * 12.9898 + 78.233) * 43758.5453) % 1;
  const r2 = Math.abs(Math.sin((i + 1000) * 12.9898 + 78.233) * 43758.5453) % 1;
  const pZero = i > 202 && i < 219 ? 0.92 : weekend ? 0.46 : 0.11;
  /* Peaks inside the half year a grid shows. On the older half the plot never reached the top
   * band, so the legend named a colour the days beside it could not take. */
  const season = 0.6 + 0.4 * Math.cos((i - 300) / 58);
  return {
    date,
    count: r < pZero ? 0 : 1 + Math.round(r2 ** 1.7 * 13 * season * (weekend ? 0.5 : 1)),
  };
});

export const READING: ActivityDay[] = ACTIVITY.map(({ date, count }) => ({
  date,
  count: count * 14,
}));

export const INSTALLS = [1420, 1880, 1310, 2410, 2150, 2860, 1980, 4182] as const;

export const INSTALLS_SMALL = [210, 260, 180, 340, 300, 420, 380, 510] as const;

/** Two weeks with nothing in them, which is what a floor under an empty bucket is for. */
export const RELEASES = [4, 6, 0, 3, 7, 0, 5, 9] as const;

export const LEVELS = [
  0.3, 0.7, 0.45, 0.9, 0.62, 0.35, 0.78, 0.55, 0.42, 0.88, 0.6, 0.29, 0.71, 0.5, 0.83, 0.38,
] as const;

export const CATEGORIES = ["stack", "work", "words", "life"] as const;

export const SNAP = ["edges", "centres", "gaps", "nothing"] as const;

export const RULERS = ["px", "pt", "rem"] as const;

export const EXPORT_AS = ["png", "svg", "pdf", "canvas file"] as const;

export const COMMANDS = [
  "field notes",
  "field shader",
  "snap resolver",
  "raster pass",
  "window packing",
  "compositor scratch",
];

export const INBOX = [
  {
    id: "gist",
    kind: "gist",
    title: "field-shader.wgsl — grid deformation from live rects",
    body: "Deforms the lattice from live panel rects. 40px seed spacing, 300px force radius, 0.08 gain, 0.75 damping.",
    left: "82 lines · wgsl",
    right: "04",
  },
  {
    id: "reading",
    kind: "reading",
    title: "Point and Line to Plane",
    body: "Kandinsky on the point as the smallest committed mark, and the line as the trace of a force acting on it.",
    left: "ch. 2 · 14 pages left",
    right: "03",
  },
  {
    id: "issue",
    kind: "issue",
    title: "Snap against predicted rest, not the pointer",
    body: "Guides should resolve where the window will come to rest, so they arrive before the shape does.",
    left: "infinite-canvas #418",
    right: "02",
  },
  {
    id: "reference",
    kind: "reference",
    title: "tldraw's arrow binding behaviour",
    body: "The binding is a constraint solved at draw time, not a stored anchor — so the arrow survives the shape moving.",
    left: "jane · figma link",
    right: "01",
  },
];

export const BINDINGS = [
  [["⌘", "K"], "palette"],
  [["⌥", "drag"], "dock"],
  [["F"], "fit selection"],
  [["⇧", "↵"], "group selection"],
  [["⌥", "scroll"], "zoom to pointer"],
] as const;

export const SPLIT_PANES = [
  { left: 6, top: 8, width: 40, height: 84 },
  { left: 52, top: 8, width: 42, height: 38 },
  { left: 52, top: 54, width: 42, height: 38, active: true },
];

export const ELSEWHERE = [
  ["GitHub", "@hyphened", "https://github.com/hyphened"],
  ["Bluesky", "@tdm.bsky", "https://bsky.app/profile/tdm.bsky.social"],
  ["Figma", "@tdmitchell", "https://figma.com/@tdmitchell"],
] as const;

export const RUNS = [
  {
    id: "snap",
    name: "snap resolver",
    duration: "15s",
    note: "Resolved 1,204 candidate rects against predicted rest.",
    since: "2h",
  },
  {
    id: "raster",
    name: "raster pass",
    duration: "5m",
    note: "Skipped 38 offscreen window bodies, repainted 6.",
    since: "9h",
  },
  {
    id: "pack",
    name: "window packing",
    duration: "1.2s",
    note: "Packed 24 windows into 16 columns with no overlap.",
    since: "30h",
  },
];

export const LATEST_COMMITS = [
  ["a1f9c2", "fix(snap): resolve gap guides before edges", "2h"],
  ["7e04b1", "feat(groups): accordion axis labels", "1d"],
  ["c92d55", "perf(raster): skip offscreen window bodies", "3d"],
] as const;

export const BUILDING = [
  ["infinite-canvas", "2024 — now"],
  ["surreal-inspector", "2025"],
  ["polkadot canvas app", "2025 — now"],
  ["compositor-poc", "2026"],
] as const;

export const LANGUAGES = [
  { name: "TypeScript", share: 0.84, color: "#3178c6" },
  { name: "WGSL", share: 0.09, color: "var(--pk-accent)" },
  { name: "CSS", share: 0.07, color: "#8b8f94" },
];

export const COMMIT_WEEKS = Array.from({ length: 64 }, (_, week) => {
  const drift = 8 + 5 * Math.sin(week / 7) + 3 * Math.sin(week / 2.3);
  return Math.max(0, Math.round(drift + (week === 41 ? 14 : 0)));
});

export const LATENCY = Array.from({ length: 96 }, (_, hour) => {
  const noise = Math.abs(Math.sin(hour * 12.9898) * 43758.5453) % 1;
  return Math.round(16 + noise * 5 + (hour > 58 && hour < 66 ? 22 : 0));
});

export const FRAME_BUDGET = Array.from({ length: 72 }, (_, frame) => {
  const noise = Math.abs(Math.sin((frame + 400) * 12.9898) * 43758.5453) % 1;
  return Number((15.4 + noise * 1.1).toFixed(2));
});

export const COMMITS = [
  "a1f9c2  fix(snap): resolve gap guides before edges",
  "7e04b1  feat(groups): accordion axis labels",
  "c92d55  perf(raster): skip offscreen window bodies",
  "3b7a19  refactor(camera): one conversion boundary",
  "d40c81  fix(hud): keep every surface inside the root",
  "8fe2a0  chore(deps): bump base-ui to 1.5.0",
] as const;
