import { playwright } from "@vitest/browser-playwright";
import typegpu from "unplugin-typegpu/vite";
import typegpuRolldown from "unplugin-typegpu/rolldown";
import { defineConfig, type UserConfig } from "vite-plus";

const pack = {
  entry: {
    index: "src/index.ts",
    react: "src/react/index.ts",
    legacy: "legacy/index.ts",
    "legacy/core": "legacy/core.ts",
    "legacy/scene": "legacy/scene.ts",
  },
  plugins: [
    [
      {
        name: "react-externals",
        resolveId: {
          order: "pre",
          handler(id: string) {
            if (/^react(?:\/|$)/.test(id)) return { id, external: true, moduleSideEffects: false };
          },
        },
      },
    ],
    typegpuRolldown({ exclude: /\.d\.[cm]?ts$/ }),
  ],
  attw: {
    excludeEntrypoints: ["theme.css", "legacy/theme.css", "style.css"],
    level: "error",
    profile: "esm-only",
  },
  // React entries keep the client directive. Declarations and core omit it.
  outputOptions: {
    banner: (chunk: { fileName: string }) =>
      /(?:^|\/)(?:react|legacy|scene)\.[cm]?js$/.test(chunk.fileName) ? '"use client";' : "",
  },
  dts: {
    tsgo: true,
    tsconfig: "../tsconfig.json",
  },
  deps: {
    alwaysBundle: ["@hyphened/math", "use-webmcp-tool"],
  },
  // Keep `exports` pointing at src for instant playground HMR; vp pack
  // writes the dist mappings to publishConfig.exports for publishing.
  // The generator owns the exports field, so the theme.css subpath must
  // be declared here — hand edits to package.json get clobbered on build.
  exports: {
    customExports(exports: Record<string, unknown>, context: { isPublish: boolean }) {
      exports["./theme.css"] = context.isPublish ? "./dist/theme.css" : "./src/theme.css";
      exports["./legacy/theme.css"] = context.isPublish
        ? "./dist/legacy/theme.css"
        : "./legacy/theme.css";
      return exports;
    },
    devExports: true,
  },
  copy: [
    { from: "src/theme.css", to: "dist" },
    { from: "legacy/theme.css", to: "dist/legacy" },
    { from: "node_modules/use-webmcp-tool/LICENSE", to: "dist/licenses/use-webmcp-tool" },
  ],
  publint: true,
} as NonNullable<UserConfig["pack"]>;

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "types",
          include: ["src/**/*.attest.ts"],
          globalSetup: ["./src/setup-attest.ts"],
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
          include: ["src/**/*.browser.test.{ts,tsx}"],
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
  pack,
  lint: {
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },
  fmt: {},
});
