/**
 * Distribution gate: pack the real tarball, install it into a fresh consumer, and drive it.
 *
 * Every other check here reads this repository — the source, the manifest, the built `dist`.
 * None of them installs the package, and the difference is not academic: a `process.env.NODE_ENV`
 * reference once compiled green inside this package and broke the playground's build, because
 * the failure only exists on the other side of the packaging boundary.
 *
 * `publint` and `attw` cover the manifest and how types resolve, which is what they are for and
 * why nothing here reimplements them. What no off-the-shelf tool can do is answer whether *this*
 * package, installed the way npm would install it, imports and runs. That is this script's only
 * job, and it is modelled on the same check in the featuretype repository.
 *
 * Headless on purpose. The import is the risky part — a bad `exports` map, a missing file, an
 * optional peer that is not actually optional — and driving the pure core proves the module
 * graph resolved without needing a DOM.
 *
 * Run: pnpm --filter @hyphened/infinite-canvas run verify:consumer
 */
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execa } from "execa";

const packageRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const workspaceRoot = resolve(packageRoot, "../..");
const temporaryDirectory = await mkdtemp(join(tmpdir(), "infinite-canvas-consumer-"));

/**
 * What a consumer must be able to do with the installed package.
 *
 * Deliberately the headless core rather than a render: it exercises the barrel, the reducer,
 * and the workspace layer through the published entry point, and a DOM would add a failure mode
 * that belongs to the test rather than to the package.
 */
const CONSUMER_SOURCE = `
import {
  createInfiniteCanvasHandle,
  createInfiniteCanvasState,
  createInfiniteCanvasStore,
  createInfiniteCanvasWindow,
} from "@hyphened/infinite-canvas";

const pane = (id) =>
  createInfiniteCanvasWindow({
    id,
    kind: "note",
    rect: { height: 200, width: 300, x: 0, y: 0 },
    title: id,
  });

// The store and the handle, because that is the programmatic contract a consumer actually has.
// The reducer is not exported, and the first draft of this script imported it and failed — which
// is the gate working: a check written against a non-public symbol proves nothing about what
// ships.
const store = createInfiniteCanvasStore(
  createInfiniteCanvasState({ windows: [pane("a"), pane("b")] }),
);
const handle = createInfiniteCanvasHandle(store);

handle.commands.dispatch({
  title: "Research",
  type: "workspace.create",
  windowIds: ["a"],
  workspaceId: "research",
});
handle.commands.dispatch({ type: "workspace.activate", workspaceId: "research" });
handle.commands.openWindow(pane("c"));

const state = handle.getState();

if (state.workspaces.length !== 1) {
  throw new Error(
    "workspace.create did not reach the store through the public facade. state: " +
      JSON.stringify({
        activeWorkspaceId: state.activeWorkspaceId,
        windows: state.windows.map((w) => w.id),
        workspaces: state.workspaces,
      }),
  );
}

// The bug fixed on 2026-08-12: a window opened while a desktop is active joins that desktop.
// Asserted here as well as in the unit suite, because this is the only place it runs against the
// *published* artifact rather than against the source.
const members = state.workspaces[0].windowIds;

if (!members.includes("c")) {
  throw new Error("a window opened on the active workspace did not join it: " + members.join(", "));
}

if (state.windows.length !== 3) {
  throw new Error("expected three windows, got " + state.windows.length);
}

// The snapshot is the persistence contract, and it crosses JSON — the one operation most likely
// to break on a published build that a source test would never notice.
if (typeof JSON.parse(JSON.stringify(handle.snapshot())).version !== "number") {
  throw new Error("the serialized snapshot carries no version");
}

console.log("CONSUMER_OK");
`;

try {
  // `pnpm pack` rather than `npm pack`: this package's real entry points come from
  // `publishConfig.exports`, which only pnpm applies at pack time. Packing with npm produces a
  // tarball whose exports still point at `src/`, which is how a check can report a package
  // broken when it is fine — and, worse, fine when it is broken.
  const tarball = join(temporaryDirectory, "package.tgz");

  await execa("pnpm", ["--config.ignore-scripts=true", "pack", "--out", tarball], {
    cwd: packageRoot,
  });

  await writeFile(
    join(temporaryDirectory, "package.json"),
    `${JSON.stringify({ name: "infinite-canvas-consumer", private: true, type: "module" }, null, 2)}\n`,
  );
  await writeFile(join(temporaryDirectory, "consumer.mjs"), CONSUMER_SOURCE);

  // React is a peer, so a real consumer installs it themselves. Resolved from the workspace so
  // this does not depend on the network.
  await execa(
    "npm",
    ["install", "--ignore-scripts", "--no-audit", "--no-fund", tarball, "react", "react-dom"],
    { cwd: temporaryDirectory },
  );

  const { stdout } = await execa("node", ["consumer.mjs"], { cwd: temporaryDirectory });

  if (!stdout.includes("CONSUMER_OK")) {
    throw new Error(`the installed package did not run as a consumer would use it:\n${stdout}`);
  }

  console.log(
    "Consumer install OK — the packed tarball installs into a clean project, imports through " +
      "its published entry point, and drives the reducer.",
  );
} finally {
  await rm(temporaryDirectory, { force: true, recursive: true });
  await rm(join(workspaceRoot, "packages/infinite-canvas/.pack.tgz"), { force: true });
}
