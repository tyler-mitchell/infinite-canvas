import tailwindcss from "@tailwindcss/vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import typegpu from "unplugin-typegpu/vite";
import { defineConfig, type UserConfig } from "vite-plus";

export default defineConfig(({ mode }) => ({
  resolve: { alias: { "@": new URL("./app", import.meta.url).pathname } },
  optimizeDeps: { exclude: ["@surrealdb/wasm"] },
  plugins: [
    ...(mode === "test"
      ? []
      : [
          cloudflare({ viteEnvironment: { name: "ssr" }, inspectorPort: false }),
          ...tanstackStart({ srcDirectory: "app" }),
        ]),
    react(),
    tailwindcss(),
    // Turns the "use gpu" functions under src/shaders into WGSL.
    typegpu(),
  ] as NonNullable<UserConfig["plugins"]>,
  lint: {
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },
  fmt: {},
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "rules",
          include: ["src/**/*.test.ts", "src/**/*.test.tsx", "app/**/*.test.ts"],
          exclude: ["src/**/*.dom.test.tsx"],
        },
      },
      {
        extends: true,
        test: {
          name: "dom",
          include: ["src/**/*.dom.test.tsx"],
          environment: "happy-dom",
        },
      },
    ],
  },
}));
