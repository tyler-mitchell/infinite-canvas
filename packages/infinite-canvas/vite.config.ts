import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
    dts: {
      tsgo: true,
    },
    // Keep `exports` pointing at src for instant playground HMR; vp pack
    // writes the dist mappings to publishConfig.exports for publishing.
    exports: {
      devExports: true,
    },
  },
  lint: {
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },
  fmt: {},
});
