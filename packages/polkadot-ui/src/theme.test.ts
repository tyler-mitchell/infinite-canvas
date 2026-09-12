import { readdirSync, readFileSync } from "node:fs";

import { expect, test } from "vite-plus/test";

/*
 * Read as files rather than imported: Vite's CSS pipeline claims a `?raw` import of a stylesheet
 * and hands back an empty string, which would make every check below pass while proving nothing.
 */
const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

const themeCss = read("./theme.css");
const componentDir = new URL("./components/", import.meta.url);
const componentFiles = readdirSync(componentDir).filter(
  (name) => name.endsWith(".tsx") && !name.endsWith(".test.tsx"),
);

/** Which `@theme` namespace a Tailwind prefix reads. `text-` may be a size or a colour. */
const NAMESPACE: Record<string, readonly string[]> = {
  accent: ["color"],
  animate: ["animate"],
  bg: ["color"],
  border: ["color"],
  caret: ["color"],
  decoration: ["color"],
  ease: ["ease"],
  fill: ["color"],
  font: ["font"],
  from: ["color"],
  "inset-ring": ["color"],
  outline: ["color"],
  ring: ["color"],
  rounded: ["radius"],
  shadow: ["shadow"],
  stroke: ["color"],
  text: ["text", "color"],
  to: ["color"],
  via: ["color"],
};

interface Reference {
  readonly candidates: readonly string[];
  readonly written: string;
  readonly file: string;
}

/**
 * A side reads the same namespace as the utility it is a side of: `rounded-b-pk-tray` is the tray
 * radius on one edge. Stripping it keeps one entry per family in the map above rather than one per
 * corner, and a family the map has never heard of is reported by the rule below instead.
 */
const SIDE = /-(?:t|r|b|l|tl|tr|br|bl|x|y|s|e|ss|se|ee|es)$/;

const namespacesFor = (prefix: string) => NAMESPACE[prefix] ?? NAMESPACE[prefix.replace(SIDE, "")];

/**
 * Every `prefix-pk-name` a file writes, against the tokens that could satisfy it.
 *
 * This read `src` alone until a page was given `bg-pk-nonexistent` and the whole suite stayed
 * green: a utility naming a token the sheet never declared compiles to nothing, so the element
 * simply loses its background. Nine other rules here already read the pages; this one did not.
 */
const referencesIn = (
  sources: readonly { readonly file: string; readonly source: string }[],
): readonly Reference[] =>
  sources.flatMap(({ file, source }) =>
    [...source.matchAll(/\b([a-z-]+)-pk-([a-z\d-]+)/g)].flatMap(([, prefix, rest]) => {
      const namespaces = namespacesFor(prefix!);
      if (!namespaces) return [];

      const name = rest!.replace(/\/.*$/, "");

      return [
        {
          candidates: namespaces.map((namespace) => `--${namespace}-pk-${name}`),
          written: `${prefix}-pk-${name}`,
          file,
        },
      ];
    }),
  );

const declared = new Set(
  [...themeCss.matchAll(/^\s+(--[a-z]+-pk-[a-z\d-]+):/gm)].map(([, token]) => token!),
);

const appDir = new URL("../app/", import.meta.url);
const appFiles = [
  ...readdirSync(appDir).filter((name) => name.endsWith(".tsx")),
  ...readdirSync(new URL("routes/", appDir))
    .filter((name) => name.endsWith(".tsx"))
    .map((name) => `routes/${name}`),
];

const drawn = [
  ...componentFiles.map((file) => readFileSync(new URL(file, componentDir), "utf8")),
  ...appFiles.map((file) => readFileSync(new URL(file, appDir), "utf8")),
  read("./motion.ts"),
].join("\n");

/**
 * Every utility any file writes. The pages count: `shadow-pk-tray` is drawn by a page and by no
 * component, so a rule that read `src` alone would call a live token dead.
 */
const utilities = new Set(
  [...drawn.matchAll(/\b([a-z-]+)-pk-([a-z\d-]+)/g)].map(
    ([, prefix, name]) => `${prefix}-pk-${name!.replace(/\/.*$/, "")}`,
  ),
);

test("the theme and the components are both read", () => {
  expect(componentFiles.length).toBeGreaterThan(30);
  expect(declared.size).toBeGreaterThan(50);
  expect(referencesIn(styledSources).length).toBeGreaterThan(100);
  expect(appFiles.length).toBeGreaterThan(10);
  expect(utilities.size).toBeGreaterThan(50);

  /*
   * The two halves are counted above and the mixture is what every sweep below actually reads.
   * Built from the components alone it still cleared a hundred references, so that floor says the
   * input is not empty and never that it is whole — and eight of the sweeps went on reading half
   * the surface without a word. Which is the fault the note on `styledSources` already records.
   */
  expect(styledSources.filter(({ file }) => componentFiles.includes(file))).toHaveLength(
    componentFiles.length,
  );
  expect(styledSources.filter(({ file }) => appFiles.includes(file))).toHaveLength(appFiles.length);
});

/*
 * This one is subsumed, and says so rather than reading as a second guarantee. A `pk-` utility
 * whose token the sheet never declared cannot compile to a rule either, so `utilities.test.ts`
 * fails on the same change — measured both ways: `bg-pk-nonexistent` on a page fails this rule and
 * that one, and `size-16x` fails only that one. No mutation was found that fails only this.
 *
 * Kept for what it does differently rather than for what it catches: it names the token and the
 * file that wrote it where the other says a class built nothing, and it reads the sources without
 * building a stylesheet, so it still answers when the build is what broke.
 */
test("every token a component draws with is one the theme declares", () => {
  const missing = referencesIn(styledSources)
    .filter((reference) => !reference.candidates.some((token) => declared.has(token)))
    .map((reference) => `${reference.written} in ${reference.file}`);

  expect([...new Set(missing)]).toEqual([]);
});

/**
 * The rule above reads the map, and a prefix the map has never heard of it skips — so the utility
 * that prefix writes is checked by nothing at all. Two were in that position: `inset-ring-pk-*` on
 * the scroll area and `rounded-b-pk-*` on two page trays. Both name real tokens today; a typo
 * under either would have compiled to no rule and lost the ring or the corner in silence.
 *
 * So an unknown prefix is now the failure rather than the exemption. The map grows when the kit
 * reaches for a family it has not used before, which is exactly when someone should look.
 */
const unmapped = (sources: readonly { readonly file: string; readonly source: string }[]) => [
  ...new Set(
    sources.flatMap(({ source }) =>
      [...source.matchAll(/\b([a-z-]+)-pk-[a-z\d-]+/g)]
        .map(([, prefix]) => prefix!)
        .filter((prefix) => namespacesFor(prefix) === undefined),
    ),
  ),
];

/**
 * `text-` is the one prefix that reads two namespaces: `text-pk-label` is a size and
 * `text-pk-ink-dim` is a colour, and a reference passes when either declares it. That leniency is
 * exact only while no name is declared in both — the day one is, a utility means two things and
 * the rule cannot say which. They are disjoint today, thirty-one names and no overlap, and this
 * keeps them that way rather than trusting it.
 */
test("no name is declared as both a size and a colour", () => {
  const named = (namespace: string) =>
    new Set(
      [...themeCss.matchAll(new RegExp(String.raw`^\s+--${namespace}-(pk-[a-z\d-]+):`, "gm"))].map(
        ([, name]) => name!,
      ),
    );

  const sizes = named("text");
  const colours = named("color");

  expect(sizes.size).toBeGreaterThan(10);
  expect(colours.size).toBeGreaterThan(10);
  expect([...sizes].filter((name) => colours.has(name))).toEqual([]);
});

test("a prefix the map has never heard of is reported", () => {
  expect(unmapped([{ file: "p.tsx", source: '"bg-pk-surface rounded-b-pk-tray"' }])).toEqual([]);
  expect(unmapped([{ file: "p.tsx", source: '"outline-offset-pk-tray"' }])).toEqual([
    "outline-offset",
  ]);
});

test("every prefix the kit writes is one the map reads", () => {
  /* The two that were invisible, pinned: one added to the map, one reached through its side. */
  expect(namespacesFor("inset-ring")).toEqual(["color"]);
  expect(namespacesFor("rounded-b")).toEqual(["radius"]);
  expect(unmapped(styledSources)).toEqual([]);
});

/**
 * The namespaces that exist only to be written, and the prefix each is written with.
 *
 * Colours and sizes are left out for the same reason, and it is not that they cannot be checked.
 * Both are public surfaces: the palette and the type scale are what a consumer builds with, so a
 * name this kit happens not to draw is still one somebody reaches for. The four below are the
 * kit's own machinery, and one nothing draws is dead weight in a stylesheet a consumer ships.
 *
 * All sixteen sizes are in fact drawn — counted, from once for the display to twelve for the mono —
 * so a rule would report nothing today. It would be reporting the wrong thing.
 */
const WRITTEN_AS: Record<string, string> = {
  animate: "animate",
  ease: "ease",
  radius: "rounded",
  shadow: "shadow",
};

/**
 * Comments removed. Every rule in this file asks about code, and the doc comments here name the
 * very things those rules search for — a role, an attribute, a prop, a class. Read over the whole
 * file a rule gets the answer wrong in both directions, and both have happened: a note in
 * `text.tsx` warning that a chart wrapped in a `Readout` loses its picture role was counted as a
 * component drawing one, and a reader ran past a comment's end and took the prose after it as
 * code. Neither was found by looking; each was found by a rule failing for the wrong reason.
 */
const codeOf = (source: string) => source.replaceAll(/\/\*[\s\S]*?\*\/|\/\/.*/g, "");

test("a mention in a comment is not code", () => {
  expect(codeOf('/* a chart carries role="img" */\nconst a = 1;')).not.toContain('role="img"');
  expect(codeOf("// pass tabIndex={0}\nconst a = 1;")).not.toContain("tabIndex");
  expect(codeOf('<div role="img" />')).toContain('role="img"');
});

const componentSources = componentFiles.map((file) => ({
  file,
  source: codeOf(readFileSync(new URL(file, componentDir), "utf8")),
}));

const appSources = appFiles.map((file) => ({
  file,
  source: codeOf(readFileSync(new URL(file, appDir), "utf8")),
}));

/**
 * The pages hold `tv` slots of their own, so a rule that reads only `src` checks half the surface
 * while looking like it checked all of it. Eleven slots on the pages broke these rules while the
 * component-only versions reported clean.
 */
const styledSources = [
  ...componentSources,
  ...appSources,
  /* The transition recipes live here now, so a rule that read the two directories alone would see
   * a kit that names no easing and no duration at all. */
  { file: "motion.ts", source: codeOf(read("./motion.ts")) },
];

/**
 * `codeOf` cuts a line at `//`, and a `//` inside a string would take live code with it — the rest
 * of that line would be invisible to every rule above, silently. No string here holds one today.
 * Writing a stripper that understands strings means writing a parser; pinning the shape this one
 * needs is the cheaper half, and it fails loudly on the day a URL arrives in a class.
 */
const eatenByTheCut = (sources: readonly { readonly file: string; readonly source: string }[]) =>
  sources
    .filter(({ source }) => /(["'`])[^"'`\n]*\/\/[^"'`\n]*\1/.test(source))
    .map(({ file }) => `${file} writes // inside a string, which the comment cut would eat`);

test("a slash pair inside a string is reported", () => {
  expect(eatenByTheCut([{ file: "a.tsx", source: 'const u = "https://x";' }])).toEqual([
    "a.tsx writes // inside a string, which the comment cut would eat",
  ]);
  expect(eatenByTheCut([{ file: "b.tsx", source: "// https://x\nconst a = 1;" }])).toEqual([]);
});

test("no styled file hides code behind a slash pair in a string", () => {
  const raw = [
    ...componentFiles.map((file) => ({ file, source: read(`./components/${file}`) })),
    ...appFiles.map((file) => ({ file, source: readFileSync(new URL(file, appDir), "utf8") })),
    { file: "motion.ts", source: read("./motion.ts") },
  ];

  expect(raw).toHaveLength(styledSources.length);
  expect(eatenByTheCut(raw)).toEqual([]);
});

/**
 * One `tv` call per file is what the README teaches, and it is also what six readers across three
 * suites quietly stand on: each finds the block with `exec`, which returns the first match and says
 * nothing about a second. A file with two would have its second block read by nothing — every slot
 * in it unmeasured, with every rule still green.
 *
 * That is the shape of a bug already found once in this package, where a seat collector used `exec`
 * where it meant `matchAll` and the one seat it could not see was the one that failed. So the
 * convention the readers rest on is pinned here rather than assumed.
 *
 * Two files write none: the app's entry and its router, which wire and draw nothing.
 */
const tvCalls = (sources: readonly { readonly file: string; readonly source: string }[]) =>
  sources.map(({ file, source }) => ({ file, calls: [...source.matchAll(/=\s*tv\(\{/g)].length }));

test("a file with two tv blocks is reported, and one with none is allowed", () => {
  expect(
    tvCalls([
      { file: "a.tsx", source: "const a = tv({ base: 1 });" },
      { file: "b.tsx", source: "const b = tv({});\nconst c = tv({});" },
      { file: "c.tsx", source: "export const routes = [];" },
    ]),
  ).toEqual([
    { file: "a.tsx", calls: 1 },
    { file: "b.tsx", calls: 2 },
    { file: "c.tsx", calls: 0 },
  ]);
});

test("no styled file writes a second tv block, and every component writes one", () => {
  const counted = tvCalls(styledSources);

  expect(counted.filter(({ calls }) => calls > 1)).toEqual([]);
  expect(tvCalls(componentSources).filter(({ calls }) => calls !== 1)).toEqual([]);
  /* Read last: the two that style nothing are named, so a page losing its slots is reported here
   * rather than passing as wiring. */
  expect(
    counted
      .filter(({ calls }) => calls === 0)
      .map(({ file }) => file)
      .sort(),
  ).toEqual(["main.tsx", "motion.ts", "router.tsx"]);
  /* And the teaching, so the README cannot drop the convention while this keeps holding it. */
  expect(readFileSync(new URL("../README.md", import.meta.url), "utf8")).toContain("one tv call");
});

/**
 * A ring offset paints the colour behind the control, so a component that names one has guessed
 * where it sits. Anything that paints a background restates `--pk-ring-seat`, so the cascade
 * answers instead and the control stays ignorant of its seat.
 */
const guessedSeat = (sources: readonly { readonly file: string; readonly source: string }[]) =>
  sources.flatMap(({ file, source }) =>
    [...source.matchAll(/ring-offset-pk-[a-z\d-]+/g)].map(([written]) => `${written} (${file})`),
  );

test("a control that names its own ring offset is reported against its file", () => {
  expect(
    guessedSeat([{ file: "button.tsx", source: "focus-visible:ring-offset-pk-ground" }]),
  ).toEqual(["ring-offset-pk-ground (button.tsx)"]);
  expect(
    guessedSeat([
      { file: "button.tsx", source: "focus-visible:ring-offset-(color:--pk-ring-seat)" },
    ]),
  ).toEqual([]);
});

test("no control names the colour it sits on", () => {
  expect(guessedSeat(styledSources)).toEqual([]);
});

/** Exports nothing draws with. The direction the rule above cannot see. */
const unwritten = (tokens: readonly string[], written: ReadonlySet<string>) =>
  tokens.flatMap((token) => {
    const [, namespace, name] = /^--([a-z]+)-pk-([a-z\d-]+)$/.exec(token) ?? [];
    const prefix = namespace === undefined ? undefined : WRITTEN_AS[namespace];

    if (prefix === undefined || name === undefined) return [];

    return written.has(`${prefix}-pk-${name}`) ? [] : [token];
  });

test("an export nothing draws with is named", () => {
  expect(unwritten(["--ease-pk-swift"], new Set(["ease-pk-swift"]))).toEqual([]);
  expect(unwritten(["--ease-pk-feed"], new Set(["ease-pk-swift"]))).toEqual(["--ease-pk-feed"]);
  /* A colour is exempt, so one no utility draws is not an orphan. */
  expect(unwritten(["--color-pk-recess"], new Set())).toEqual([]);
});

test("every mechanism the theme exports is drawn by some file", () => {
  expect(unwritten([...declared], utilities)).toEqual([]);
});

/**
 * The rule above exempts colours, because a colour is written under a dozen prefixes and one
 * mapping cannot answer for all of them. Asked the other way round it is answerable: a colour is
 * painted when some file writes any utility that resolves to it, or when the sheet uses it in a
 * recipe of its own. The aliases are dropped first — a line that republishes a token under a
 * prefix is not a use of it, and reading them as one made every colour look painted.
 *
 * `--pk-recess` was a colour nothing painted: declared, aliased, listed on the foundations page as
 * a ground, and never used to draw anything.
 */
const colours = [...themeCss.matchAll(/^\s+(--pk-[a-z\d-]+):\s*#[\da-f]{3,8};/gim)].map(
  ([, token]) => token!,
);

const republished = /^\s+--[a-z]+-pk-[a-z\d-]+:\s*var\(--pk-[a-z\d-]+\);$/gm;

/** `border-pk-pane-line` resolves to `pk-pane-line`, and never to the `pk-line` it ends with. */
const tokenOf = (utility: string) => `pk-${utility.split("-pk-").slice(1).join("-pk-")}`;

const unpainted = (
  tokens: readonly string[],
  written: ReadonlySet<string>,
  ...bodies: readonly string[]
) => {
  const painted = new Set([...written].map(tokenOf));

  return tokens.filter(
    (token) =>
      !painted.has(token.slice(2)) && !bodies.some((body) => body.includes(`var(${token})`)),
  );
};

test("a colour nothing paints with is reported", () => {
  const written = new Set(["bg-pk-surface", "border-pk-pane-line"]);

  expect(unpainted(["--pk-surface"], written, "")).toEqual([]);
  expect(unpainted(["--pk-pane-line"], written, "")).toEqual([]);
  /* The name one utility ends with is not the token that utility resolves to. */
  expect(unpainted(["--pk-line"], written, "")).toEqual(["--pk-line"]);
  /* A recipe in the sheet is a consumer; the alias that republishes the token is not. */
  expect(unpainted(["--pk-line"], written, ".pk-tear { border-color: var(--pk-line); }")).toEqual(
    [],
  );
});

test("every colour the theme declares is one some file paints with", () => {
  expect(colours.length).toBeGreaterThan(30);
  expect(unpainted(colours, utilities, drawn, themeCss.replace(republished, ""))).toEqual([]);
});

/**
 * The sheet also writes eight classes by hand — the paper, the tear, the grain, the two rim sweeps
 * and the rest — for the recipes no utility can express. Every rule here reads `tv` slots, so one
 * of these left behind after its last consumer went would be found by nothing: valid CSS, shipped
 * to every consumer, drawn on nothing.
 *
 * The other direction is already covered. A slot naming a class the sheet does not define compiles
 * to no rule at all, which `utilities.test.ts` reports against the variant object that wrote it.
 */
const handWritten = new Set([...themeCss.matchAll(/\.(pk-[a-z\d-]+)/g)].map(([, name]) => name!));

const undrawnRecipe = (classes: ReadonlySet<string>, source: string) =>
  [...classes]
    .filter((name) => !new RegExp(String.raw`(?<![\w-])${name}(?![\w-])`).test(source))
    .sort();

test("a hand written class nothing draws is reported", () => {
  const sheet = new Set(["pk-paper", "pk-tear"]);

  expect(undrawnRecipe(sheet, '"pk-paper pk-tear flex"')).toEqual([]);
  expect(undrawnRecipe(sheet, '"pk-paper flex"')).toEqual(["pk-tear"]);
  /* A utility that shares the name is not the class: `bg-pk-paper` paints, `pk-paper` is a recipe. */
  expect(undrawnRecipe(new Set(["pk-paper"]), '"bg-pk-paper"')).toEqual(["pk-paper"]);
});

test("every class the sheet writes by hand is drawn by some file", () => {
  expect(handWritten.size).toBeGreaterThan(5);
  expect(undrawnRecipe(handWritten, drawn)).toEqual([]);
});

/**
 * Every raw `--pk-*` a page names. The foundations page lists tokens by hand to draw the palette,
 * so a token removed from the sheet leaves a row there that resolves to nothing: a swatch with a
 * name and no colour, which reads as a token that exists rather than one that was deleted.
 */
const namedInPages = (sources: readonly { readonly file: string; readonly source: string }[]) =>
  sources.flatMap(({ file, source }) =>
    [...source.matchAll(/"(--pk-[a-z\d-]+)"/g)].map(([, token]) => ({ token: token!, file })),
  );

/** The sheet's own roots, which is what a page's raw name has to resolve against. */
const roots = new Set([...themeCss.matchAll(/^\s+(--pk-[a-z\d-]+):/gm)].map(([, token]) => token!));

const undeclared = (
  named: readonly { readonly token: string; readonly file: string }[],
  declaredRoots: ReadonlySet<string>,
) =>
  named
    .filter(({ token }) => !declaredRoots.has(token))
    .map(({ token, file }) => `${token} (${file})`);

test("a token a page names but the theme has dropped is reported", () => {
  expect(undeclared([{ token: "--pk-ground", file: "f.tsx" }], new Set(["--pk-ground"]))).toEqual(
    [],
  );
  expect(
    undeclared([{ token: "--pk-ease-feed", file: "f.tsx" }], new Set(["--pk-ground"])),
  ).toEqual(["--pk-ease-feed (f.tsx)"]);
});

test("every token a page names is one the theme still declares", () => {
  const pageSources = appFiles.map((file) => ({
    file,
    source: readFileSync(new URL(file, appDir), "utf8"),
  }));

  expect(roots.size).toBeGreaterThan(50);
  expect(namedInPages(pageSources).length).toBeGreaterThan(20);
  expect(undeclared(namedInPages(pageSources), roots)).toEqual([]);
});

/**
 * What the sheet declares each root as. The foundations page prints a radius and an easing beside
 * the token that owns it, so an edit to the sheet alone would leave the page stating the old value
 * with no sign that it had changed.
 */
const declaredAs = new Map(
  [...themeCss.matchAll(/^\s+(--[a-z][a-z\d-]*):\s*([^;]+);/gm)].map(([, token, value]) => [
    token!,
    value!.trim(),
  ]),
);

/** A printed value against the declaration, with the unit the page leaves off. */
const misprinted = (
  rows: readonly (readonly [token: string, printed: string])[],
  values: ReadonlyMap<string, string>,
  unit = "",
) =>
  rows
    .filter(([token, printed]) => values.get(token) !== `${printed}${unit}`)
    .map(([token, printed]) => `${token} says ${printed}${unit}, sheet says ${values.get(token)}`);

test("a printed value that has drifted from the sheet is reported", () => {
  const sheet = new Map([["--pk-radius-card", "16px"]]);

  expect(misprinted([["--pk-radius-card", "16"]], sheet, "px")).toEqual([]);
  expect(misprinted([["--pk-radius-card", "18"]], sheet, "px")).toEqual([
    "--pk-radius-card says 18px, sheet says 16px",
  ]);
});

test("every radius and easing a page prints is the one the sheet declares", () => {
  const page = appFiles.map((file) => readFileSync(new URL(file, appDir), "utf8")).join("\n");

  const radii = [...page.matchAll(/\["(--pk-radius-[a-z-]+)",\s*"[^"]*",\s*"([^"]*)"\]/g)].map(
    ([, token, printed]) => [token!, printed!] as const,
  );
  const easings = [
    ...page.matchAll(/\["(--pk-ease-[a-z-]+)",\s*"[^"]*",\s*"[^"]*",\s*"([^"]*)"\]/g),
  ].map(([, token, printed]) => [token!, printed!] as const);

  expect(misprinted(radii, declaredAs, "px")).toEqual([]);
  expect(misprinted(easings, declaredAs)).toEqual([]);
  /*
   * The set, not a floor. The page says it names every radius the kit has, and a floor of three let
   * it print five of eight and pass: control, control-inner and pill were missing, and control is
   * the corner on nearly every button, input and select in the kit.
   */
  expect(radii.map(([token]) => token).sort()).toEqual(
    [...roots].filter((token) => token.startsWith("--pk-radius-")).sort(),
  );
  expect(easings.length).toBeGreaterThan(1);
});

/**
 * The same hole, one family over: the hairlines section is the kit's line vocabulary, and it listed
 * four of the five. `--pk-line-inner-raised` was the missing one — the rule inside a card that
 * lifts, which is what a swipe card's foot draws with.
 *
 * Their ratios are checked against the colours they name in `contrast.test.ts`. This asks the other
 * question: that none of them is absent from the page in the first place.
 */
test("every hairline the sheet declares is one the page documents", () => {
  const page = appFiles.map((file) => readFileSync(new URL(file, appDir), "utf8")).join("\n");
  const listed = [...page.matchAll(/\["(--pk-line[a-z-]*)",/g)].map(([, token]) => token!);

  expect(listed.sort()).toEqual(
    [...roots].filter((token) => /^--pk-line[a-z-]*$/.test(token)).sort(),
  );
});

/* Every contrast ratio the kit states or has to clear lives in `contrast.test.ts`. */

/**
 * The type section names a size beside each role. The role's size is not restated here: it is read
 * from `text.tsx`, so moving a role onto a different token moves the expectation with it.
 */
test("every size the type section names is the one its role actually uses", () => {
  const page = appFiles.map((file) => readFileSync(new URL(file, appDir), "utf8")).join("\n");
  const text = readFileSync(new URL("text.tsx", componentDir), "utf8");

  const sizeOfRole = new Map(
    [...text.matchAll(/^ {6}(\w+): "([^"]*)"/gm)].flatMap(([, role, classes]) => {
      const size = [...classes!.matchAll(/text-(pk-[a-z\d-]+)/g)]
        .map(([, name]) => name!)
        .find((name) => declared.has(`--text-${name}`));

      return size ? [[role!, size] as const] : [];
    }),
  );

  /*
   * The roles come from the component rather than from a list written here. Written here, the list
   * held six of the seven and the readout's row went unchecked from the day it was added — and the
   * count pinned below said six, which made the hole look like the answer.
   *
   * `Prose` sits on its own line inside its tag, so the role need not follow the `>` directly.
   */
  const roles = [...sizeOfRole.keys()];
  const named = roles.map((role) => role.charAt(0).toUpperCase() + role.slice(1)).join("|");

  const claimed = [...page.matchAll(new RegExp(String.raw`>\s*(${named}) · (\d+)px`, "g"))].map(
    ([, role, px]) => ({ role: role!.toLowerCase(), px: px! }),
  );

  const wrong = claimed
    .map(({ role, px }) => {
      const token = sizeOfRole.get(role);

      return { role, px, real: token ? declaredAs.get(`--text-${token}`) : "no such role" };
    })
    .filter(({ px, real }) => real !== `${px}px`)
    .map(({ role, px, real }) => `${role} says ${px}px, its token is ${real}`);

  expect(sizeOfRole.get("display")).toBe("pk-display");
  /* Every role the component declares states its size on the page, and every one of them is read. */
  expect([...new Set(claimed.map(({ role }) => role))].sort()).toEqual([...roles].sort());
  expect(wrong).toEqual([]);
});

/** How many readings a fixture holds, whether it is generated or written out. */
const fixtureLength = (source: string, name: string) => {
  const generated = new RegExp(`const ${name}[^=]*=[\\s\\S]{0,40}?length: (\\d+)`).exec(source);
  if (generated) return Number(generated[1]);

  const literal = new RegExp(`const ${name}[^=]*= \\[([^\\]]*)\\]`).exec(source);

  return literal ? literal[1]!.split(",").filter((part) => part.trim()).length : undefined;
};

/**
 * A sparkline's `label` is a name composed onto the reading the component derives, so a count
 * written there is a second copy of a figure the chart already states — free to drift, and for a
 * while three of them had.
 *
 * This used to check the written count against the fixture. Now none is written: the rule asks that
 * none comes back. Inverted rather than deleted, because the old shape went quietly vacuous the
 * moment the last one was removed, and a rule that measures nothing reads exactly like a clean one.
 */
test("no chart names a count the component already derives", () => {
  /* Every page, not just the one that draws the most: the overview states a count as well. */
  const pages = appFiles.map((file) => readFileSync(new URL(file, appDir), "utf8")).join("\n");
  const fixtures = readFileSync(new URL("fixtures.ts", appDir), "utf8");

  const counted = [...pages.matchAll(/<Sparkline\b([\s\S]*?)\/>/g)]
    .map(([, attributes]) => {
      /* Either form of name. A label that has to say a figure as well is written as a template,
       * and reading only the quoted form drops that chart out of the count without saying so. */
      const written = /label=(?:"([^"]*)"|\{`([^`]*)`\})/.exec(attributes!);

      return {
        series: /values=\{(\w+)\}/.exec(attributes!)?.[1],
        label: written === null ? undefined : (written[1] ?? written[2]),
      };
    })
    /* `over 96 hours`, not the 95 in `p95`: the count is the one the phrase counts with. */
    .filter(
      (row): row is { series: string; label: string } =>
        Boolean(row.series) && /\bover \d+\b/.test(row.label ?? ""),
    );

  /* Read first: the fixtures are being read, so an empty result is an empty result. */
  expect(fixtureLength(fixtures, "INSTALLS")).toBe(8);
  expect(pages.length).toBeGreaterThan(10_000);
  expect([...pages.matchAll(/<Sparkline\b/g)].length).toBeGreaterThan(3);

  expect(
    counted.map(({ series, label }) => `${series} names "${label}", which counts for the chart`),
  ).toEqual([]);
});

/**
 * A props table documents what `Api` cannot read, which is anything that is not a `tv` variant.
 * Listing a variant there prints it twice on the page, once in each table. The table is tied to
 * its own component through the entry, because a name such as `open` or `orientation` belongs to
 * several components and comparing against all of them at once only finds collisions.
 */
test("no props table documents a variant its own Api table already prints", () => {
  const entry = read("./index.ts");

  const moduleOfType = new Map(
    [...entry.matchAll(/type (\w+Props)[^}]*?\}\s*from "\.\/components\/([\w-]+)\.tsx"/g)].map(
      ([, type, module]) => [type!, module!],
    ),
  );
  for (const [, list, module] of entry.matchAll(
    /export \{([\s\S]*?)\} from "\.\/components\/([\w-]+)\.tsx"/g,
  )) {
    for (const [, type] of list!.matchAll(/type (\w+Props)/g)) moduleOfType.set(type!, module!);
  }

  const variantsOf = (module: string) => {
    const source = readFileSync(new URL(`${module}.tsx`, componentDir), "utf8");
    const block = /^ {2}variants: \{$([\s\S]*?)^ {2}\},$/m.exec(source)?.[1] ?? "";

    return new Set([...block.matchAll(/^ {4}(\w+):/gm)].map(([, key]) => key!));
  };

  const pages = appFiles.map((file) => ({
    file,
    source: readFileSync(new URL(file, appDir), "utf8"),
  }));

  const doubled = pages.flatMap(({ file, source }) =>
    [...source.matchAll(/<Props<(\w+Props)>([\s\S]*?)\/>/g)].flatMap(([, type, body]) => {
      const module = moduleOfType.get(type!);
      if (!module) return [];

      const variants = variantsOf(module);

      return [...body!.matchAll(/name: "(\w+)"/g)]
        .map(([, name]) => name!)
        .filter((name) => variants.has(name))
        .map(
          (name) =>
            `${type} lists "${name}", which ${module}.tsx already has as a variant (${file})`,
        );
    }),
  );

  expect(moduleOfType.get("FieldProps")).toBe("field");
  expect(variantsOf("field").has("layout")).toBe(true);
  expect(doubled).toEqual([]);
});

/**
 * A variant table says what it documents. Several sections carry more than one, and a reader
 * scrolling past an unnamed one has only the section heading above it to go on.
 */
const unnamedTables = (sources: readonly { readonly file: string; readonly source: string }[]) =>
  sources.flatMap(({ file, source }) =>
    [...source.matchAll(/<Api\s([\s\S]*?)\/>/g)]
      .filter(([, attributes]) => !/\bname=/.test(attributes!))
      .map(([, attributes]) => `${attributes!.trim().split("\n")[0]} (${file})`),
  );

test("a variant table with no name is reported against its page", () => {
  expect(unnamedTables([{ file: "p.tsx", source: '<Api name="row" of={rowVariants} />' }])).toEqual(
    [],
  );
  expect(unnamedTables([{ file: "p.tsx", source: "<Api of={rowVariants} />" }])).toEqual([
    "of={rowVariants} (p.tsx)",
  ]);
});

test("every variant table on a page says what it documents", () => {
  const pages = appFiles.map((file) => ({
    file,
    source: readFileSync(new URL(file, appDir), "utf8"),
  }));

  expect(
    pages.reduce((total, { source }) => total + (source.match(/<Api\s/g)?.length ?? 0), 0),
  ).toBeGreaterThan(15);
  expect(unnamedTables(pages)).toEqual([]);
});

/**
 * The activity grid drops weeks when the width cannot hold them, so how many days it draws is not
 * known where it is written. It states the span it drew in its own label; a day count beside it
 * can only be right at one width, and was wrong twice before this rule existed.
 */
const countedDaysBeside = (source: string) =>
  [...source.matchAll(/<ActivityGrid\b/g)].flatMap((match) => {
    const before = source.slice(Math.max(0, match.index! - 320), match.index!);
    const row = before.lastIndexOf("<Row>");

    return row === -1
      ? []
      : [...before.slice(row).matchAll(/(\d+|\$\{[^}]*\})\s*days/g)].map(([written]) => written);
  });

test("a day count written beside a grid is reported", () => {
  expect(
    countedDaysBeside("<Row><Label>x</Label><Meta>371 days</Meta></Row>\n<ActivityGrid"),
  ).toEqual(["371 days"]);
  expect(
    countedDaysBeside("<Row><Label>x</Label><Meta>weeks fit</Meta></Row>\n<ActivityGrid"),
  ).toEqual([]);
});

test("no page counts the days beside a grid that fits weeks to its width", () => {
  /* Every page. One page draws a grid today, and the rule should not have to be widened again. */
  const pages = appFiles.map((file) => readFileSync(new URL(file, appDir), "utf8")).join("\n");

  expect(pages).toContain("<ActivityGrid");
  expect(countedDaysBeside(pages)).toEqual([]);
});

/**
 * A component that puts itself in the tab order has to say when it is reached. Three did not: the
 * grid and the tab panel wrote `outline-none` and put nothing back, and the deck fell through to
 * the browser's own ring, which is not this kit's mark. All three were silent to a keyboard until
 * they were driven in a browser.
 *
 * Base UI sets `tabIndex` on some of the parts it owns, and that never appears here, so this reads
 * only the focus a component takes for itself.
 */
const unmarkedFocus = (sources: readonly { readonly file: string; readonly source: string }[]) =>
  sources
    .filter(
      ({ source }) => /tabIndex=\{(?!-1\})/.test(source) && !source.includes("focus-visible:"),
    )
    .map(({ file }) => `${file} takes the focus and marks it nowhere`);

test("a component that takes the focus without marking it is reported", () => {
  expect(unmarkedFocus([{ file: "grid.tsx", source: "tabIndex={0} outline-none" }])).toEqual([
    "grid.tsx takes the focus and marks it nowhere",
  ]);
  /* A conditional tab stop is still a tab stop. */
  expect(unmarkedFocus([{ file: "deck.tsx", source: "tabIndex={top ? 0 : -1}" }])).toEqual([
    "deck.tsx takes the focus and marks it nowhere",
  ]);
  expect(
    unmarkedFocus([{ file: "grid.tsx", source: "tabIndex={0} focus-visible:ring-2" }]),
  ).toEqual([]);
  /* Held out of the tab order on purpose, so there is nothing to mark. */
  expect(unmarkedFocus([{ file: "card.tsx", source: "tabIndex={-1}" }])).toEqual([]);
});

test("every component that takes the focus marks it", () => {
  const taking = componentSources.filter(({ source }) => /tabIndex=\{(?!-1\})/.test(source));

  expect(taking.map(({ file }) => file).sort()).toEqual(["activity-grid.tsx", "swipe-deck.tsx"]);
  expect(unmarkedFocus(styledSources)).toEqual([]);
});

/**
 * Base UI's slider keeps the focus on a native range input inside the thumb and clips that input
 * to nothing, so `:focus-visible` matches the input and never the thumb around it. The thumb had
 * carried a ring written that way since it was built, and the ring had never once been drawn: the
 * style was there, the state never arrived. It has to ask about the focus below it instead.
 */
const deadThumbFocus = (sources: readonly { readonly file: string; readonly source: string }[]) =>
  sources
    .filter(({ source }) => /thumb:\s*"?[^"]*"?[^"]*"[^"]*(?<!has-)focus-visible:/.test(source))
    .map(({ file }) => `${file} marks a thumb on a state the thumb never reaches`);

test("a thumb that waits for a focus it cannot receive is reported", () => {
  expect(
    deadThumbFocus([{ file: "slider.tsx", source: 'thumb:\n "size-4 focus-visible:ring-2",' }]),
  ).toEqual(["slider.tsx marks a thumb on a state the thumb never reaches"]);
  expect(
    deadThumbFocus([{ file: "slider.tsx", source: 'thumb:\n "size-4 has-focus-visible:ring-2",' }]),
  ).toEqual([]);
});

test("the slider marks the focus where the focus really is", () => {
  const source = componentSources.find(({ file }) => file === "slider.tsx")?.source;

  expect(source).toContain("has-focus-visible:ring-2");
  expect(deadThumbFocus(styledSources)).toEqual([]);
});

/**
 * Base UI supplies the keyboard for the primitives it owns. Where this kit takes the focus itself
 * and reads keys itself, nothing else will say which keys those are: the visible hint sits beside
 * the component, so it is never announced. Both components that do this were silent until they
 * were driven.
 */
const silentKeyboard = (sources: readonly { readonly file: string; readonly source: string }[]) =>
  sources
    .filter(
      ({ source }) =>
        source.includes("onKeyDown") &&
        source.includes("tabIndex") &&
        !source.includes("aria-keyshortcuts"),
    )
    .map(({ file }) => `${file} takes the focus and reads keys, and says which nowhere`);

test("a component that reads its own keys without saying so is reported", () => {
  expect(silentKeyboard([{ file: "deck.tsx", source: "tabIndex={0} onKeyDown={fn}" }])).toEqual([
    "deck.tsx takes the focus and reads keys, and says which nowhere",
  ]);
  expect(
    silentKeyboard([
      { file: "deck.tsx", source: 'tabIndex={0} onKeyDown={fn} aria-keyshortcuts="ArrowLeft"' },
    ]),
  ).toEqual([]);
});

test("every component that reads its own keys says which keys", () => {
  const handling = componentSources.filter(
    ({ source }) => source.includes("onKeyDown") && source.includes("tabIndex"),
  );

  expect(handling.map(({ file }) => file).sort()).toEqual(["activity-grid.tsx", "swipe-deck.tsx"]);
  expect(silentKeyboard(styledSources)).toEqual([]);
});

/**
 * One keyboard per component. A second handler on a descendant of the first does not replace it —
 * the key runs both on its way up, and neither stops the other, so one press acts twice.
 *
 * The deck carried a second one on the card, unreachable because a card holds nothing that takes
 * focus, and wrong if it ever were. Driven through the card, the page's own count fell from four
 * to two while the deck advanced by one: the same card was announced to the consumer twice. Driven
 * through the well it fell to three, which is the number a press should cost.
 */
const twoKeyboards = (sources: readonly { readonly file: string; readonly source: string }[]) =>
  sources
    .flatMap(({ file, source }) => {
      const attached = [...source.matchAll(/onKeyDown=\{/g)].length;

      return attached > 1 ? [`${file} attaches ${attached} keyboards`] : [];
    })
    .sort();

test("a component that attaches a second keyboard is reported", () => {
  expect(twoKeyboards([{ file: "a.tsx", source: "onKeyDown={one} ... onKeyDown={two}" }])).toEqual([
    "a.tsx attaches 2 keyboards",
  ]);
  /* A handler named once and attached once is the shape the grid has, and is not two. */
  expect(
    twoKeyboards([
      { file: "b.tsx", source: "const onKeyDown = ...; <div onKeyDown={onKeyDown} />" },
    ]),
  ).toEqual([]);
});

test("no component answers one key in two places", () => {
  const attaching = componentSources.filter(({ source }) => source.includes("onKeyDown={"));

  expect(attaching.map(({ file }) => file).sort()).toEqual(["activity-grid.tsx", "swipe-deck.tsx"]);
  expect(twoKeyboards(styledSources)).toEqual([]);
});

/**
 * A pointer that is cancelled was taken away, not let go: the browser claimed the gesture for a
 * scroll, the pointer left the window, the system interrupted. The reader decided nothing, so
 * nothing may be decided for them.
 *
 * The deck gave both the same handler, and a drag past the commit distance that was then cancelled
 * pinned the card and told the consumer it had happened — measured on the page's own count, three
 * left became two. Now a cancel puts the card back: the count holds and the card returns to rest.
 */
const cancelIsRelease = (sources: readonly { readonly file: string; readonly source: string }[]) =>
  sources
    .flatMap(({ file, source }) => {
      const up = /onPointerUp=\{([^}]*)\}/.exec(source)?.[1];
      const cancel = /onPointerCancel=\{([^}]*)\}/.exec(source)?.[1];

      return up && cancel && up === cancel
        ? [`${file} cancels a pointer the way it releases one`]
        : [];
    })
    .sort();

test("a component that treats a cancelled pointer as a release is reported", () => {
  expect(
    cancelIsRelease([
      { file: "a.tsx", source: "onPointerUp={release} onPointerCancel={release}" },
      { file: "b.tsx", source: "onPointerUp={release} onPointerCancel={rest}" },
      { file: "c.tsx", source: "onPointerUp={release}" },
    ]),
  ).toEqual(["a.tsx cancels a pointer the way it releases one"]);
});

test("no component decides anything on a cancelled pointer", () => {
  const dragging = componentSources.filter(({ source }) => source.includes("onPointerCancel={"));

  expect(dragging.map(({ file }) => file)).toEqual(["swipe-deck.tsx"]);
  expect(cancelIsRelease(styledSources)).toEqual([]);
});

/**
 * `role="img"` hides whatever is inside it, so the label is the whole of what a reader gets. An
 * optional `label` passed straight through leaves the name empty when the consumer omits it, and
 * an empty name on a leaf role announces as nothing at all.
 *
 * Two shapes are safe: a `??` fallback, or a prop given a default where it is destructured.
 */
const unnamedImages = (sources: readonly { readonly file: string; readonly source: string }[]) =>
  sources.flatMap(({ file, source }) =>
    [...source.matchAll(/aria-label=\{(\w+)\}/g)]
      .map(([, name]) => name!)
      /* A required prop is always a name; only an optional one can arrive undefined. */
      .filter((name) => new RegExp(`\\b${name}\\?:`).test(source))
      .filter((name) => !new RegExp(`\\b${name} = `).test(source))
      .map((name) => `${file} names an image with a bare ${name}, which may be undefined`),
  );

test("an image labelled with a bare optional prop is reported", () => {
  expect(
    unnamedImages([{ file: "bars.tsx", source: "label?: string\n aria-label={label}" }]),
  ).toEqual(["bars.tsx names an image with a bare label, which may be undefined"]);
  /* A required prop is always a name, so passing it straight through is right. */
  expect(
    unnamedImages([{ file: "avatar.tsx", source: "name: string\n aria-label={name}" }]),
  ).toEqual([]);
  /* A `??` fallback writes no bare identifier, and a default makes the identifier safe. */
  expect(
    unnamedImages([{ file: "bars.tsx", source: "aria-label={label ?? barsLabel(values)}" }]),
  ).toEqual([]);
  expect(
    unnamedImages([{ file: "grid.tsx", source: 'label = "activity",\n aria-label={label}' }]),
  ).toEqual([]);
});

test("every readout that draws an image can name itself", () => {
  /* Load-bearing on a real file, not only on a planted string: `text.tsx` says the word and draws
   * nothing, so this list is the strip's own evidence. */
  expect(read("./components/text.tsx")).toContain('role="img"');

  const drawing = componentSources.filter(({ source }) => source.includes('role="img"'));

  expect(drawing.map(({ file }) => file).sort()).toEqual([
    "activity-grid.tsx",
    "bars.tsx",
    "breakdown.tsx",
    "layout-preview.tsx",
    /* Its barcode names itself from the order it encodes, so it has no bare identifier to flag. */
    "receipt.tsx",
    "sparkline.tsx",
  ]);
  expect(unnamedImages(styledSources)).toEqual([]);
});

/**
 * A `data-*` variant that Base UI does not set never matches, and nothing says so: the rule is
 * valid CSS, the component compiles, and the state simply never arrives. It has happened twice —
 * `disabled:` on a switch, which carries `data-disabled` instead, and `data-selected:` on a tab,
 * which carries `data-active`. Both looked right until the computed colour was read in the page.
 *
 * Pinning the set does not prove a new one is real. It makes adding one a decision someone has to
 * check against the rendered element rather than a guess that fails silently.
 */
/* Each was driven in the page and read back off the element, not taken from a document. */
const STATES_SEEN_IN_THE_DOM = [
  "data-active",
  "data-disabled",
  "data-ending-style",
  "data-highlighted",
  "data-hot",
  "data-hovering",
  /* Base UI puts this on both the checkbox root and its indicator; driven, `aria-checked` reads
   * `mixed` and the dash is the mark that shows. */
  "data-indeterminate",
  "data-newest",
  "data-panel-open",
  /* On an open select trigger, beside `data-pressed` and `data-popup-side`. */
  "data-popup-open",
  "data-scrolling",
  /* On the chosen select item and no other, which is what carries its tick. */
  "data-selected",
  "data-starting-style",
];

test("the state variants the kit styles with are the ones it has checked", () => {
  /* Every styled source, not the components alone: the two that Base UI sets around an open and a
   * close are written in `motion.ts` now, and read narrowly this rule stopped seeing them. */
  const used = [
    ...new Set(
      styledSources.flatMap(({ source }) =>
        [...source.matchAll(/\b(data-[a-z-]+?)(?:\[[^\]]*\])?:/g)].map(([, state]) => state!),
      ),
    ),
  ].sort();

  expect(used.length).toBeGreaterThan(8);
  expect(used).toEqual(STATES_SEEN_IN_THE_DOM);
});

test("a token the theme does not declare is reported against the file that wrote it", () => {
  const invented: Reference = {
    candidates: ["--color-pk-surface-raised"],
    written: "bg-pk-surface-raised",
    file: "badge.tsx",
  };

  expect(invented.candidates.some((token) => declared.has(token))).toBe(false);
});

/**
 * Reduced motion collapses every animation to a millisecond, which is enough for one driven by
 * time. An animation driven by a view timeline ignores duration entirely, so it keeps running at
 * full travel and has to be turned off by name. Only `.pk-rise` does this today, and it is named;
 * the next one will not be unless something asks.
 */
const runningWhenStill = (css: string) => {
  const still = css.slice(css.indexOf("@media (prefers-reduced-motion: reduce)"));
  const stopped = still.slice(0, still.indexOf("animation: none"));

  return [...css.matchAll(/\.([\w-]+)\s*\{[^}]*animation-timeline:/g)]
    .map(([, name]) => name!)
    .filter((name) => !stopped.includes(`.${name}`));
};

test("a timeline animation left running under reduced motion is reported", () => {
  const forgotten =
    ".pk-drift { animation-timeline: view(); }\n@media (prefers-reduced-motion: reduce) {\n.pk-rise { animation: none; }\n}";

  expect(runningWhenStill(forgotten)).toEqual(["pk-drift"]);
  expect(
    runningWhenStill(
      ".pk-rise { animation-timeline: view(); }\n@media (prefers-reduced-motion: reduce) {\n.pk-rise { animation: none; }\n}",
    ),
  ).toEqual([]);
});

/** Every size the scale declares, against the roles that declare it. */
const scaleSizes = new Map<string, readonly string[]>();
for (const [, token, px] of themeCss.matchAll(/^\s+(--text-pk-[a-z\d-]+):\s*([\d.]+)px;/gm)) {
  scaleSizes.set(px!, [...(scaleSizes.get(px!) ?? []), token!.replace("--text-pk-", "")]);
}

/**
 * A raw size that a role already declares. Five slots wrote a role's numbers out by hand and
 * landed a hair off it, which is the drift this catches.
 */
const rewroteARole = (
  sources: readonly { readonly file: string; readonly source: string }[],
  sizes: ReadonlyMap<string, readonly string[]>,
) =>
  sources
    .flatMap(({ file, source }) =>
      [...source.matchAll(/text-\[([\d.]+)px\]/g)].map(([written, px]) => ({
        file,
        written,
        px: px!,
      })),
    )
    .filter(({ px }) => sizes.has(px))
    .map(({ file, written }) => `${file} ${written}`)
    .sort();

/**
 * A size the scale declares, written out rather than named. Every one of these is on the ladder,
 * so none is a stray number: the slot wants the rung without the weight and tracking the role
 * bundles with it, and cancelling those costs more utilities than writing the size.
 *
 * This was documented backwards for a while — as roles the scale had no name for — and the number
 * beside each entry disproves it. The rule that matters is the one below, which reads the other
 * direction and had nothing to say about three sizes that were on no rung at all.
 */
const SIZES_WRITTEN_INSTEAD_OF_NAMED = [
  "activity-grid.tsx text-[9px]",
  "activity-grid.tsx text-[9px]",
  "avatar.tsx text-[21px]",
  "breakdown.tsx text-[10.5px]",
  "contact-card.tsx text-[15px]",
  "icon-tile.tsx text-[12.5px]",
  "metric-tile.tsx text-[13px]",
  "metric-tile.tsx text-[9.5px]",
  "pending-card.tsx text-[11.5px]",
  "pending-card.tsx text-[13px]",
  "routes/__root.tsx text-[12.5px]",
  "routes/index.tsx text-[9px]",
  "routes/layout.tsx text-[10px]",
  "routes/widgets.tsx text-[10px]",
  "stat.tsx text-[10.5px]",
];

test("a slot that writes a declared size out by hand is reported", () => {
  const sizes = new Map([["15", ["title"]]]);

  expect(rewroteARole([{ file: "deck.tsx", source: "text-[15px] leading-[1.25]" }], sizes)).toEqual(
    ["deck.tsx text-[15px]"],
  );
  expect(rewroteARole([{ file: "deck.tsx", source: "text-pk-title" }], sizes)).toEqual([]);
  expect(rewroteARole([{ file: "menu.tsx", source: "text-[12px]" }], sizes)).toEqual([]);
});

test("no slot writes a size the scale names beyond the ones on record", () => {
  expect(scaleSizes.get("15")).toEqual(["title"]);
  expect(rewroteARole(styledSources, scaleSizes)).toEqual(SIZES_WRITTEN_INSTEAD_OF_NAMED);
});

/**
 * A size on no rung at all. This is the drift that costs something: the list above stays on the
 * ladder, so moving a rung moves it, but a number the scale never declares moves with nothing and
 * reads as deliberate. Three were hiding — an accordion row at 14, a menu item and a receipt total
 * at 12 — and the rule above could not see them, because it only ever reported the safe ones.
 */
const offTheLadder = (
  sources: readonly { readonly file: string; readonly source: string }[],
  sizes: ReadonlyMap<string, readonly string[]>,
) =>
  sources
    .flatMap(({ file, source }) =>
      [...source.matchAll(/text-\[([\d.]+)px\]/g)].map(([written, px]) => ({
        file,
        written,
        px: px!,
      })),
    )
    .filter(({ px }) => !sizes.has(px))
    .map(({ file, written }) => `${file} ${written}`)
    .sort();

test("a size on no rung of the scale is reported", () => {
  const ladder = new Map([["13", ["item"]]]);

  expect(offTheLadder([{ file: "row.tsx", source: "text-[14px]" }], ladder)).toEqual([
    "row.tsx text-[14px]",
  ]);
  expect(offTheLadder([{ file: "row.tsx", source: "text-[13px]" }], ladder)).toEqual([]);
});

test("every size a slot writes is a rung the scale declares", () => {
  expect(scaleSizes.size).toBeGreaterThan(8);
  expect(offTheLadder(styledSources, scaleSizes)).toEqual([]);
});

test("every timeline animation the sheet declares is turned off under reduced motion", () => {
  expect(themeCss).toContain("animation-timeline:");
  expect(runningWhenStill(themeCss)).toEqual([]);
});

/**
 * The same block decides what survives. It replaces every transition in the kit with one list, so
 * a property named there keeps animating when motion is refused and every other one stops dead.
 *
 * Only one half of that is a promise. Which colours still fade is taste — Tailwind's own
 * `transition-colors` reaches wider than this list, so an outline, a fill and a stroke jump rather
 * than fade, which is the harmless direction. That nothing moves is the promise, and it is what
 * these two ask.
 */
const survivesStillness = (css: string) => {
  const block = css.slice(css.indexOf("@media (prefers-reduced-motion: reduce)"));
  const [, list] = /transition-property:\s*([^;!]+)/.exec(block) ?? [];

  return (list ?? "")
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);
};

/** A property that moves something on the screen, as opposed to recolouring it in place. */
const MOVES = new Set([
  "all",
  "bottom",
  "gap",
  "grid-template-columns",
  "grid-template-rows",
  "height",
  "inset",
  "left",
  "margin",
  "padding",
  "right",
  "rotate",
  "scale",
  "top",
  "transform",
  "translate",
  "width",
]);

/** Every property a slot names outright, which is the only place a new one can arrive. */
const asksToMove = (sources: readonly { readonly source: string }[]) =>
  sources.flatMap(({ source }) =>
    [...source.matchAll(/\btransition-\[([^\]]+)\]/g)].flatMap(([, list]) =>
      list!.split(",").map((name) => name.trim()),
    ),
  );

test("a block that would let something move is reported", () => {
  const leaky =
    "@media (prefers-reduced-motion: reduce) { * { transition-property: color, transform !important; } }";

  expect(survivesStillness(leaky)).toEqual(["color", "transform"]);
  expect(survivesStillness(leaky).filter((name) => MOVES.has(name))).toEqual(["transform"]);
  expect(asksToMove([{ source: `"transition-[left,top] transition-[color,translate]"` }])).toEqual([
    "left",
    "top",
    "color",
    "translate",
  ]);
});

test("nothing that moves survives when motion is refused", () => {
  const kept = survivesStillness(themeCss);

  expect(kept.filter((name) => MOVES.has(name))).toEqual([]);
  /* Five properties are kept, so a floor of three would fire on a fourth being dropped and hide
   * which one had started moving. */
  expect(kept.length).toBeGreaterThan(3);
});

test("every property a slot names is one the block has already answered for", () => {
  const kept = survivesStillness(themeCss);
  const named = asksToMove(styledSources);

  expect(named.length).toBeGreaterThan(8);
  expect(named.filter((name) => !kept.includes(name) && !MOVES.has(name))).toEqual([]);
});

/** Every corner the sheet declares, against the value it declares it at. */
const scaleRadii = new Set(
  [...themeCss.matchAll(/^\s+--pk-radius-[a-z-]+:\s*([\d.]+)px;/gm)].map(([, px]) => px!),
);

/**
 * The same drift on the corner axis. Three slots wrote `6px`, which is the inner control corner
 * exactly. What is left over sits between the declared corners rather than on one — 18 between
 * card and widget, and 11, 5, 3 and 1 below the smallest — so those are corners the sheet has no
 * name for and this rule says nothing about them.
 */
const rewroteACorner = (
  sources: readonly { readonly file: string; readonly source: string }[],
  radii: ReadonlySet<string>,
) =>
  sources
    .flatMap(({ file, source }) =>
      [...source.matchAll(/rounded-\[([\d.]+)px\]/g)].map(([written, px]) => ({
        file,
        written,
        px: px!,
      })),
    )
    .filter(({ px }) => radii.has(px))
    .map(({ file, written }) => `${file} ${written}`)
    .sort();

test("a slot that writes a declared corner out by hand is reported", () => {
  const radii = new Set(["6"]);

  expect(rewroteACorner([{ file: "avatar.tsx", source: "rounded-[6px]" }], radii)).toEqual([
    "avatar.tsx rounded-[6px]",
  ]);
  expect(
    rewroteACorner([{ file: "avatar.tsx", source: "rounded-pk-control-inner" }], radii),
  ).toEqual([]);
  expect(rewroteACorner([{ file: "surface.tsx", source: "rounded-[18px]" }], radii)).toEqual([]);
});

test("no slot rewrites a corner the sheet already names", () => {
  expect(scaleRadii.has("6")).toBe(true);
  expect(rewroteACorner(styledSources, scaleRadii)).toEqual([]);
});

/**
 * Which spacing utility a pixel count is. The scale multiplies one variable, so a step is any
 * number and every even count is one: eighteen is `4.5`, sixty-six is `16.5`. This was a hand
 * written table of ten whole and half steps, and nine slots wrote a half step out in pixels while
 * it reported clean. An odd count is a quarter step, which reads worse as a number than as a
 * measurement, so those stay written out and this says nothing about them.
 */
const PIXELS_PER_STEP = 4;

const stepFor = (px: string) =>
  Number(px) % 2 === 0 ? String(Number(px) / PIXELS_PER_STEP) : undefined;

const SPACES = "gap|gap-x|gap-y|p|px|py|pt|pb|pl|pr|m|mt|mb|ml|mr|size";

/**
 * The kit ran two spacing systems side by side and wrote four measurements both ways, `py-1.5`
 * beside `py-[6px]` among them. A pixel count that is a step is that step, so writing it out only
 * hides which of the two a slot is on. The odd counts — three, five, seven, nine, eleven, thirteen
 * and twenty-two — sit off the steps and are the kit's own rhythm, so this says nothing about them.
 */
const rewroteAStep = (sources: readonly { readonly file: string; readonly source: string }[]) =>
  sources
    .flatMap(({ file, source }) =>
      [...source.matchAll(new RegExp(String.raw`\b(?:${SPACES})-\[([\d.]+)px\]`, "g"))].map(
        ([written, px]) => ({ file, written, step: stepFor(px!) }),
      ),
    )
    .filter(({ step }) => step !== undefined)
    .map(({ file, written, step }) => `${file} ${written} is ${step}`)
    .sort();

test("a slot that writes a step out in pixels is reported", () => {
  expect(rewroteAStep([{ file: "row.tsx", source: "gap-[10px]" }])).toEqual([
    "row.tsx gap-[10px] is 2.5",
  ]);
  /* The half steps the hand written table used to miss. */
  expect(rewroteAStep([{ file: "card.tsx", source: "p-[18px] size-[66px]" }])).toEqual([
    "card.tsx p-[18px] is 4.5",
    "card.tsx size-[66px] is 16.5",
  ]);
  expect(rewroteAStep([{ file: "row.tsx", source: "gap-2.5" }])).toEqual([]);
  /* Seven is a quarter step, and reads better as a measurement, so it stays written out. */
  expect(rewroteAStep([{ file: "row.tsx", source: "gap-[7px]" }])).toEqual([]);
});

test("no slot writes a spacing step out in pixels", () => {
  expect(rewroteAStep(styledSources)).toEqual([]);
});

/**
 * A transition that names neither a time nor a curve still runs: Tailwind supplies 150ms and a
 * curve of its own, so the slot moves on numbers the sheet never chose and no rule about tokens
 * would see it. The kit names both everywhere today, and the point of asking is that the next
 * slot has to as well.
 */
const movesOnBorrowedTime = (
  sources: readonly { readonly file: string; readonly source: string }[],
) =>
  sources.flatMap(({ file, source }) =>
    [...source.matchAll(/"([^"]*\btransition-[^"]*)"/g)]
      .map(([, slot]) => slot!)
      .filter((slot) => /\btransition-(\[|colors|transform|opacity|shadow|all)/.test(slot))
      .filter((slot) => !/\bduration-/.test(slot) || !/\bease-/.test(slot))
      .map((slot) => `${file} ${/transition-\S*/.exec(slot)![0]}`),
  );

test("a transition that names neither a time nor a curve is reported", () => {
  expect(
    movesOnBorrowedTime([
      { file: "a.tsx", source: `"transition-colors duration-(--pk-duration-hover) ease-pk-swift"` },
      { file: "b.tsx", source: `"transition-colors"` },
      { file: "c.tsx", source: `"transition-[height] duration-(--pk-duration-detail)"` },
    ]),
  ).toEqual(["b.tsx transition-colors", "c.tsx transition-[height]"]);
});

test("every transition names both the time and the curve it moves on", () => {
  const transitions = styledSources.flatMap(({ source }) =>
    [...source.matchAll(/\btransition-(?:\[|colors|transform|opacity|shadow|all)/g)].map(
      ([written]) => written,
    ),
  );

  expect(transitions.length).toBeGreaterThan(25);
  expect(movesOnBorrowedTime(styledSources)).toEqual([]);
});

const HUES =
  "slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose";
const PAINTS =
  "bg|text|border|ring|fill|stroke|from|via|to|shadow|outline|decoration|accent|caret|divide";

/**
 * A colour the palette never named. The other axes are about a slot rewriting a token; this is
 * about a slot painting with something the sheet has no word for at all, which no rule that reads
 * tokens can see. Tailwind's own hues are caught too, so the default palette cannot leak in.
 */
const unnamedColour = (sources: readonly { readonly file: string; readonly source: string }[]) =>
  sources
    .flatMap(({ file, source }) =>
      [...source.matchAll(/"([^"]*)"/g)].flatMap(([, slot]) =>
        [
          ...slot!.matchAll(/rgba?\([^)]*\)/g),
          ...slot!.matchAll(/#[0-9a-fA-F]{3,8}\b/g),
          ...slot!.matchAll(new RegExp(String.raw`\b(?:${PAINTS})-(?:white|black)\b`, "g")),
          ...slot!.matchAll(new RegExp(String.raw`\b(?:${PAINTS})-(?:${HUES})-\d{2,3}\b`, "g")),
        ].map(([written]) => `${file} ${written}`),
      ),
    )
    .sort();

/**
 * Empty, and it has to stay empty. Every colour the kit paints now has a word: the aurora's four
 * gradients, the paper's lift, the grid's cell edge and the one lift every small raised face uses
 * are compound values in the sheet, beside the tile's and the swipe card's; the knob face and the
 * dialog scrim are named colours; and the sparkline's head dot is the bright ink it always was.
 *
 * The three raised faces had been three shadows at 0.4, 0.45 and 0.5 — three answers to one
 * question — and they are one now.
 */
const COLOURS_THE_PALETTE_DOES_NOT_NAME: readonly string[] = [];

test("a slot that paints an unnamed colour is reported", () => {
  expect(
    unnamedColour([
      { file: "a.tsx", source: `"bg-pk-surface text-pk-ink border-pk-line"` },
      { file: "b.tsx", source: `"bg-white"` },
      { file: "c.tsx", source: `"text-zinc-400"` },
      /* Underscored, and buried in a shadow, which is where six of the real ones hide. */
      { file: "d.tsx", source: `"shadow-[0_1px_2px_rgb(0_0_0/0.4)]"` },
    ]),
  ).toEqual(["b.tsx bg-white", "c.tsx text-zinc-400", "d.tsx rgb(0_0_0/0.4)"]);
});

test("no slot paints a colour beyond the ones already on record", () => {
  expect(unnamedColour(styledSources)).toEqual(COLOURS_THE_PALETTE_DOES_NOT_NAME);
});

/**
 * A compound value lives in the sheet and is reached by name, which is how the tile, the swipe card
 * and the aurora all draw. Nothing else checks those names: a utility like `bg-pk-surface` is read
 * against the theme, but a bare `var(--pk-…)` inside an arbitrary value is not, and a misspelt one
 * resolves to nothing at all — the element simply paints no background.
 */
const unrooted = (
  sources: readonly { readonly file: string; readonly source: string }[],
  declaredRoots: ReadonlySet<string>,
) =>
  sources
    .flatMap(({ file, source }) =>
      [...source.matchAll(/var\((--pk-[a-z\d-]+)\)/g)].map(([, token]) => ({
        token: token!,
        file,
      })),
    )
    .filter(({ token }) => !declaredRoots.has(token))
    .map(({ token, file }) => `${token} (${file})`)
    .sort();

test("a name a slot reaches for that the sheet does not declare is reported", () => {
  const sheet = new Set(["--pk-aurora-teal"]);

  expect(
    unrooted([{ file: "a.tsx", source: "[background:var(--pk-aurora-teal)]" }], sheet),
  ).toEqual([]);
  expect(
    unrooted([{ file: "a.tsx", source: "[background:var(--pk-aurora-tael)]" }], sheet),
  ).toEqual(["--pk-aurora-tael (a.tsx)"]);
});

test("every name a slot reaches for is one the sheet declares", () => {
  const reached = styledSources.flatMap(({ source }) => [
    ...source.matchAll(/var\((--pk-[a-z\d-]+)\)/g),
  ]);

  expect(reached.length).toBeGreaterThan(20);
  expect(unrooted(styledSources, roots)).toEqual([]);
});

/**
 * An auto-fill track whose minimum is wider than the box it sits in overflows rather than folding,
 * which is the one way a grid breaks a narrow screen without anything else going wrong. Wrapping
 * the minimum in `min(…, 100%)` costs nothing at any width that fits it and folds at any that does
 * not.
 *
 * Ten grids, of which two knew this and eight named a bare number that happened to be small enough.
 * Measured at 375 before and after making them all the same: every grid keeps its column count and
 * its width to the pixel, on all nine pages.
 */
const unguardedTracks = (sources: readonly { readonly file: string; readonly source: string }[]) =>
  sources
    .flatMap(({ file, source }) =>
      [...source.matchAll(/repeat\(auto-fill,minmax\(([^,]+),/g)]
        .map(([, floor]) => floor!)
        .filter((floor) => !floor.startsWith("min("))
        .map((floor) => `${file} lets a track fall back to ${floor}`),
    )
    .sort();

test("an auto-fill track that names a bare minimum is reported", () => {
  const bare = [{ file: "a.tsx", source: "grid-cols-[repeat(auto-fill,minmax(236px,1fr))]" }];
  const held = [
    { file: "b.tsx", source: "grid-cols-[repeat(auto-fill,minmax(min(236px,100%),1fr))]" },
  ];

  expect(unguardedTracks(bare)).toEqual(["a.tsx lets a track fall back to 236px"]);
  expect(unguardedTracks(held)).toEqual([]);
});

test("every auto-fill track folds rather than overflowing", () => {
  const tracks = styledSources.flatMap(({ source }) => [
    ...source.matchAll(/repeat\(auto-fill,minmax\(/g),
  ]);

  expect(tracks.length).toBeGreaterThan(8);
  expect(unguardedTracks(styledSources)).toEqual([]);
});

/**
 * A slot that hides its overflow and names a text size cuts a long word rather than wrapping it,
 * and the cut leaves no mark: the card around it reports no overflow of its own, so the missing
 * words are plain only to a reader who knows what the string said.
 *
 * Measured at 1280 with the same long address put into each of four cards: the pending card lost
 * 96px of it, while the contact card, the metric tile and the feed entry wrapped it and lost
 * nothing. A slot that says `whitespace-nowrap` is not counted, because a single line cut on
 * purpose is the icon tile's label, which opens on hover.
 */
const clipsItsOwnText = (
  sources: readonly { readonly file: string; readonly source: string }[],
  sizes: ReadonlySet<string>,
) =>
  sources
    .flatMap(({ file, source }) =>
      [...source.matchAll(/"[^"\n]*"/g)]
        .map(([value]) => value.slice(1, -1))
        .filter(
          (value) =>
            value.includes("overflow-hidden") &&
            !/\b(?:whitespace-nowrap|truncate|break-words|break-all|wrap-anywhere)\b/.test(value),
        )
        .map((value) =>
          value
            .split(" ")
            .find(
              (name) =>
                /^text-\[[\d.]+px\]$/.test(name) ||
                (name.startsWith("text-pk-") && sizes.has(name.slice("text-pk-".length))),
            ),
        )
        .filter((size) => size !== undefined)
        .map((size) => `${file} clips ${size}`),
    )
    .sort();

test("a slot that clips a text size without wrapping it is reported", () => {
  const sizes = new Set(["note"]);

  expect(
    clipsItsOwnText([{ file: "a.tsx", source: `"overflow-hidden text-pk-note"` }], sizes),
  ).toEqual(["a.tsx clips text-pk-note"]);
  expect(
    clipsItsOwnText(
      [{ file: "b.tsx", source: `"overflow-hidden break-words text-pk-note"` }],
      sizes,
    ),
  ).toEqual([]);
  expect(
    clipsItsOwnText(
      [{ file: "c.tsx", source: `"overflow-hidden whitespace-nowrap text-[12px]"` }],
      sizes,
    ),
  ).toEqual([]);
  expect(
    clipsItsOwnText([{ file: "d.tsx", source: `"overflow-hidden text-pk-ink"` }], sizes),
  ).toEqual([]);
});

test("every clipping slot wraps its text, or says it is one line", () => {
  const sizeNames = new Set([...scaleSizes.values()].flat());
  const clipping = styledSources.flatMap(({ source }) =>
    [...source.matchAll(/"[^"\n]*"/g)].filter(([value]) => value.includes("overflow-hidden")),
  );

  expect(sizeNames.size).toBeGreaterThan(8);
  expect(clipping.length).toBeGreaterThan(12);
  expect(clipsItsOwnText(styledSources, sizeNames)).toEqual([]);
});

/**
 * Every class in this kit comes from a `tv` slot at the top of its file, so one written straight
 * into the markup is out of reach of all five rules above and of the eye reading the slot list.
 * The kit held this everywhere but one span, which named `sr-only` inline.
 */
const stringInMarkup = (sources: readonly { readonly file: string; readonly source: string }[]) =>
  sources
    .flatMap(({ file, source }) =>
      [
        ...source.matchAll(/className="([^"]*)"/g),
        ...source.matchAll(/className=\{"([^"]*)"\}/g),
      ].map(([, value]) => `${file} className="${value}"`),
    )
    .sort();

test("a class written straight into the markup is reported", () => {
  expect(
    stringInMarkup([
      { file: "a.tsx", source: `<div className={styles.root()} />` },
      { file: "b.tsx", source: `<div className="flex items-center gap-2" />` },
      { file: "c.tsx", source: `<span className={"text-pk-ink"} />` },
      { file: "d.tsx", source: `<div className={styles.root({ className })} />` },
    ]),
  ).toEqual(['b.tsx className="flex items-center gap-2"', 'c.tsx className="text-pk-ink"']);
});

test("every class comes from a slot, and none from the markup", () => {
  expect(stringInMarkup(styledSources)).toEqual([]);
});

/**
 * A gradient is painted with `bg-[image:…]`, never with the `background` shorthand in brackets. The
 * kit wrote it both ways — twice one way and five times the other — for the same kind of value.
 *
 * The shorthand is the worse of the two for a reason beyond consistency: it sets the colour as well,
 * so a consumer passing `bg-pk-surface` to the slot writes a second rule for the same property that
 * `tw-merge` files elsewhere and cannot collapse, and the stylesheet decides which paints. Written
 * as an image the two are separate layers on purpose and both survive.
 *
 * The kit's other bracket properties are SVG ones with no Tailwind utility — `stroke-width`,
 * `vector-effect` and four more — and they stay.
 */
const paintsWithTheShorthand = (
  sources: readonly { readonly file: string; readonly source: string }[],
) =>
  sources
    .flatMap(({ file, source }) =>
      [...source.matchAll(/\[background:[^\]]*\]/g)].map(
        ([written]) => `${file} paints with ${written.slice(0, 24)}…`,
      ),
    )
    .sort();

test("a slot painting with the background shorthand is reported", () => {
  expect(
    paintsWithTheShorthand([{ file: "a.tsx", source: '"[background:var(--pk-aurora-teal)]"' }]),
  ).toEqual(["a.tsx paints with [background:var(--pk-aur…"]);
  expect(
    paintsWithTheShorthand([{ file: "b.tsx", source: '"bg-[image:var(--pk-aurora-teal)]"' }]),
  ).toEqual([]);
});

test("every gradient is painted as an image", () => {
  const asImages = styledSources.filter(({ source }) => source.includes("bg-[image:"));

  expect(asImages.map(({ file }) => file).sort()).toEqual([
    "aurora.tsx",
    "avatar.tsx",
    "sparkline.tsx",
  ]);
  expect(paintsWithTheShorthand(styledSources)).toEqual([]);
});

/**
 * The sheet carries exactly one rule for a slot no component draws: the lift a consumer's board
 * puts on the card under the pointer. Being inert here, nothing else in this package would notice
 * it going — and a consumer relying on it would.
 *
 * So the rule and the sentence describing it are held together. The token is checked as well: it
 * is a raw `--pk-*` rather than a `--shadow-pk-*` export, so the orphan sweep above, which reads
 * the exports, never looks at it.
 */
test("the one slot the sheet styles and does not draw is written down", () => {
  const readme = readFileSync(new URL("../README.md", import.meta.url), "utf8");
  const drawn = readdirSync(componentDir)
    .filter((name) => name.endsWith(".tsx"))
    .map((name) => readFileSync(new URL(name, componentDir), "utf8"))
    .join("\n");

  expect(themeCss).toContain('[data-slot="board-item"][data-dragging]');
  expect(themeCss).toContain("--pk-lift-held:");
  /* Read first: it really is a slot nothing here draws, which is the whole reason it needs saying. */
  expect(drawn).not.toContain("board-item");
  expect(readme).toContain('[data-slot="board-item"][data-dragging]');
});

/**
 * A margin in percent is read against the containing block's width — a top margin included, which
 * is the part that surprises. The aurora places its glow that way, so the glow follows the card's
 * width while the words follow its height and the room between them is not a constant: measured,
 * forty five pixels at a card of four hundred and thirty four, thirty at three hundred and eighty,
 * and none at about two hundred and seventy five.
 *
 * One file does it and its prop says so. Anything that joins it carries the same surprise.
 */
const PLACED_BY_PERCENT_MARGIN = ["aurora.tsx"];

test("a percent margin, which follows width even when vertical, is named where it is used", () => {
  const using = componentSources
    .filter(({ source }) => /-?m[tblrxy]?-\[[\d.]+%\]/.test(source))
    .map(({ file }) => file)
    .sort();

  /* Read first: the pattern still finds the one file that does it, at the offsets it writes. */
  const aurora = componentSources.find(({ file }) => file === "aurora.tsx")!.source;

  expect(/-mt-\[35%\]/.test(aurora)).toBe(true);
  expect(using).toEqual(PLACED_BY_PERCENT_MARGIN);
});

/**
 * Seven slots cut text that will not fit, and what they do was measured in a browser rather than
 * here: `docs/internal/layout-probes.md` holds the figures, because nothing in this suite has a
 * layout engine. Those figures are true only while the classes that produced them are still there.
 *
 * So this pins the classes, which is the one half a suite without layout can hold. Take
 * `line-clamp-3` off the card's title and the foot goes back over the bottom edge — the fault that
 * component's own comment records as having happened once — and nothing else here would notice.
 *
 * A slot that starts cutting is reported too, because the probe counted thirty four elements and a
 * new one makes that count a lie.
 */
const CUTS_ITS_TEXT: Record<string, string> = {
  "activity-grid.tsx readout": "truncate",
  "list-item.tsx label": "truncate",
  "pending-card.tsx title": "truncate",
  "receipt.tsx name": "truncate",
  "select.tsx value": "truncate",
  "swipe-deck.tsx end": "truncate",
  "swipe-deck.tsx title": "line-clamp-3",
};

/**
 * A slot and its classes, however the file breaks the line. Two of the seven put their value under
 * the name rather than beside it, so the planted case below holds both shapes: a reader that knew
 * only one would sweep five and look like it had swept all seven.
 *
 * `\s*` crosses a line break here, which `grep` does not — the five-of-seven reading that prompted
 * this rule came from a shell sweep, and the rule never had that fault.
 */
const slotsOf = (source: string) =>
  [...source.matchAll(/^\s{4}([a-zA-Z]+):\s*"([^"]*)"/gm)].map(([, slot, classes]) => ({
    slot: slot!,
    classes: classes!,
  }));

test("a slot is read whether its classes sit beside the name or under it", () => {
  const both =
    'const a = tv({\n  slots: {\n    one: "x truncate",\n    two:\n      "y truncate",\n  },\n});';

  expect(slotsOf(both).map(({ slot }) => slot)).toEqual(["one", "two"]);
});

test("every slot the probes measured still carries the class that made it true", () => {
  const cutting = componentSources
    .flatMap(({ file, source }) =>
      slotsOf(source).map(({ slot, classes }) => ({ what: `${file} ${slot}`, classes })),
    )
    .filter(({ classes }) => /\b(?:truncate|line-clamp-\d+)\b/.test(classes));

  /*
   * The two halves catch different things, which is worth knowing before trusting either. Changing
   * the card's clamp to `line-clamp-2` reports `swipe-deck.tsx title` by name, here. Removing it
   * outright drops the slot out of the set altogether, so the inventory below is what names it —
   * the same fault, found by the other half.
   *
   * A slot the table does not know is said out rather than stood in for. The stand-in was a space,
   * which every class list contains, so it answered yes — and an edit turned that space into a NUL
   * byte, which made this whole file read as binary to `grep`: empty results, silently, and two
   * rules written here as duplicates of rules already in this file.
   */
  expect(
    cutting
      .filter(({ what, classes }) => {
        const needs = CUTS_ITS_TEXT[what];

        return needs === undefined || !classes.includes(needs);
      })
      .map(({ what }) => what),
  ).toEqual([]);
  expect(cutting.map(({ what }) => what).sort()).toEqual(Object.keys(CUTS_ITS_TEXT));
});
