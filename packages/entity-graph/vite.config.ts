import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vite-plus";

export default defineConfig({
  test: {
    fileParallelism: false,
    testTimeout: 10_000,
    hookTimeout: 15_000,
    projects: [
      {
        test: {
          name: "types",
          include: ["test/**/*.attest.ts"],
          globalSetup: ["./test/setup-attest.ts"],
          environment: "node",
        },
      },
      {
        test: {
          name: "browser",
          include: ["test/**/*.test.ts", "../infinite-canvas/src/engine.browser.test.ts"],
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
    coverage: {
      provider: "v8",
      include: [
        "src/**/*.ts",
        "../infinite-canvas/src/engine.ts",
        "../infinite-canvas/src/entity-model.ts",
      ],
      allowExternal: true,
      exclude: ["src/assets.d.ts", "src/index.ts"],
      reporter: ["text", "json-summary"],
    },
  },
});
