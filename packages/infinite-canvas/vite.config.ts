import { playwright } from "@vitest/browser-playwright";
import typegpu from "unplugin-typegpu/vite";
import typegpuRolldown from "unplugin-typegpu/rolldown";
import { defineConfig, type UserConfig } from "vite-plus";

const pack: NonNullable<UserConfig["pack"]> = {
  plugins: [
    {
      name: "react-externals",
      resolveId: {
        order: "pre",
        handler(id) {
          if (/^react(?:\/|$)/.test(id)) return { id, external: true, moduleSideEffects: false };
        },
      },
    },
  ],
  attw: {
    excludeEntrypoints: ["theme.css"],
    level: "error",
    profile: "esm-only",
  },
  // React entries keep the client directive. Declarations and core omit it.
  outputOptions: {
    banner: (chunk: { fileName: string }) =>
      /(?:^|\/)(?:index|scene)\.[cm]?js$/.test(chunk.fileName) ? '"use client";' : "",
  },
  dts: {
    tsgo: true,
  },
  deps: {
    alwaysBundle: ["use-webmcp-tool"],
  },
  // Keep `exports` pointing at src for instant playground HMR; vp pack
  // writes the dist mappings to publishConfig.exports for publishing.
  // The generator owns the exports field, so the theme.css subpath must
  // be declared here — hand edits to package.json get clobbered on build.
  exports: {
    customExports(exports: Record<string, unknown>, context: { isPublish: boolean }) {
      exports["./theme.css"] = context.isPublish ? "./dist/theme.css" : "./src/theme.css";
      if (!context.isPublish)
        Object.assign(exports, {
          "./next": "./next/index.ts",
          "./next/react": "./next/react/index.ts",
          "./next/theme.css": "./next/theme.css",
        });
      return exports;
    },
    devExports: true,
  },
  publint: true,
};

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "types",
          include: ["next/**/*.attest.ts"],
          globalSetup: ["./next/setup-attest.ts"],
        },
      },
      {
        test: {
          name: "unit",
          include: ["**/*.{test,spec}.{ts,tsx}"],
          exclude: ["**/*.browser.test.{ts,tsx}", "**/node_modules/**"],
        },
      },
      {
        test: {
          name: "browser",
          include: ["next/**/*.browser.test.{ts,tsx}"],
          browser: {
            enabled: true,
            headless: true,
            screenshotFailures: false,
            provider: playwright(),
            instances: [{ browser: "chromium" }],
          },
        },
      },
    ],
  },
  plugins: [typegpu()],
  // Build the headless core separately from React entry points.
  pack: [
    { ...pack, entry: { core: "src/core.ts" } },
    {
      ...pack,
      entry: { index: "src/index.ts", scene: "src/scene.ts" },
      plugins: [pack.plugins, typegpuRolldown({ exclude: /\.d\.[cm]?ts$/ })],
      copy: [
        { from: "src/theme.css", to: "dist" },
        { from: "node_modules/use-webmcp-tool/LICENSE", to: "dist/licenses/use-webmcp-tool" },
      ],
    },
  ],
  lint: {
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },
  fmt: {},
});
