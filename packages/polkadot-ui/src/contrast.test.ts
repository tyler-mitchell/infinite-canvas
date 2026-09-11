import { readdirSync, readFileSync } from "node:fs";

import { expect, test } from "vite-plus/test";

import { receiptVariants } from "./components/receipt.tsx";

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

/**
 * The colours a gradient token declares, in the order it draws them. Paper is the one ground that
 * is a gradient, and five rules read its ends; each carried its own copy of this pattern, and the
 * copies had already drifted apart.
 */
const stopsOf = (token: string) =>
  [
    ...(new RegExp(`${token}:[^;]*`, "i").exec(themeCss)?.[0] ?? "").matchAll(/#[\da-f]{3,8}\b/gi),
  ].map(([stop]) => stop);

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

/**
 * A filter is a colour change no token can show, so every rule here reads past it. The kit uses
 * one — the accent button lifts itself under the pointer — and that state therefore sat outside
 * all of them by construction rather than by anyone deciding it should.
 *
 * It is computable rather than opaque: `brightness` multiplies each channel, and CSS runs its
 * filter shorthand in sRGB, which is the space these hex values are already in.
 */
const brighter = (hex: string, by: number) =>
  `#${channels(hex)
    .map((value) =>
      Math.min(255, Math.round(value * by))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;

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
  const [top, foot] = stopsOf("--pk-paper");

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

/**
 * Every seat a control can sit on: the root default, and each one a Surface tone restates.
 *
 * The pages are read as well as the components. None of them names a seat today, so this half
 * guards rather than reports — but a page that painted a ground and seated a control on it would
 * otherwise have been a seat no rule below knew about.
 */
const seats = () => {
  const written = [...componentSources, ...pageSources].flatMap(({ source }) =>
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
  /* The pages hold their own blocks and can paint a ground too, so they answer the same rule. */
  expect(pageSources.length).toBeGreaterThan(8);
  expect(groundsWithoutSeats([...componentSources, ...pageSources])).toEqual([]);
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
  const [top] = stopsOf("--pk-paper");
  const [, named] =
    /\.pk-paper\s*\{[\s\S]*?--pk-ring-seat:\s*var\((--pk-[a-z-]+)\)/.exec(themeCss) ?? [];

  expect(top).toBeDefined();
  expect(named).toBe("--pk-paper-page");
  expect(declaredAs.get(named!)).toBe(top);
});

/**
 * Paper is its own ground and takes its own ring, because the accent at half alpha reaches only
 * 1.31:1 against it. Nothing puts an accent ring on paper today; this pins the ring paper does use,
 * and pins the reason the other one cannot be carried across.
 */
test("the ring paper uses clears 3:1 on paper", () => {
  const page = declaredAs.get("--pk-paper-page")!;

  expect(contrast(declaredAs.get("--pk-paper-ink")!, page)).toBeGreaterThanOrEqual(3);
  expect(contrast(over(declaredAs.get("--pk-accent")!, page, 0.5), page)).toBeLessThan(3);

  /* The three is what a ring is held to. The figure is what the note above says it reaches. */
  expect(contrast(over(declaredAs.get("--pk-accent")!, page, 0.5), page).toFixed(2)).toBe("1.31");
});

/**
 * The rule above weighs the ring against the seat, which is the top of the sheet. The receipt's
 * action is the last thing on the paper, so the ring's outer edge lands on whatever the gradient
 * has reached by then — a colour no rule here had ever read.
 *
 * It clears at both ends, 13.48 at the top and 12.03 at the foot, and now says so. The stops come
 * from the declaration, so darkening the foot of the paper moves the expectation with it.
 */
test("the ring paper uses clears 3:1 at both ends of the sheet", () => {
  const [top, foot] = stopsOf("--pk-paper");
  const ink = declaredAs.get("--pk-paper-ink")!;

  expect([top, foot]).not.toContain(undefined);
  for (const stop of [top!, foot!]) expect(contrast(ink, stop)).toBeGreaterThanOrEqual(3);

  /* The three is what paper is held to. The pair is what the note above says it reaches. */
  expect([contrast(ink, top!).toFixed(2), contrast(ink, foot!).toFixed(2)]).toEqual([
    "13.48",
    "12.03",
  ]);
});

/**
 * The card a reader swipes is painted with a gradient, so its face never enters the token map and
 * every rule above reads past it — the same blindness the paper had, and the reason the paper got
 * its own pair of rules. The deck writes five inks on that face and none had been read against it.
 *
 * Both ends, because a card is tall enough for the gradient to matter: the head sits on the light
 * stop and the foot on the dark one, so a ratio that holds at one end says nothing about the other.
 */
test("every ink the swipe card writes clears 4.5:1 at both ends of its face", () => {
  const [top, foot] = stopsOf("--pk-swipe-face");
  const source = componentSources.find(({ file }) => file === "swipe-deck.tsx")!.source;
  const written = [...source.matchAll(/\btext-(pk-ink[a-z-]*)\b/g)].map(([, one]) => one!);
  const inks = [...new Set(written)];

  expect([top, foot]).not.toContain(undefined);
  /* Read first: a reader that finds no ink agrees with every face it is given. */
  expect(inks.length).toBeGreaterThan(3);
  expect(
    inks.flatMap((name) => {
      const ink = declaredAs.get(`--${name}`)!;

      return [top!, foot!]
        .map((stop) => ({ name, stop, ratio: contrast(ink, stop) }))
        .filter(({ ratio }) => ratio < 4.5)
        .map(({ name: one, stop, ratio }) => `${one} reads ${ratio.toFixed(2)} on ${stop}`);
    }),
  ).toEqual([]);
});

/**
 * The paper's hairline stays far under the three a mark is asked for, and it is exempt because it
 * is decoration. The figure is stated in the component and measured against the gradient there,
 * so it is not restated here. That has been an assumption twice now, so here is what makes it
 * true: the rule renders as a plain div with no role, so it is announced to nobody, and the total
 * it sits above is told apart by weight and size rather than by the line.
 *
 * Emptying the total variant would leave the line as the only thing dividing a total from an item.
 * This fails then, which is the moment to give the hairline a ratio instead of an exemption.
 */
test("the paper hairline is decoration, and the total does not lean on it", () => {
  const foot = stopsOf("--pk-paper").at(-1);
  const source = componentSources.find(({ file }) => file === "receipt.tsx")!.source;
  const [, drawsTheRule] = /function ReceiptRule\(([\s\S]*?)\n}/.exec(source) ?? [];

  expect(contrast(declaredAs.get("--pk-paper-rule")!, foot!)).toBeLessThan(3);
  expect(drawsTheRule).toBeDefined();
  expect(drawsTheRule).not.toContain("role=");

  const plain = receiptVariants({ total: false });
  const total = receiptVariants({ total: true });

  expect(total.name()).not.toBe(plain.name());
  expect(total.amount()).not.toBe(plain.amount());
});

/**
 * The state a utility waits for, with `group-` and `/item` off it, so a fill painted on hover is
 * matched against the ink that applies on hover rather than the one it replaces. `placeholder:`
 * is not a state: a placeholder is what an empty field shows, under no condition at all.
 */
/*
 * The states a modifier can name. Anything missing here is read as no state at all, which is worse
 * than being ignored: an ungated ink is paired with every fill in its slot, including fills it
 * never sits on.
 *
 * `data-highlighted` is how Base UI marks the menu item under the pointer or the arrow keys.
 * `data-active` and `data-selected` mark the nav link on the page you are reading and the chosen
 * row of a select or a combobox. Every one of the three paints a fill, writes an ink, or both.
 *
 * Measured on the nav link, which carries three states in one string: with `data-active` missing,
 * the resting ink was paired against the fill that only the active link paints. Nothing fails on
 * that pair today — it needed a thin resting ink planted to show at all — but it is a wrong answer
 * waiting for the colour to change.
 */
const STATE =
  /^(?:group-)?(hover|focus-visible|focus|active|data-highlighted|data-active|data-selected)(?:\/[\w-]+)?$/;

const gateOf = (one: string) => {
  const modifiers = one.split(":").slice(0, -1);
  const [, state] = STATE.exec(modifiers.find((modifier) => STATE.test(modifier)) ?? "") ?? [];

  return state ?? "";
};

interface Ink {
  readonly token: string;
  readonly alpha: number;
}

/** Two writings of one token at two strengths are two inks, so identity carries the strength. */
const unique = (found: readonly Ink[]) => [
  ...new Map(found.map((ink) => [`${ink.token}@${ink.alpha}`, ink])).values(),
];

/**
 * The colours a class string writes as text under a state, less what an inactive control wears.
 *
 * An ink may be thinned — `text-pk-ink/72` — and the pattern used to end at the token, so a thinned
 * one was dropped rather than read. Nothing pairs one with a painted fill today; the rule reads it
 * now so that the first one to appear is measured rather than skipped.
 */
const inksIn = (classes: string, state = ""): readonly Ink[] => {
  const written = classes
    .split(/\s+/)
    .filter((one) => !one.includes("data-disabled:"))
    .flatMap((one) => {
      const [, token, percent] = /text-(pk-[a-z\d-]+)(?:\/(\d+))?$/.exec(one) ?? [];
      if (!token || !declaredAs.has(`--${token}`) || BELONGS_ON[`--${token}`]) return [];

      return [
        {
          token: `--${token}`,
          alpha: percent === undefined ? 1 : Number(percent) / 100,
          gate: gateOf(one),
        },
      ];
    });

  const gated = written.filter(({ gate }) => gate !== "" && gate === state);

  return (gated.length > 0 ? gated : written.filter(({ gate }) => gate === "")).map(
    ({ token, alpha }) => ({ token, alpha }),
  );
};

/**
 * Every translucent fill the kit paints, whichever colour it thins. The pattern read the ink and
 * only the ink, so the menu's highlighted item — accent at fifteen hundredths, with its own ink
 * written on top — was a real ground under real text that nothing measured.
 *
 * Both spellings count: `bg-pk-ink/[0.06]` and `bg-pk-accent/15` are the same thing said twice.
 */
const fillsIn = (classes: string) =>
  classes.split(/\s+/).flatMap((one) => {
    const [, token, bracketed, percent] =
      /bg-(pk-[a-z\d-]+)(?:\/(?:\[([\d.]+)\]|(\d+)))?$/.exec(one) ?? [];
    if (!token || !declaredAs.has(`--${token}`)) return [];

    const thinned = bracketed ?? percent;

    return [
      {
        token: `--${token}`,
        /* No alpha is an opaque fill, which is a ground like any other and was read as none. */
        alpha: thinned === undefined ? 1 : Number(bracketed ?? Number(percent) / 100),
        state: gateOf(one),
      },
    ];
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
  /*
   * A compound variant dresses one slot under a combination of values, and every entry names the
   * same slot — so merging by key puts four states that never co-occur into one string. The badge
   * is safe because its tones are their own keys; the toggle's are not. Each entry is read as its
   * own group, which is what keeping them apart by key already does everywhere else.
   */
  const compound = /compoundVariants:\s*\[([\s\S]*?)\n {2}\],/.exec(block)?.[1] ?? "";
  const plain = compound === "" ? block : block.replace(compound, "");

  const bySlot = new Map<string, string>();
  for (const [, key, classes] of plain.matchAll(/(\w+):\s*\n?\s*"((?:[^"\\]|\\.)*)"/g)) {
    bySlot.set(key!, `${bySlot.get(key!) ?? ""} ${classes!}`);
  }
  for (const [at, [, entry]] of [...compound.matchAll(/class:\s*\{([\s\S]*?)\}/g)].entries()) {
    const classes = [...entry!.matchAll(/"((?:[^"\\]|\\.)*)"/g)].map(([, one]) => one).join(" ");
    bySlot.set(`compound${at}`, classes);
  }

  const strings = [...bySlot.values()];

  /* A root is under every ink in the component; a base is one element, so its own inks are too. */
  const everywhere = [bySlot.get(slotted ? "root" : "base") ?? ""];

  const pairs = [
    ...everywhere.flatMap((classes) =>
      fillsIn(classes).flatMap(({ token: fill, alpha, state }) =>
        unique(strings.flatMap((one) => inksIn(one, state))).map(({ token, alpha: inkAlpha }) => ({
          fill,
          ink: token,
          alpha,
          inkAlpha,
        })),
      ),
    ),
    ...strings.flatMap((classes) =>
      fillsIn(classes).flatMap(({ token: fill, alpha, state }) =>
        unique([
          ...(slotted ? [] : everywhere.flatMap((one) => inksIn(one, state))),
          ...inksIn(classes, state),
        ]).map(({ token, alpha: inkAlpha }) => ({ fill, ink: token, alpha, inkAlpha })),
      ),
    ),
  ];

  return [
    ...new Map(
      pairs.map((pair) => [`${pair.fill}@${pair.ink}@${pair.alpha}@${pair.inkAlpha}`, pair]),
    ).values(),
  ];
};

/**
 * The pages hold their own `tv` blocks, so they answer the same way. None paints a *thinned* ink
 * fill, and while that was all this rule could see, the page half guarded rather than reported.
 * Reading an opaque fill changed that: three of them now report, and the list below says which,
 * so a green run is not read as nine pages measured when it is really three fills.
 */
const pageSources = [
  ...readdirSync(appDir).filter((name) => name.endsWith(".tsx")),
  ...readdirSync(new URL("routes/", appDir))
    .filter((name) => name.endsWith(".tsx"))
    .map((name) => `routes/${name}`),
].map((file) => ({ file, source: readFileSync(new URL(file, appDir), "utf8") }));

test("a fill a component paints is a ground its own text clears", () => {
  const thin = [...componentSources, ...pageSources].flatMap(({ file, source }) =>
    paintedGrounds(source).flatMap(({ fill, ink: token, alpha, inkAlpha }) =>
      seats()
        .map((seat) => {
          const ground = over(declaredAs.get(fill)!, declaredAs.get(seat)!, alpha);

          return {
            where: `${file}: ${token} on ${fill} at ${alpha} over ${seat}`,
            got: Number(
              contrast(over(declaredAs.get(token)!, ground, inkAlpha), ground).toFixed(2),
            ),
          };
        })
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

  const ON_INK = { fill: "--pk-ink", alpha: 0.06, inkAlpha: 1 };

  expect(badge).toContainEqual({ ...ON_INK, ink: "--pk-ink-dim" });
  /* Two values of one variant never appear together, so the quiet ink is not on the neutral fill. */
  expect(badge).not.toContainEqual({ ...ON_INK, ink: "--pk-ink-faint" });

  /* The row that was repaired: under its own hover fill the trail is muted, not faint. */
  expect(list).toContainEqual({ ...ON_INK, ink: "--pk-ink-muted" });
  expect(list).not.toContainEqual({ ...ON_INK, ink: "--pk-ink-faint" });

  /* The menu's highlighted item: an accent fill nothing used to see, under an ink of its own. */
  const menu = paintedGrounds(componentSources.find((entry) => entry.file === "menu.tsx")!.source);

  expect(menu).toContainEqual({
    fill: "--pk-accent",
    alpha: 0.15,
    ink: "--pk-ink-bright",
    inkAlpha: 1,
  });
  expect(menu).not.toContainEqual({
    fill: "--pk-accent",
    alpha: 0.15,
    ink: "--pk-ink-muted",
    inkAlpha: 1,
  });

  /* And the shape it had before, planted, so the rule is not passing because it reads nothing. */
  const planted = paintedGrounds(
    'const x = tv({\n  slots: {\n    root: "hover:bg-pk-ink/[0.06]",\n    trail: "text-pk-ink-faint",\n  },\n});',
  );

  /* Planted thinned, which the rule used to drop on the floor rather than measure. */
  const thinned = paintedGrounds(
    'const x = tv({\n  slots: {\n    root: "hover:bg-pk-ink/[0.06]",\n    trail: "text-pk-ink-faint/50",\n  },\n});',
  );

  /*
   * What the rule reaches, said out loud so a shrinking reach fails rather than passing quietly.
   * The four beyond the surface family are what reading an opaque fill bought: the accent, the
   * keycap's face, the receipt's mark and the aurora's void. A fill nothing writes text on — the
   * grid's levels, the tray — makes no pair, which is right rather than missing.
   *
   * The void is the aurora's base and not its ground: three blobs lighten it, and a lighter ground
   * is the worse case for light text, so passing here does not answer for the card.
   */
  expect(
    [
      ...new Set(
        [...componentSources, ...pageSources].flatMap(({ source }) =>
          paintedGrounds(source).map(({ fill }) => fill),
        ),
      ),
    ].sort(),
  ).toEqual([
    "--pk-accent",
    "--pk-ground",
    "--pk-ink",
    "--pk-keycap-face",
    "--pk-paper-ink",
    "--pk-pending-surface",
    "--pk-surface",
    "--pk-surface-deep",
    "--pk-surface-inner",
    "--pk-surface-sunken",
    "--pk-void",
  ]);
  /* An opaque fill is the ground itself, so it composites at full: naming the fills alone would
   * not have caught a reader that found them and then mixed them away to nothing. */
  expect(
    paintedGrounds(
      'const x = tv({\n  slots: {\n    root: "bg-pk-accent",\n    label: "text-pk-ink-faint",\n  },\n});',
    ),
  ).toContainEqual({ fill: "--pk-accent", alpha: 1, ink: "--pk-ink-faint", inkAlpha: 1 });
  /* The page half, named separately: it reported nothing until an opaque fill was a fill. */
  expect(
    [
      ...new Set(
        pageSources.flatMap(({ source }) => paintedGrounds(source).map(({ fill }) => fill)),
      ),
    ].sort(),
  ).toEqual(["--pk-ground", "--pk-surface", "--pk-surface-inner"]);
  expect(planted).toContainEqual({ ...ON_INK, ink: "--pk-ink-faint" });
  expect(thinned).toContainEqual({ ...ON_INK, ink: "--pk-ink-faint", inkAlpha: 0.5 });
  expect(thin).toEqual([]);
});

/**
 * A ground is not always a token. A fill lightens the surface under it, and the paper is a
 * gradient whose far end is the worst case. Both are read from the declaration.
 */
type Ground =
  | string
  | { readonly fill: string; readonly alpha: number; readonly over: string }
  | { readonly farEndOf: string };

const groundIs = (on: Ground) => {
  if (typeof on === "string") return declaredAs.get(on);
  if ("farEndOf" in on) return stopsOf(on.farEndOf).at(-1);

  return over(declaredAs.get(on.fill)!, declaredAs.get(on.over)!, on.alpha);
};

/** What WCAG asks for. A comment may cite one without the kit ever measuring it. */
const THRESHOLDS = new Set(["3:1", "4.5:1", "7:1"]);

/**
 * Every ratio a comment states. `4.95` and `1.92:1` are the same claim written two ways, so both
 * reduce to the number. A threshold is what the standard asks, not what these colours give.
 */
const ratiosStatedIn = (source: string) =>
  [...source.matchAll(/\/\*[\s\S]*?\*\/|\/\/.*/g)]
    .flatMap(([comment]) => [...comment.matchAll(/\b\d+(?:\.\d+)?:1\b|\b\d+\.\d\d\b/g)])
    .map(([found]) => found)
    .filter((found) => !THRESHOLDS.has(found))
    .map((found) => found.replace(":1", ""));

/**
 * Each ratio a component states in prose, and the two colours it is a ratio between. One was a
 * pair of values in the wrong order, and nothing could catch that while it lived only in a comment.
 *
 * Three rows measure a ratio the kit deliberately does not draw. Each states what a colour would
 * reach if it were left alone, which is the reason the component reaches for another one. A
 * counterfactual is the number nobody can check by looking at the page.
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
  {
    file: "input.tsx",
    says: "4.40",
    ink: "--pk-ink-faint",
    on: { fill: "--pk-ink", alpha: 0.06, over: "--pk-surface" },
    alpha: 1,
  },
  {
    file: "list-item.tsx",
    says: "4.40",
    ink: "--pk-ink-faint",
    on: { fill: "--pk-ink", alpha: 0.06, over: "--pk-surface" },
    alpha: 1,
  },
  {
    file: "receipt.tsx",
    says: "1.54",
    ink: "--pk-paper-rule",
    on: { farEndOf: "--pk-paper" },
    alpha: 1,
  },
] as const satisfies readonly {
  file: string;
  says: string;
  ink: string;
  on: Ground;
  alpha: number;
}[];

test("every ratio a component writes down is the ratio it has", () => {
  const wrong = CLAIMED.flatMap(({ file, says, ink, on, alpha }) => {
    const source = componentSources.find((entry) => entry.file === file)?.source;
    if (!source?.includes(says)) return [`${file} no longer says ${says}`];

    const ground = groundIs(on);
    if (!ground) return [`${file} names a ground the theme does not declare`];

    const measured = contrast(over(declaredAs.get(ink)!, ground, alpha), ground).toFixed(2);

    return measured === says ? [] : [`${file} says ${says}, the colours give ${measured}`];
  });

  /* A table answers for the rows it holds. This asks what the components state. */
  const covered = new Set(CLAIMED.map(({ file, says }) => `${file} ${says}`));
  const stated = componentSources.flatMap(({ file, source }) =>
    ratiosStatedIn(source).map((says) => `${file} ${says}`),
  );

  expect(declaredAs.size).toBeGreaterThan(35);
  expect(wrong).toEqual([]);
  /* Were the reader to find nothing, the line below would pass by reaching nothing. */
  expect(stated.length).toBeGreaterThan(6);
  expect(stated.filter((claim) => !covered.has(claim))).toEqual([]);
});

/*
 * Everything above holds the kit to a ratio it states somewhere. Nothing held it to the one WCAG
 * states: 1.4.3 asks 4.5:1 of body text, and a page puts an ink on a ground freely, so the pairs
 * that exist are a small part of the pairs that could. Measuring the drawn pages answers for the
 * first; this answers for both, and for the compositions nobody has written yet.
 */
const styled = [...componentSources.map(({ source }) => source), pages].join("\n");

/** Every `--pk-*` colour some file writes as text. A new ink joins this the day it is written. */
/**
 * Every ink the kit writes, at the strength it writes it. An ink may carry an alpha — the aurora's
 * label is `text-pk-ink/72`, the terminal's running prompt is `text-pk-accent/60` — and reading the
 * token alone measured both at full, which certifies a stronger ink than the kit ever draws.
 */
const inks = () => [
  ...new Map(
    [...styled.matchAll(/\btext-(pk-[a-z\d-]+)(?:\/(\d+))?/g)]
      .map(([, name, percent]) => ({
        token: `--${name!}`,
        alpha: percent === undefined ? 1 : Number(percent) / 100,
      }))
      .filter(({ token }) => declaredAs.has(token))
      .map((ink) => [`${ink.token}@${ink.alpha}`, ink] as const),
  ).values(),
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

/**
 * The tile is the other gradient ground, so its ink answers to both stops the way paper does — and
 * to both again under the bloom, which is an accent laid over the bottom corner. The initials sit
 * in the middle, so the ground beneath them runs from the bare face to the lit one and the bare
 * stops alone are a ground no letter actually stands on.
 */
const tileStops = () => {
  const [, near, far] =
    /--pk-tile-face:\s*radial-gradient\([^,]+,\s*(#[\da-f]+),\s*(#[\da-f]+)/i.exec(themeCss) ?? [];
  const [, channels, alpha] =
    /--pk-tile-bloom:[^;]*?rgb\(([\d\s]+)\s*\/\s*([\d.]+)\)/i.exec(themeCss) ?? [];
  const bloom = `#${channels!
    .trim()
    .split(/\s+/)
    .map((one) => Number(one).toString(16).padStart(2, "0"))
    .join("")}`;
  const lit = (stop: string) => over(bloom, stop, Number(alpha));

  return [near!, far!, lit(near!), lit(far!)];
};

interface Against {
  readonly token: string;
  readonly alpha: number;
  readonly grounds: readonly string[];
}

/* An ink with an alpha is the colour it composites to over the ground it lands on, not the token. */
const tooThin = (against: readonly Against[]) =>
  against
    .flatMap(({ token, alpha, grounds }) =>
      grounds.map((ground) => ({
        token,
        alpha,
        ground,
        got: contrast(over(declaredAs.get(token)!, ground, alpha), ground),
      })),
    )
    .filter(({ got }) => got < 4.5)
    .map(
      ({ token, alpha, ground, got }) =>
        `${token}${alpha === 1 ? "" : ` at ${alpha}`} on ${ground} is ${got.toFixed(2)}`,
    )
    .sort();

const pairsToCheck = (): readonly Against[] => {
  const grounds = generalGrounds().map((token) => declaredAs.get(token)!);

  return inks()
    .filter(({ token }) => !token.startsWith("--pk-paper-"))
    .map(({ token, alpha }) => {
      if (token === "--pk-tile-ink") return { token, alpha, grounds: tileStops() };
      const named = BELONGS_ON[token];

      return { token, alpha, grounds: named ? [declaredAs.get(named)!] : grounds };
    });
};

test("an ink too thin for a ground it can land on is reported", () => {
  const ground = declaredAs.get("--pk-surface")!;

  expect(tooThin([{ token: "--pk-ink-faint", alpha: 1, grounds: [ground] }])).toEqual([]);
  expect(tooThin([{ token: "--pk-line-strong", alpha: 1, grounds: [ground] }])).toEqual([
    `--pk-line-strong on ${ground} is 1.92`,
  ]);
  /* The same ink thinned is a different colour, and the report says which strength it read. */
  expect(tooThin([{ token: "--pk-ink-faint", alpha: 0.4, grounds: [ground] }])).toEqual([
    `--pk-ink-faint at 0.4 on ${ground} is 1.76`,
  ]);
});

test("every colour the kit writes as text clears 4.5:1 on every ground it can land on", () => {
  const pairs = pairsToCheck();

  expect(generalGrounds().length).toBeGreaterThan(4);
  expect(pairs.length).toBeGreaterThan(9);
  /* Read first: the two inks the kit thins are in the sweep, at the strength they are written. */
  expect(
    pairs.filter(({ alpha }) => alpha !== 1).map(({ token, alpha }) => `${token}@${alpha}`),
  ).toEqual(["--pk-ink@0.72", "--pk-accent@0.6"]);
  expect(tooThin(pairs)).toEqual([]);
  /*
   * Last, so a changed bloom reports the ink it starves rather than the list of grounds. Pinned
   * rather than counted: the face at both stops, then both again under the bloom laid over them.
   */
  expect(tileStops()).toEqual(["#1b2026", "#101317", "#173c38", "#0e312b"]);
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

/**
 * The toggle's two states, which neither rule above reaches: those answer for the switch and the
 * slider, and a toggle group tells pressed from unpressed with a fill of its own.
 *
 * The two looks are separated by different things, and asking one question of both gets a wrong
 * answer. Chips are separated by fill: pressed is the accent, resting is ink thinned, and those
 * stand apart on their own. Segmented is not — an opaque surface on a trough of thinned ink comes
 * out between 1.00 and 1.06, which is no fill contrast at all, and the first version of this rule
 * called that a defect.
 *
 * It is not the knob's pattern either, which was the second guess. The pressed item does carry the
 * knob's shadow, but a shadow separates a white knob from a bright track by being dark, and here
 * the item and its trough are both dark already: measured that way it comes out at 1.05, no better
 * than the fill. What tells the two apart is the words — bright when pressed, dim when not, and
 * 3.39 between them, which is the pair this rule holds.
 *
 * A ratio that cannot be computed is the trap here rather than a low one: an alpha the pattern
 * misses gives NaN, and NaN is not less than three, so it would pass the filter unseen.
 */
test("a toggle tells its two states apart by 3:1 on every seat", () => {
  const accent = declaredAs.get("--pk-accent")!;
  const ink = declaredAs.get("--pk-ink")!;
  const resting = alphaIn(
    "toggle-group.tsx",
    /look:\s*"chips",\s*\n\s*pressed:\s*false[\s\S]*?bg-pk-ink\/\[([\d.]+)\]/,
  );

  /* The words carry the segmented state and answer the same on every seat, so they are said once. */
  const pairs = [
    {
      what: "segmented pressed against resting, by its words",
      got: contrast(declaredAs.get("--pk-ink-bright")!, declaredAs.get("--pk-ink-dim")!),
    },
    ...seats()
      .map((seat) => declaredAs.get(seat)!)
      .map((ground) => ({
        what: "chips pressed against resting",
        got: contrast(accent, over(ink, ground, resting)),
      })),
  ];

  /* One pair for the words, and one for the chips on each seat: a floor copied from the rules
   * below would have been eight, which this shape never reaches. */
  expect(seats().length).toBeGreaterThan(4);
  expect(pairs.length).toBe(seats().length + 1);
  expect(pairs.filter(({ got }) => !Number.isFinite(got))).toEqual([]);
  expect(pairs.filter(({ got }) => got < 3)).toEqual([]);
  /* Last, so it cannot fire ahead of the ratios: the lift is real, it is just not what separates. */
  expect(componentSources.find((entry) => entry.file === "toggle-group.tsx")!.source).toContain(
    "shadow-pk-knob",
  );
});

/**
 * The box and the dot carry the switch's shape — the accent when set, thinned ink when not, and
 * thinner still under the pointer — and the rule below reads the switch and the slider by name, so
 * neither was ever measured. The hovered pair is the one worth having: a reader running the pointer
 * across a row of unset boxes must not read the one under it as set.
 *
 * The set is found by that shape rather than listed, so a fourth control written the same way is
 * measured on the day it is written.
 */
const SET_BY_A_FILL = ["checkbox.tsx", "radio.tsx", "switch.tsx"];
const RESTING_AND_HOVERED =
  /false:\s*\{\s*root:\s*"bg-pk-ink\/\[([\d.]+)\]\s+hover:bg-pk-ink\/\[([\d.]+)\]"/;

/**
 * Every fill a filter brightens, measured against the ink written beside it. One string carries
 * all three today — the accent button's fill, its ink, and the lift — and the lift makes it easier
 * to read rather than harder, 11.82 becoming 14.45. That is the answer, and it was never asked.
 */
test("a fill a filter brightens still carries its own text", () => {
  const lifted = componentSources.flatMap(({ file, source }) =>
    [...source.matchAll(/"([^"]*\bbrightness-(\d+)\b[^"]*)"/g)].map(([, classes, percent]) => {
      const written = classes
        .split(/\s+/)
        .filter((one) => !one.includes("data-disabled:"))
        .join(" ");
      const [, fill] = /(?:^|\s)bg-(pk-[a-z\d-]+)(?:\s|$)/.exec(written) ?? [];
      const [, ink] = /(?:^|\s)text-(pk-[a-z\d-]+)(?:\s|$)/.exec(written) ?? [];

      return { file, fill, ink, percent };
    }),
  );

  const pairs = lifted
    .filter(({ fill, ink }) => fill !== undefined && ink !== undefined)
    .map(({ file, fill, ink, percent }) => ({
      what: `${file}: ${ink} on ${fill} lifted to ${percent}`,
      got: contrast(
        declaredAs.get(`--${ink}`)!,
        brighter(declaredAs.get(`--${fill}`)!, Number(percent) / 100),
      ),
    }));

  expect(pairs.length).toBe(lifted.length);
  expect(pairs.filter(({ got }) => !Number.isFinite(got))).toEqual([]);
  expect(pairs.filter(({ got }) => got < 4.5)).toEqual([]);
  /* Last: a filter written where the rule cannot pair it is reported rather than skipped. */
  expect(lifted.length).toBeGreaterThan(0);
});

test("a box and a dot tell set from unset, hovered or not, on every seat", () => {
  const accent = declaredAs.get("--pk-accent")!;
  const ink = declaredAs.get("--pk-ink")!;
  const found = componentSources.filter(({ source }) => RESTING_AND_HOVERED.test(source));

  const pairs = found.flatMap(({ file, source }) => {
    const [, resting, hovered] = RESTING_AND_HOVERED.exec(source) ?? [];

    return seats()
      .map((seat) => declaredAs.get(seat)!)
      .flatMap((ground) => [
        {
          what: `${file}: unset against set`,
          got: contrast(over(ink, ground, Number(resting)), accent),
        },
        {
          what: `${file}: hovered against set`,
          got: contrast(over(ink, ground, Number(hovered)), accent),
        },
      ]);
  });

  expect(pairs.length).toBeGreaterThan(8);
  expect(pairs.filter(({ got }) => !Number.isFinite(got))).toEqual([]);
  expect(pairs.filter(({ got }) => got < 3)).toEqual([]);
  /* Last, so a new control of this shape is reported by name rather than hiding a low ratio. */
  expect(found.map(({ file }) => file).sort()).toEqual(SET_BY_A_FILL);
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
  /*
   * Both knobs, read rather than named. The rule read the switch alone, and the slider draws the
   * same white on the same accent with the same shadow, so the two ratios below are its numbers
   * too — but it could have lost the shadow without a word.
   */
  const knobs = componentSources.filter(({ source }) => source.includes("bg-pk-knob"));

  expect(knobs.map(({ file }) => file).sort()).toEqual(["slider.tsx", "switch.tsx"]);
  expect(knobs.filter(({ source }) => source.includes("shadow-pk-knob"))).toHaveLength(
    knobs.length,
  );
  expect(Number(contrast(knob, accent).toFixed(2))).toBe(1.63);
  /* Read rather than asserted: written as a fixed number here, it fired first and hid the two
   * ratios below, which are what the claim actually rests on. */
  const [, alpha] = /--pk-lift-knob:\s*0 1px 2px rgb\(0 0 0 \/ ([\d.]+)\)/.exec(themeCss) ?? [];
  /*
   * The shadow is what does the separating, so its own ratio is the one that has to clear 3:1 —
   * the rule above pinned that the shadow exists and never that it works. Two ratios answer for
   * it, and the second is the one with no room: the knob stands well clear of its own shadow, and
   * the shadow is only just visible against the track it is cast on. A darker accent or a thinner
   * shadow takes that below three, and neither would look like a contrast change while making one.
   *
   * Along the bottom only, since the shadow is offset a pixel down: the top edge of the knob meets
   * the accent at the 1.63 above, and the shape carries it there.
   */
  const band = over("#000000", accent, Number(alpha));

  /* A floor, not the value: the value belongs to the ratios, and asserting it here would hide
   * them exactly as the fixed regex did. */
  expect(alpha).toBeDefined();
  expect(Number(contrast(knob, band).toFixed(2))).toBe(5.01);
  expect(Number(contrast(band, accent).toFixed(2))).toBe(3.07);
});
