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
  expect(guessedSeat(componentSources)).toEqual([]);
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

test("every radius and easing the foundations page prints is the one the sheet declares", () => {
  const page = readFileSync(new URL("routes/foundations.tsx", appDir), "utf8");

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

test("the contrast maths agrees with the values WCAG defines", () => {
  /* Black on white is the definition's own upper bound. */
  expect(Number(contrast("#000", "#fff").toFixed(2))).toBe(21);
  expect(contrast("#fff", "#fff")).toBe(1);
});

/**
 * The foundations page states a ratio beside every ink and hairline. They are correct today, and
 * nothing tied them to the colours, so editing a colour would leave the page asserting the old
 * number — a claim about accessibility that reads as measured.
 */
test("every ratio the foundations page states is the one its colours produce", () => {
  const page = readFileSync(new URL("routes/foundations.tsx", appDir), "utf8");
  const surface = declaredAs.get("--pk-surface")!;

  const stated = [
    ...page.matchAll(/\["(--pk-(?:ink|line)[a-z-]*)",\s*"[^"]*",\s*"(\d+\.\d+)/g),
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
  const page = readFileSync(new URL("routes/foundations.tsx", appDir), "utf8");
  const [, top, foot] =
    /--pk-paper:\s*linear-gradient\([^,]+,\s*(#[\da-f]+),\s*(#[\da-f]+)\)/.exec(themeCss) ?? [];

  const stated = [
    ...page.matchAll(/\["(--pk-paper-[a-z-]+)",\s*"[^"]*",\s*"([\d.]+) → ([\d.]+)"\]/g),
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
 * The type section names a size beside each role. The role's size is not restated here: it is read
 * from `text.tsx`, so moving a role onto a different token moves the expectation with it.
 */
test("every size the type section names is the one its role actually uses", () => {
  const page = readFileSync(new URL("routes/foundations.tsx", appDir), "utf8");
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
  const page = readFileSync(new URL("routes/data.tsx", appDir), "utf8");
  const fixtures = readFileSync(new URL("fixtures.ts", appDir), "utf8");

  const counted = [...page.matchAll(/<Sparkline\b([\s\S]*?)\/>/g)]
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
  expect(counted.length).toBe(3);
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

test("a stated ratio that no longer matches its colours is reported", () => {
  const real = contrast("#ededed", "#0e0f11").toFixed(2);

  expect(real).toBe("16.38");
  expect(real === "15.00").toBe(false);
});

test("a token the theme does not declare is reported against the file that wrote it", () => {
  const invented: Reference = {
    candidates: ["--color-pk-surface-raised"],
    written: "bg-pk-surface-raised",
    file: "badge.tsx",
  };

  expect(invented.candidates.some((token) => declared.has(token))).toBe(false);
});
