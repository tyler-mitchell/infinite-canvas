import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import typegpu from "unplugin-typegpu/vite";
import { defineConfig } from "vite-plus";

export default defineConfig({
  // The engine is WebAssembly and must not be pre-bundled.
  optimizeDeps: { exclude: ["@surrealdb/wasm"] },
  plugins: [
    tanstackRouter({ autoCodeSplitting: true, target: "react" }),
    react(),
    tailwindcss(),
    // Not optional: this is what turns a "use gpu" function into WGSL. Without it the field's
    // shader is ordinary JavaScript that never reaches the GPU.
    typegpu(),
  ],
});
