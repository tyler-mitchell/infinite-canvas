import typegpu from "unplugin-typegpu/vite";
import { defineConfig } from "vite-plus";

export default defineConfig({
  // No React, deliberately: a reconciler is the thing being removed, so bringing one in would
  // prove nothing about whether the compositor can stand without it.
  plugins: [typegpu()],
});
