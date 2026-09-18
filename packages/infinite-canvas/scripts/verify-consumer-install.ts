/** Packs and runs the package from a fresh consumer project. */
import { existsSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execa } from "execa";

const OPTIONAL_HOST_PACKAGES = [
  "react",
  "react-dom",
  "typegpu",
  "@typegpu/react",
  "@typegpu/noise",
  "@typegpu/sdf",
];

const packageRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const workspaceRoot = resolve(packageRoot, "../..");
const temporaryDirectory = await mkdtemp(join(tmpdir(), "infinite-canvas-consumer-"));

/** Consumer program used to validate the installed public entry. */
const CONSUMER_SOURCE = `
import {
  createInfiniteCanvasStore,
  createInfiniteCanvasWindow,
} from "@hyphened/infinite-canvas/core";

const pane = (id) =>
  createInfiniteCanvasWindow({
    id,
    kind: "note",
    rect: { height: 200, width: 300, x: 0, y: 0 },
    title: id,
  });

const store = createInfiniteCanvasStore({
  initialState: { windows: [pane("a"), pane("b")] },
});

store.dispatch({
  title: "Research",
  type: "workspace.create",
  windowIds: ["a"],
  workspaceId: "research",
});
store.dispatch({ type: "workspace.enter", workspaceId: "research" });
store.dispatch({ type: "window.open", window: pane("c") });

const state = store.getState();

if (state.workspaces.length !== 1) {
  throw new Error(
    "workspace.create did not reach the public core store. state: " +
      JSON.stringify({
        activeWorkspaceId: state.activeWorkspaceId,
        windows: state.windows.map((w) => w.id),
        workspaces: state.workspaces,
      }),
  );
}

const members = state.workspaces[0].windowIds;

if (!members.includes("c")) {
  throw new Error("a window opened on the active workspace did not join it: " + members.join(", "));
}

if (state.windows.length !== 3) {
  throw new Error("expected three windows, got " + state.windows.length);
}

if (typeof JSON.parse(JSON.stringify(store.snapshot())).version !== "number") {
  throw new Error("the serialized snapshot carries no version");
}

console.log("CONSUMER_OK");
`;

try {
  // Use pnpm pack because it applies publishConfig exports.
  const tarball = join(temporaryDirectory, "package.tgz");

  await execa("pnpm", ["--config.ignore-scripts=true", "pack", "--out", tarball], {
    cwd: packageRoot,
  });

  await writeFile(
    join(temporaryDirectory, "package.json"),
    `${JSON.stringify({ name: "infinite-canvas-consumer", private: true, type: "module" }, null, 2)}\n`,
  );
  await writeFile(join(temporaryDirectory, "consumer.mjs"), CONSUMER_SOURCE);

  await execa(
    "npm",
    ["install", "--omit=peer", "--ignore-scripts", "--no-audit", "--no-fund", tarball],
    {
      cwd: temporaryDirectory,
    },
  );

  const installed = OPTIONAL_HOST_PACKAGES.filter((name) =>
    existsSync(join(temporaryDirectory, "node_modules", name)),
  );

  if (installed.length > 0) {
    const explanation = await execa("npm", ["explain", ...installed], {
      cwd: temporaryDirectory,
      reject: false,
    });
    throw new Error(
      `a core consumer installed optional host packages: ${installed.join(", ")}\n${explanation.stdout || explanation.stderr}`,
    );
  }

  const { stdout } = await execa("node", ["consumer.mjs"], { cwd: temporaryDirectory });

  if (!stdout.includes("CONSUMER_OK")) {
    throw new Error(`the installed package did not run as a consumer would use it:\n${stdout}`);
  }

  console.log("Consumer install OK — ./core installs without host runtimes and drives the store.");
} finally {
  await rm(temporaryDirectory, { force: true, recursive: true });
  await rm(join(workspaceRoot, "packages/infinite-canvas/.pack.tgz"), { force: true });
}
