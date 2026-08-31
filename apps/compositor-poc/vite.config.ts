import react from "@vitejs/plugin-react";
import typegpu from "unplugin-typegpu/vite";
import { defineConfig } from "vite-plus";

export default defineConfig({
  // React renders the source DOM. TypeGPU owns the compositor.
  plugins: [react(), typegpu()],
});
