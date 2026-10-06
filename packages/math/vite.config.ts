import typegpu from "unplugin-typegpu/vite";
import { defineConfig } from "vite-plus";

export default defineConfig({
  plugins: [typegpu()],
  pack: {
    entry: { cpu: "src/cpu.ts", gpu: "src/gpu.ts" },
    dts: true,
    exports: { devExports: true },
  },
  test: { include: ["src/**/*.test.ts"] },
});
