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

test("a token the theme does not declare is reported against the file that wrote it", () => {
  const invented: Reference = {
    candidates: ["--color-pk-surface-raised"],
    written: "bg-pk-surface-raised",
    file: "badge.tsx",
  };

  expect(invented.candidates.some((token) => declared.has(token))).toBe(false);
});
