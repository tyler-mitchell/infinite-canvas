import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import typegpu from "unplugin-typegpu/vite";
import { defineConfig } from "vite-plus";

export default defineConfig({
  plugins: [
    tanstackRouter({ autoCodeSplitting: true, target: "react" }),
    react(),
    tailwindcss(),
    // The framework's src is imported directly, so its shader functions compile here.
    typegpu(),
  ],
});
