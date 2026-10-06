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
  "@typegpu/react",
  "@typegpu/noise",
  "@typegpu/sdf",
];

const packageRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const workspaceRoot = resolve(packageRoot, "../..");
const temporaryDirectory = await mkdtemp(join(tmpdir(), "infinite-canvas-consumer-"));

const CONSUMER_SOURCE = `
import { createCanvasState } from "@hyphened/infinite-canvas";

const canvas = createCanvasState({
  windowDefinitions: { note: {} },
  viewport: { width: 800, height: 600 },
});
canvas.actions.openWindow.run({
  id: "note-1",
  kind: "note",
  title: "First note",
  rect: { x: 0, y: 0, width: 320, height: 220 },
});
if (canvas.state.document.content.windows["note-1"].id.get() !== "note-1")
  throw new Error("The installed package did not open a window.");
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

  console.log("Consumer install OK — the public entry opens a window without host runtimes.");
} finally {
  await rm(temporaryDirectory, { force: true, recursive: true });
  await rm(join(workspaceRoot, "packages/infinite-canvas/.pack.tgz"), { force: true });
}
