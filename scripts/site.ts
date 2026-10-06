import { cpSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { program } from "cmd-mesh";

const root = fileURLToPath(new URL("../", import.meta.url));
const application = join(root, "packages/portfolio-board");
const checkout = join(root, ".runtime/portfolio-board-deploy");
const hosting = JSON.parse(readFileSync(join(application, ".openai/hosting.json"), "utf8"));
const excluded = [
  ".git",
  "node_modules",
  "dist",
  ".runtime",
  ".wrangler",
  ".tanstack",
  ".attest",
  ".DS_Store",
  ".env*",
  ".dev.vars*",
  "*.log",
];

await program({
  name: "site",
  version: "1.0.0",
  commands: {
    build: {
      description: "Build the Worker and stage Sites assets and migrations.",
      run: async (_input, ctx) => {
        await ctx.exec("vp", ["run", "build"], {
          cwd: application,
          stdio: "inherit",
          successCodes: [0],
        });
        mkdirSync(join(root, "dist"), { recursive: true });
        await ctx.exec("rsync", ["-a", "--delete", `${application}/dist/`, `${root}/dist/`], {
          successCodes: [0],
        });
        mkdirSync(join(root, "dist/.openai"), { recursive: true });
        cpSync(join(application, ".openai/hosting.json"), join(root, "dist/.openai/hosting.json"));
        cpSync(join(application, "drizzle"), join(root, "dist/.openai/drizzle"), {
          recursive: true,
        });
      },
    },
    prepare: {
      description: "Build and synchronize the separate Site source repository.",
      run: async (_input, ctx) => {
        await ctx.exec("pnpm", ["run", "site:build"], {
          cwd: root,
          stdio: "inherit",
          successCodes: [0],
        });
        mkdirSync(checkout, { recursive: true });
        for (const path of [
          "packages/portfolio-board",
          "packages/infinite-canvas",
          "packages/math",
          "packages/surrealdb-wasm",
          "patches",
        ]) {
          mkdirSync(join(checkout, path), { recursive: true });
          await ctx.exec(
            "rsync",
            [
              "-a",
              "--delete",
              ...excluded.map((name) => `--exclude=${name}`),
              `${join(root, path)}/`,
              `${join(checkout, path)}/`,
            ],
            { successCodes: [0] },
          );
        }
        for (const path of ["scripts", ".openai", "dist", "drizzle"]) {
          mkdirSync(join(checkout, path), { recursive: true });
        }
        for (const path of [
          "pnpm-workspace.yaml",
          "pnpm-lock.yaml",
          "scripts/site.ts",
          "docs/internal/handoffs/2026-09-22/portfolio-board.md",
        ]) {
          mkdirSync(dirname(join(checkout, path)), { recursive: true });
          cpSync(join(root, path), join(checkout, path));
        }
        cpSync(join(application, ".openai/hosting.json"), join(checkout, ".openai/hosting.json"));
        cpSync(join(application, "drizzle"), join(checkout, "drizzle"), { recursive: true });
        await ctx.exec("rsync", ["-a", "--delete", `${root}/dist/`, `${checkout}/dist/`], {
          successCodes: [0],
        });
        const manifest = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
        writeFileSync(
          join(checkout, "package.json"),
          JSON.stringify(
            {
              ...manifest,
              scripts: { build: "node scripts/site.ts build" },
            },
            null,
            2,
          ) + "\n",
        );
        writeFileSync(
          join(checkout, ".gitignore"),
          excluded
            .filter((value) => value !== ".git")
            .concat(".sites-runtime")
            .join("\n") + "\n",
        );
        return { checkout, projectId: hosting.project_id };
      },
    },
    source: {
      description: "Run the installed Sites source workflow; provide its JSON input on stdin.",
      input: {
        pluginRoot: {
          type: "string",
          required: true,
          cli: { usage: "--plugin-root", env: "SITES_PLUGIN_ROOT" },
        },
      },
      run: async ({ pluginRoot }, ctx) => {
        await ctx.exec(
          "node",
          [join(pluginRoot, "scripts/site-workflow.mjs"), "--project-id", hosting.project_id],
          { cwd: checkout, stdio: "inherit", successCodes: [0] },
        );
      },
    },
    commit: {
      description: "Commit the prepared Site copy without changing the working repository.",
      input: { message: { type: "string", required: true, cli: "--message" } },
      run: async ({ message }, ctx) => {
        await ctx.exec("git", ["add", "--all", "--", "."], {
          cwd: checkout,
          successCodes: [0],
        });
        await ctx.exec("git", ["commit", "-m", message], {
          cwd: checkout,
          stdio: "inherit",
          successCodes: [0],
        });
      },
    },
  },
}).main();
