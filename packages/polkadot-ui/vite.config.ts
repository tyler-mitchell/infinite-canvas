import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import typegpu from "unplugin-typegpu/vite";
import { defineConfig } from "vite-plus";

export default defineConfig({
  // The portfolio's database engine is WebAssembly and must not be pre-bundled.
  optimizeDeps: { exclude: ["@surrealdb/wasm"] },
  plugins: [
    /*
     * The lab app lives in `app/`; `src/` stays the published library surface.
     *
     * This is Router rather than Start because Start's SSR middleware does not mount on Vite+ —
     * see docs/research/widget-runtime.md. The route files are Router APIs either way, so
     * adopting Start later moves the entry and the document and nothing else.
     */
    tanstackRouter({
      target: "react",
      autoCodeSplitting: true,
      routesDirectory: "app/routes",
      generatedRouteTree: "app/routeTree.gen.ts",
    }),
    react(),
    tailwindcss(),
    // Turns the "use gpu" functions under src/shaders into WGSL.
    typegpu(),
  ],
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
          include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
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
});
