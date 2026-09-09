import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite-plus";

export default defineConfig({
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
  ],
  lint: {
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },
  fmt: {},
});
