import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite-plus";

export default defineConfig({
  // The engine is WebAssembly and must not be pre-bundled.
  optimizeDeps: { exclude: ["@surrealdb/wasm"] },
  plugins: [tanstackRouter({ autoCodeSplitting: true, target: "react" }), react(), tailwindcss()],
});
