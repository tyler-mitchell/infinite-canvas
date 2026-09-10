import { readdirSync, readFileSync } from "node:fs";

import { expect, test } from "vite-plus/test";

/*
 * Every ratio the kit states, and every ratio it has to clear. The pages state one beside each ink
 * and hairline, the components state four in prose, and a focus ring has to reach 3:1 against each
 * seat a tone can put under it. All of it is one question, so it lives in one file.
 *
 * The sheet also carries a display-p3 accent, which paints a slightly brighter ring. Everything
 * here reads the plain sRGB fallback on purpose: it is the weaker of the two, and the one an
 * ordinary display gets.
 */

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

const themeCss = read("./theme.css");

const componentDir = new URL("./components/", import.meta.url);
const componentSources = readdirSync(componentDir)
  .filter((name) => name.endsWith(".tsx"))
  .map((file) => ({ file, source: readFileSync(new URL(file, componentDir), "utf8") }));

const appDir = new URL("../app/", import.meta.url);
const pages = [
  ...readdirSync(appDir).filter((name) => name.endsWith(".tsx")),
  ...readdirSync(new URL("routes/", appDir))
    .filter((name) => name.endsWith(".tsx"))
    .map((name) => `routes/${name}`),
]
  .map((file) => readFileSync(new URL(file, appDir), "utf8"))
  .join("\n");

/*
 * Plain hex only, and the first declaration wins. The accent is declared twice — once as hex and
 * again as display-p3 inside a gamut query — and a map that keeps the last one hands back a colour
 * this file cannot read, which turns every ratio into NaN rather than into a failure that says so.
 */
const declaredAs = new Map<string, string>();
for (const [, token, hex] of themeCss.matchAll(/^\s+(--[a-z][a-z\d-]*):\s*(#[\da-f]{3,8});/gim)) {
  if (!declaredAs.has(token!)) declaredAs.set(token!, hex!);
}

const channels = (hex: string) => {
  const raw = hex.replace("#", "");
  const full = raw.length === 3 ? raw.replace(/./g, (digit) => digit + digit) : raw;

  return [0, 2, 4].map((at) => Number.parseInt(full.slice(at, at + 2), 16));
};

/** WCAG relative luminance, from sRGB. */
const luminance = (hex: string) =>
  channels(hex)
    .map((value) => {
      const channel = value / 255;

      return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    })
    .reduce((sum, channel, index) => sum + [0.2126, 0.7152, 0.0722][index]! * channel, 0);

const contrast = (a: string, b: string) => {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);

  return (light! + 0.05) / (dark! + 0.05);
};

/** Straight alpha over an opaque ground, which is how the browser composites a half-alpha ring. */
const over = (ink: string, ground: string, alpha: number) => {
  const under = channels(ground);

  return `#${channels(ink)
    .map((value, index) =>
      Math.round(alpha * value + (1 - alpha) * under[index]!)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
};

test("the contrast maths agrees with the values WCAG defines", () => {
  /* Black on white is the definition's own upper bound. */
  expect(Number(contrast("#000", "#fff").toFixed(2))).toBe(21);
  expect(contrast("#fff", "#fff")).toBe(1);
  /* Half of anything over itself is itself, so the alpha step cannot move a ratio on its own. */
  expect(over("#ffffff", "#ffffff", 0.5)).toBe("#ffffff");
  expect(over("#ffffff", "#000000", 0.5)).toBe("#808080");
});

test("a stated ratio that no longer matches its colours is reported", () => {
  const real = contrast("#ededed", "#0e0f11").toFixed(2);

  expect(real).toBe("16.38");
  expect(real === "15.00").toBe(false);
});

/**
 * The foundations page states a ratio beside every ink and hairline. They are correct today, and
 * nothing tied them to the colours, so editing a colour would leave the page asserting the old
 * number — a claim about accessibility that reads as measured.
 */
test("every ratio a page states is the one its colours produce", () => {
  const surface = declaredAs.get("--pk-surface")!;

  const stated = [
    ...pages.matchAll(/\["(--pk-(?:ink|line)[a-z-]*)",\s*"[^"]*",\s*"(\d+\.\d+)/g),
  ].map(([, token, printed]) => [token!, printed!] as const);

  const wrong = stated
    .map(([token, printed]) => ({
      token,
      printed,
      real: contrast(declaredAs.get(token)!, surface).toFixed(2),
    }))
    .filter(({ printed, real }) => printed !== real)
    .map(({ token, printed, real }) => `${token} states ${printed}, colours give ${real}`);

  expect(stated.length).toBeGreaterThan(8);
  expect(wrong).toEqual([]);
});

/**
 * Paper is the one ground that is a gradient, so its rows state a pair: the ratio against the top
 * of the sheet and against the foot. Both stops come from the declaration rather than being
 * restated here, so a change to the paper itself moves the expectation with it.
 */
test("every paper ratio the page states is the pair its gradient produces", () => {
  const [, top, foot] =
    /--pk-paper:\s*linear-gradient\([^,]+,\s*(#[\da-f]+),\s*(#[\da-f]+)\)/.exec(themeCss) ?? [];

  const stated = [
    ...pages.matchAll(/\["(--pk-paper-[a-z-]+)",\s*"[^"]*",\s*"([\d.]+) → ([\d.]+)"\]/g),
  ].map(([, token, atTop, atFoot]) => ({ token: token!, printed: `${atTop} → ${atFoot}` }));

  const wrong = stated
    .map(({ token, printed }) => {
      const ink = declaredAs.get(token)!;
      const real = `${contrast(ink, top!).toFixed(2)} → ${contrast(ink, foot!).toFixed(2)}`;

      return { token, printed, real };
    })
    .filter(({ printed, real }) => printed !== real)
    .map(({ token, printed, real }) => `${token} states ${printed}, gradient gives ${real}`);

  expect(top).toBe("#faf9f5");
  expect(stated.length).toBe(3);
  expect(wrong).toEqual([]);
});

/** Every seat a control can sit on: the root default, and each one a Surface tone restates. */
const seats = () => {
  const written = componentSources.flatMap(({ source }) =>
    [...source.matchAll(/\[--pk-ring-seat:var\((--pk-[a-z\d-]+)\)\]/g)].map(([, token]) => token!),
  );
  const [, fallback] = /--pk-ring-seat:\s*var\((--pk-[a-z\d-]+)\)/.exec(themeCss) ?? [];

  return [...new Set([fallback!, ...written])];
};

/**
 * A focus ring is a non-text mark, so 3:1 is what it is asked for. The number is not a property of
 * the ring: the ring is the accent at half alpha, so it is a property of the ring and the seat
 * together, and every tone sets a different seat.
 */
test("the focus ring clears 3:1 on every seat a control can sit on", () => {
  const accent = declaredAs.get("--pk-accent")!;

  const thin = seats()
    .map((seat) => {
      const ground = declaredAs.get(seat)!;

      return { seat, ratio: Number(contrast(over(accent, ground, 0.5), ground).toFixed(2)) };
    })
    .filter(({ ratio }) => ratio < 3);

  expect(seats().length).toBeGreaterThan(4);
  expect(thin).toEqual([]);
});

/**
 * The rule above can only weigh a seat some component wrote down, so a container that paints a
 * ground and never names it is invisible to it. Four were: the toolbar tray, and the dialog, menu
 * and popover popups. A button inside any of them offset its ring against the page instead — a
 * two pixel band of `#08090a` on a `#0e0f11` tray, measured on a focused toolbar button.
 *
 * A container is what this asks about, so the test is whether the file brings in a control that
 * rings itself. The icon tile paints and rings the same element, so its ring belongs to whatever
 * the tile sits on rather than to its own fill, and it is right to stay quiet.
 *
 * The tooltip is named rather than passed over: its popup paints, and it composes the button for
 * its trigger, but the trigger sits outside the popup and nothing focusable goes inside one.
 */
const RINGS_OUTSIDE_ITS_OWN_GROUND = ["tooltip.tsx"];

const groundsWithoutSeats = (sources: readonly { file: string; source: string }[]) =>
  sources
    .filter(({ file }) => !RINGS_OUTSIDE_ITS_OWN_GROUND.includes(file))
    .filter(({ source }) => /\bbg-pk-(?:surface|ground)[a-z-]*/.test(source))
    .filter(({ source }) => /\b(?:buttonVariants|inputVariants)\b/.test(source))
    .filter(({ source }) => !/\[--pk-ring-seat:var\(/.test(source))
    .map(({ file }) => `${file} paints a ground and leaves the seat behind it`)
    .sort();

test("a ground painted for other controls to sit on with no seat named is reported", () => {
  const quiet = [{ file: "a.tsx", source: 'root: "bg-pk-surface"' }];
  const holding = [{ file: "b.tsx", source: 'root: "bg-pk-surface"\nbuttonVariants({})' }];
  const named = [
    {
      file: "c.tsx",
      source: 'root: "bg-pk-surface [--pk-ring-seat:var(--pk-surface)]"\nbuttonVariants({})',
    },
  ];

  expect(groundsWithoutSeats(quiet)).toEqual([]);
  expect(groundsWithoutSeats(holding)).toEqual([
    "b.tsx paints a ground and leaves the seat behind it",
  ]);
  expect(groundsWithoutSeats(named)).toEqual([]);
});

test("every ground a control can be focused on names the seat behind it", () => {
  expect(componentSources.length).toBeGreaterThan(40);
  expect(groundsWithoutSeats(componentSources)).toEqual([]);
});

/**
 * Paper is the one ground painted as a gradient, so the rule above cannot see it — a gradient sets
 * no background colour, and neither can a walk up the page find one. Two declarations hold it
 * together by hand: `.pk-paper` paints the gradient and names `--pk-paper-page` as the seat.
 *
 * Nothing said the two had to agree. A gradient starting at another colour would leave the receipt
 * offsetting its ring against a colour the paper no longer has anywhere, and every ratio in this
 * file would still pass, because each of them reads one of the two and never both.
 *
 * Confirmed in the page before it was written: the receipt's action sits on a gradient whose first
 * stop is rgb(250, 249, 245), and the seat it inherits is #faf9f5.
 */
test("the seat the paper names is the stop the paper starts at", () => {
  const [, top] = /--pk-paper:\s*linear-gradient\([^,]+,\s*(#[\da-f]+)/.exec(themeCss) ?? [];
  const [, named] =
    /\.pk-paper\s*\{[\s\S]*?--pk-ring-seat:\s*var\((--pk-[a-z-]+)\)/.exec(themeCss) ?? [];

  expect(top).toBeDefined();
  expect(named).toBe("--pk-paper-page");
  expect(declaredAs.get(named!)).toBe(top);
});

/**
 * Paper is its own ground and takes its own ring, because the accent at half alpha reaches only
 * 1.32:1 against it. Nothing puts an accent ring on paper today; this pins the ring paper does use,
 * and pins the reason the other one cannot be carried across.
 */
test("the ring paper uses clears 3:1 on paper", () => {
  const page = declaredAs.get("--pk-paper-page")!;

  expect(contrast(declaredAs.get("--pk-paper-ink")!, page)).toBeGreaterThanOrEqual(3);
  expect(contrast(over(declaredAs.get("--pk-accent")!, page, 0.5), page)).toBeLessThan(3);
});

/**
 * The state a utility waits for, with `group-` and `/item` off it, so a fill painted on hover is
 * matched against the ink that applies on hover rather than the one it replaces. `placeholder:`
 * is not a state: a placeholder is what an empty field shows, under no condition at all.
 */
const STATE = /^(?:group-)?(hover|focus-visible|focus|active)(?:\/[\w-]+)?$/;

const gateOf = (one: string) => {
  const modifiers = one.split(":").slice(0, -1);
  const [, state] = STATE.exec(modifiers.find((modifier) => STATE.test(modifier)) ?? "") ?? [];

  return state ?? "";
};

/** The colours a class string writes as text under a state, less what an inactive control wears. */
const inksIn = (classes: string, state = "") => {
  const written = classes
    .split(/\s+/)
    .filter((one) => !one.includes("data-disabled:"))
    .flatMap((one) => {
      const [, token] = /text-(pk-[a-z\d-]+)$/.exec(one) ?? [];
      if (!token || !declaredAs.has(`--${token}`) || BELONGS_ON[`--${token}`]) return [];

      return [{ token: `--${token}`, gate: gateOf(one) }];
    });

  const gated = written.filter(({ gate }) => gate !== "" && gate === state);

  return (gated.length > 0 ? gated : written.filter(({ gate }) => gate === "")).map(
    ({ token }) => token,
  );
};

const fillsIn = (classes: string) =>
  classes.split(/\s+/).flatMap((one) => {
    const [, alpha] = /bg-pk-ink\/\[([\d.]+)\]$/.exec(one) ?? [];

    return alpha ? [{ alpha: Number(alpha), state: gateOf(one) }] : [];
  });

/**
 * A fill the kit paints is a ground of its own, and every rule above reads a flat token. The one
 * ground painted under text was the one nothing measured: a combobox placeholder came out at
 * 4.40:1 in a browser inside a card, where the same ink on the page ground is the 4.95:1 the
 * foundations page states. A fill lightens the surface, and the faint ink is the floor on it.
 *
 * What sits under what is read from the block rather than assumed. A `base` object dresses one
 * element, so its own inks answer to any fill a variant adds — but two values of the same variant
 * never appear together, which is why the badge's quiet ink is not paired with the neutral fill it
 * never sits on. A `slots` object puts its root under everything, so a fill there is a ground for
 * every ink in the component; a fill on a leaf is a ground only for its own string.
 *
 * A hover fill is the case a browser sweep cannot reach: 1425 pieces of text measured in place
 * reported nothing, while a hovered nav row put its trailing ink on a lightened ground at 4.40.
 */
const paintedGrounds = (source: string) => {
  const block = /const \w+ = tv\(\{[\s\S]*?\n\}\);/.exec(source)?.[0] ?? "";
  const slotted = /\bslots:\s*\{/.test(block);

  /*
   * Gathered by the key that owns them: a slot is dressed in the `slots` object and again in every
   * variant that touches it, and the state on one half answers the ink on the other. Read as loose
   * strings, the trail's plain ink sat in one and its hover ink in another, so the row's own hover
   * fill was matched against the ink that hover replaces.
   */
  const bySlot = new Map<string, string>();
  for (const [, key, classes] of block.matchAll(/(\w+):\s*\n?\s*"((?:[^"\\]|\\.)*)"/g)) {
    bySlot.set(key!, `${bySlot.get(key!) ?? ""} ${classes!}`);
  }

  const strings = [...bySlot.values()];

  /* A root is under every ink in the component; a base is one element, so its own inks are too. */
  const everywhere = [bySlot.get(slotted ? "root" : "base") ?? ""];

  const pairs = [
    ...everywhere.flatMap((classes) =>
      fillsIn(classes).flatMap(({ alpha, state }) =>
        [...new Set(strings.flatMap((one) => inksIn(one, state)))].map((ink) => ({ ink, alpha })),
      ),
    ),
    ...strings.flatMap((classes) =>
      fillsIn(classes).flatMap(({ alpha, state }) =>
        [
          ...new Set([
            ...(slotted ? [] : everywhere.flatMap((one) => inksIn(one, state))),
            ...inksIn(classes, state),
          ]),
        ].map((ink) => ({ ink, alpha })),
      ),
    ),
  ];

  return [...new Map(pairs.map((pair) => [`${pair.ink}@${pair.alpha}`, pair])).values()];
};

/**
 * The pages hold their own `tv` blocks, so they answer the same way. None of them paints an ink
 * fill today, which means this half of the sweep guards rather than reports — said plainly here
 * so a green run is not read as nine pages measured.
 */
const pageSources = [
  ...readdirSync(appDir).filter((name) => name.endsWith(".tsx")),
  ...readdirSync(new URL("routes/", appDir))
    .filter((name) => name.endsWith(".tsx"))
    .map((name) => `routes/${name}`),
].map((file) => ({ file, source: readFileSync(new URL(file, appDir), "utf8") }));

test("a fill a component paints is a ground its own text clears", () => {
  const ink = declaredAs.get("--pk-ink")!;

  const thin = [...componentSources, ...pageSources].flatMap(({ file, source }) =>
    paintedGrounds(source).flatMap(({ ink: token, alpha }) =>
      seats()
        .map((seat) => ({
          where: `${file}: ${token} on ink at ${alpha} over ${seat}`,
          got: Number(
            contrast(declaredAs.get(token)!, over(ink, declaredAs.get(seat)!, alpha)).toFixed(2),
          ),
        }))
        .filter(({ got }) => got < 4.5),
    ),
  );

  /* Read first: the pairs the block structure is supposed to find, and the one it must not. */
  const badge = paintedGrounds(
    componentSources.find((entry) => entry.file === "badge.tsx")!.source,
  );
  const list = paintedGrounds(
    componentSources.find((entry) => entry.file === "list-item.tsx")!.source,
  );

  expect(badge).toContainEqual({ ink: "--pk-ink-dim", alpha: 0.06 });
  /* Two values of one variant never appear together, so the quiet ink is not on the neutral fill. */
  expect(badge).not.toContainEqual({ ink: "--pk-ink-faint", alpha: 0.06 });

  /* The row that was repaired: under its own hover fill the trail is muted, not faint. */
  expect(list).toContainEqual({ ink: "--pk-ink-muted", alpha: 0.06 });
  expect(list).not.toContainEqual({ ink: "--pk-ink-faint", alpha: 0.06 });

  /* And the shape it had before, planted, so the rule is not passing because it reads nothing. */
  const planted = paintedGrounds(
    'const x = tv({\n  slots: {\n    root: "hover:bg-pk-ink/[0.06]",\n    trail: "text-pk-ink-faint",\n  },\n});',
  );

  expect(planted).toContainEqual({ ink: "--pk-ink-faint", alpha: 0.06 });
  expect(thin).toEqual([]);
});

/**
 * Each ratio a component states in prose, and the two colours it is a ratio between. One of the
 * four was a pair of values in the wrong order, and nothing could catch that while it lived only
 * in a comment.
 */
const CLAIMED = [
  { file: "button.tsx", says: "4.95", ink: "--pk-ink-faint", on: "--pk-surface", alpha: 1 },
  { file: "button.tsx", says: "5.66", ink: "--pk-ink-dim", on: "--pk-surface", alpha: 1 },
  { file: "scroll-area.tsx", says: "1.92", ink: "--pk-line-strong", on: "--pk-surface", alpha: 1 },
  {
    file: "activity-grid.tsx",
    says: "1.36",
    ink: "--pk-ink-bright",
    on: "--pk-accent",
    alpha: 0.7,
  },
] as const;

test("every ratio a component writes down is the ratio it has", () => {
  const wrong = CLAIMED.flatMap(({ file, says, ink, on, alpha }) => {
    const source = componentSources.find((entry) => entry.file === file)?.source;
    if (!source?.includes(says)) return [`${file} no longer says ${says}`];

    const ground = declaredAs.get(on)!;
    const measured = contrast(over(declaredAs.get(ink)!, ground, alpha), ground).toFixed(2);

    return measured === says ? [] : [`${file} says ${says}, the colours give ${measured}`];
  });

  expect(declaredAs.size).toBeGreaterThan(35);
  expect(wrong).toEqual([]);
});

/*
 * Everything above holds the kit to a ratio it states somewhere. Nothing held it to the one WCAG
 * states: 1.4.3 asks 4.5:1 of body text, and a page puts an ink on a ground freely, so the pairs
 * that exist are a small part of the pairs that could. Measuring the drawn pages answers for the
 * first; this answers for both, and for the compositions nobody has written yet.
 */
const styled = [...componentSources.map(({ source }) => source), pages].join("\n");

/** Every `--pk-*` colour some file writes as text. A new ink joins this the day it is written. */
const inks = () => [
  ...new Set(
    [...styled.matchAll(/\btext-(pk-[a-z\d-]+)/g)]
      .map(([, name]) => `--${name!}`)
      .filter((token) => declaredAs.has(token)),
  ),
];

/** The grounds anything may sit on, which is the root and the surfaces a tone can restate. */
const generalGrounds = () =>
  [...declaredAs.keys()].filter((token) => /^--pk-(ground|surface)/.test(token));

/**
 * An ink whose name says where it belongs goes against that ground and no other. `on-accent` is
 * near black and would fail every dark surface, which is not a defect but the name doing its job.
 * Paper is left to the rules above: its ground is a gradient and they read both of its stops.
 */
const BELONGS_ON: Record<string, string> = {
  "--pk-on-accent": "--pk-accent",
  "--pk-pending-ink": "--pk-pending-surface",
};

/** The tile is the other gradient ground, so its ink answers to both stops the way paper does. */
const tileStops = () => {
  const [, near, far] =
    /--pk-tile-face:\s*radial-gradient\([^,]+,\s*(#[\da-f]+),\s*(#[\da-f]+)/i.exec(themeCss) ?? [];

  return [near!, far!];
};

const tooThin = (against: ReadonlyMap<string, readonly string[]>) =>
  [...against]
    .flatMap(([ink, grounds]) =>
      grounds.map((ground) => ({ ink, ground, got: contrast(declaredAs.get(ink)!, ground) })),
    )
    .filter(({ got }) => got < 4.5)
    .map(({ ink, ground, got }) => `${ink} on ${ground} is ${got.toFixed(2)}`)
    .sort();

const pairsToCheck = () => {
  const grounds = generalGrounds().map((token) => declaredAs.get(token)!);

  return new Map(
    inks()
      .filter((ink) => !ink.startsWith("--pk-paper-"))
      .map((ink) => {
        if (ink === "--pk-tile-ink") return [ink, tileStops()] as const;
        const named = BELONGS_ON[ink];

        return [ink, named ? [declaredAs.get(named)!] : grounds] as const;
      }),
  );
};

test("an ink too thin for a ground it can land on is reported", () => {
  const ground = declaredAs.get("--pk-surface")!;

  expect(tooThin(new Map([["--pk-ink-faint", [ground]]]))).toEqual([]);
  expect(tooThin(new Map([["--pk-line-strong", [ground]]]))).toEqual([
    `--pk-line-strong on ${ground} is 1.92`,
  ]);
});

test("every colour the kit writes as text clears 4.5:1 on every ground it can land on", () => {
  const pairs = pairsToCheck();

  expect(tileStops()).toEqual(["#1b2026", "#101317"]);
  expect(generalGrounds().length).toBeGreaterThan(4);
  expect(pairs.size).toBeGreaterThan(9);
  expect(tooThin(pairs)).toEqual([]);
});

/*
 * 1.4.11 asks 3:1 of two things: what identifies a control, and what tells one of its states from
 * another. The focus ring above is one such mark and was the only one checked. For a switch and a
 * slider the identifying mark is the knob, and the state is the track it sits on, so those are the
 * two to hold. The tracks themselves are faint on purpose — 1.37:1 for a switch at rest — and that
 * is allowed, because none of the identifying is being done by them.
 */
const alphaIn = (file: string, pattern: RegExp) => {
  const [, alpha] =
    pattern.exec(componentSources.find((entry) => entry.file === file)!.source) ?? [];

  return Number(alpha);
};

/** Read from the slots, so changing an alpha moves the expectation instead of breaking a number. */
const offTrack = (seat: string) =>
  over(
    declaredAs.get("--pk-ink")!,
    seat,
    alphaIn("switch.tsx", /false:\s*\{\s*root:\s*"bg-pk-ink\/\[([\d.]+)\]/),
  );

const sliderTrack = (seat: string) =>
  over(
    declaredAs.get("--pk-ink")!,
    seat,
    alphaIn("slider.tsx", /track:\s*\n?\s*"[^"]*bg-pk-ink\/\[([\d.]+)\]/),
  );

test("the alphas these rules stand on are the ones the components write", () => {
  expect(alphaIn("switch.tsx", /false:\s*\{\s*root:\s*"bg-pk-ink\/\[([\d.]+)\]/)).toBe(0.14);
  expect(alphaIn("slider.tsx", /track:\s*\n?\s*"[^"]*bg-pk-ink\/\[([\d.]+)\]/)).toBe(0.1);
});

test("the mark that identifies a control clears 3:1 on every seat it can sit on", () => {
  const knob = declaredAs.get("--pk-knob")!;

  const pairs = seats()
    .map((seat) => declaredAs.get(seat)!)
    .flatMap((ground) => [
      { what: "knob on the seat", got: contrast(knob, ground) },
      { what: "knob on the track at rest", got: contrast(knob, offTrack(ground)) },
    ]);

  /* Read first: no seats is no pairs, and no pairs is a green run over nothing. */
  expect(pairs.length).toBeGreaterThan(8);
  expect(pairs.filter(({ got }) => got < 3)).toEqual([]);
});

test("a control's two states are 3:1 apart on every seat", () => {
  const accent = declaredAs.get("--pk-accent")!;

  const pairs = seats()
    .map((seat) => declaredAs.get(seat)!)
    .flatMap((ground) => [
      { what: "switch off against on", got: contrast(offTrack(ground), accent) },
      { what: "slider track against fill", got: contrast(sliderTrack(ground), accent) },
    ]);

  expect(pairs.length).toBeGreaterThan(8);
  expect(pairs.filter(({ got }) => got < 3)).toEqual([]);
});

/**
 * The knob on a filled track is 1.63:1, which is the design and not a miss: a knob on a fill is
 * separated by its shadow, and the state is already carried by the fill at nearly nine to one.
 * Pinned so that a change to either colour has to face the number rather than pass unnoticed.
 */
test("the knob on a filled track is held apart by its shadow, not by contrast", () => {
  const knob = declaredAs.get("--pk-knob")!;
  const accent = declaredAs.get("--pk-accent")!;
  const source = componentSources.find((entry) => entry.file === "switch.tsx")!.source;

  expect(Number(contrast(knob, accent).toFixed(2))).toBe(1.63);
  expect(source).toContain("shadow-pk-knob");
  expect(themeCss).toMatch(/--pk-lift-knob:\s*0 1px 2px rgb\(0 0 0 \/ 0\.45\)/);
});
