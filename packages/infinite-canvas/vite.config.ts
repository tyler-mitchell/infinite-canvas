import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
    // The bundler flattens away the per-file "use client" directives, which
    // silently breaks React Server Component consumers (Next.js App Router)
    // of what is a hooks/DOM/WebGPU client library. Re-assert it once, as the
    // bundle's first statement. Verified by ./scripts/verify-artifact.mjs.
    outputOptions: { banner: '"use client";' },
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
