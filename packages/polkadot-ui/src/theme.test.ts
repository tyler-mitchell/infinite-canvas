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

const references: readonly Reference[] = componentFiles.flatMap((file) => {
  const source = readFileSync(new URL(file, componentDir), "utf8");

  return [...source.matchAll(/\b([a-z-]+)-pk-([a-z\d-]+)/g)].flatMap(([, prefix, rest]) => {
    const namespaces = NAMESPACE[prefix!];
    if (!namespaces) return [];

    const name = rest!.replace(/\/.*$/, "");

    return [
      {
        candidates: namespaces.map((namespace) => `--${namespace}-pk-${name}`),
        written: `${prefix}-pk-${name}`,
        file,
      },
    ];
  });
});

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
  expect(references.length).toBeGreaterThan(100);
  expect(appFiles.length).toBeGreaterThan(10);
  expect(utilities.size).toBeGreaterThan(50);
});

test("every token a component draws with is one the theme declares", () => {
  const missing = references
    .filter((reference) => !reference.candidates.some((token) => declared.has(token)))
    .map((reference) => `${reference.written} in ${reference.file}`);

  expect([...new Set(missing)]).toEqual([]);
});

/**
 * The namespaces that exist only to be written, and the prefix each is written with. Colour is
 * left out on purpose — the palette is a public surface, so a colour only a `.pk-*` rule in the
 * sheet draws is still one a consumer may reach for. Sizes are left out because a `--text-pk-*`
 * carries `--line-height` and `--font-weight` modifiers that nothing writes on their own.
 */
const WRITTEN_AS: Record<string, string> = {
  animate: "animate",
  ease: "ease",
  radius: "rounded",
  shadow: "shadow",
};

const componentSources = componentFiles.map((file) => ({
  file,
  source: readFileSync(new URL(file, componentDir), "utf8"),
}));

const appSources = appFiles.map((file) => ({
  file,
  source: readFileSync(new URL(file, appDir), "utf8"),
}));

/**
 * The pages hold `tv` slots of their own, so a rule that reads only `src` checks half the surface
 * while looking like it checked all of it. Eleven slots on the pages broke these rules while the
 * component-only versions reported clean.
 */
const styledSources = [...componentSources, ...appSources];

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

  expect(radii.length).toBeGreaterThan(3);
  expect(easings.length).toBeGreaterThan(1);
  expect(misprinted(radii, declaredAs, "px")).toEqual([]);
  expect(misprinted(easings, declaredAs)).toEqual([]);
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

  /* `Prose` sits on its own line inside its tag, so the role need not follow the `>` directly. */
  const claimed = [...page.matchAll(/>\s*(Display|Title|Label|Kind|Prose|Meta) · (\d+)px/g)].map(
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
  expect(claimed.length).toBe(6);
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
 * A sparkline's `label` is its accessible name, so a count stated there is what a reader who
 * cannot see the trace is told. Nothing tied those counts to the series they describe.
 */
test("a series that states its length says the length it has", () => {
  /* Every page, not just the one that draws the most: the overview states a count as well. */
  const pages = appFiles.map((file) => readFileSync(new URL(file, appDir), "utf8")).join("\n");
  const fixtures = readFileSync(new URL("fixtures.ts", appDir), "utf8");

  const counted = [...pages.matchAll(/<Sparkline\b([\s\S]*?)\/>/g)]
    .map(([, attributes]) => ({
      series: /values=\{(\w+)\}/.exec(attributes!)?.[1],
      label: /label="([^"]*)"/.exec(attributes!)?.[1],
    }))
    /* `over 96 hours`, not the 95 in `p95`: the count is the one the phrase counts with. */
    .filter(
      (row): row is { series: string; label: string } =>
        Boolean(row.series) && /\bover \d+\b/.test(row.label ?? ""),
    );

  const wrong = counted
    .map(({ series, label }) => ({
      series,
      stated: Number(/\bover (\d+)\b/.exec(label)![1]),
      real: fixtureLength(fixtures, series),
    }))
    .filter(({ stated, real }) => stated !== real)
    .map(({ series, stated, real }) => `${series} says ${stated}, the fixture holds ${real}`);

  expect(fixtureLength(fixtures, "INSTALLS")).toBe(8);
  expect(counted.length).toBeGreaterThan(3);
  expect(wrong).toEqual([]);
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
  "data-newest",
  "data-panel-open",
  "data-scrolling",
  "data-starting-style",
];

test("the state variants the kit styles with are the ones it has checked", () => {
  const used = [
    ...new Set(
      componentSources.flatMap(({ source }) =>
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
 * The rest are roles the scale has no name for, so writing the size out is the only thing a slot
 * can do. Mono stops at 12.5 while three slots want it at 11.5 and 13; sans has nothing at 10.5,
 * nothing flat-lined at 12.5 or 9.5, and no name for a glyph sized to the box that holds it. The
 * fix is to name those roles in the sheet, not to bend these onto a role that means something
 * else — until then this says how wide the hole is, and stops a new one opening quietly.
 */
const SIZES_THE_SCALE_DOES_NOT_NAME = [
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

test("no slot rewrites a role the scale already names", () => {
  expect(scaleSizes.get("15")).toEqual(["title"]);
  expect(rewroteARole(styledSources, scaleSizes)).toEqual(SIZES_THE_SCALE_DOES_NOT_NAME);
});

test("every timeline animation the sheet declares is turned off under reduced motion", () => {
  expect(themeCss).toContain("animation-timeline:");
  expect(runningWhenStill(themeCss)).toEqual([]);
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

/** Which spacing utility a pixel count is, on the four-pixel step Tailwind is set to here. */
const STEP_FOR_PX: Record<string, string> = {
  "4": "1",
  "6": "1.5",
  "8": "2",
  "10": "2.5",
  "12": "3",
  "14": "3.5",
  "16": "4",
  "20": "5",
  "24": "6",
  "32": "8",
};

const SPACES = "gap|gap-x|gap-y|p|px|py|pt|pb|pl|pr|m|mt|mb|ml|mr|size";

/**
 * The kit ran two spacing systems side by side and wrote four measurements both ways, `py-1.5`
 * beside `py-[6px]` among them. A pixel count that is a step is that step, so writing it out only
 * hides which of the two a slot is on. The odd counts — three, five, seven, nine, eleven, thirteen
 * and twenty-two — sit off the steps and are the kit's own rhythm, so this says nothing about them.
 */
const rewroteAStep = (
  sources: readonly { readonly file: string; readonly source: string }[],
  steps: Record<string, string>,
) =>
  sources
    .flatMap(({ file, source }) =>
      [...source.matchAll(new RegExp(String.raw`\b(?:${SPACES})-\[([\d.]+)px\]`, "g"))].map(
        ([written, px]) => ({ file, written, px: px! }),
      ),
    )
    .filter(({ px }) => px in steps)
    .map(({ file, written, px }) => `${file} ${written} is ${steps[px]}`)
    .sort();

test("a slot that writes a step out in pixels is reported", () => {
  expect(rewroteAStep([{ file: "row.tsx", source: "gap-[10px]" }], STEP_FOR_PX)).toEqual([
    "row.tsx gap-[10px] is 2.5",
  ]);
  expect(rewroteAStep([{ file: "row.tsx", source: "gap-2.5" }], STEP_FOR_PX)).toEqual([]);
  /* Seven is not a step, so writing it out is the only thing the slot can do. */
  expect(rewroteAStep([{ file: "row.tsx", source: "gap-[7px]" }], STEP_FOR_PX)).toEqual([]);
});

test("no slot writes a spacing step out in pixels", () => {
  expect(rewroteAStep(styledSources, STEP_FOR_PX)).toEqual([]);
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
