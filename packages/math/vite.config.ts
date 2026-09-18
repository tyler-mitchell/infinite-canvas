import typegpu from "unplugin-typegpu/vite";
import { defineConfig } from "vite-plus";

export default defineConfig({
  plugins: [typegpu()],
  pack: {
    entry: { index: "src/index.ts" },
    dts: true,
    exports: { devExports: true },
  },
  test: { include: ["src/**/*.test.ts"] },
});
