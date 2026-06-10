import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
    dts: {
      tsgo: true,
    },
    // Keep `exports` pointing at src for instant playground HMR; vp pack
    // writes the dist mappings to publishConfig.exports for publishing.
    // The generator owns the exports field, so the theme.css subpath must
    // be declared here — hand edits to package.json get clobbered on build.
    exports: {
      customExports(exports: Record<string, unknown>, context: { isPublish: boolean }) {
        exports["./theme.css"] = context.isPublish ? "./dist/theme.css" : "./src/theme.css";
        return exports;
      },
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
