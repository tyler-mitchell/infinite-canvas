import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
    // Two entries, deliberately. `./scene` is the only one that reaches `three`
    // and `@react-three/fiber`, which is what makes those peers genuinely
    // optional: a consumer who never imports it can leave them uninstalled and
    // their bundler never tries to resolve them.
    entry: {
      index: "src/index.ts",
      scene: "src/scene.ts",
    },
    // The bundler flattens away the per-file "use client" directives, which
    // silently breaks React Server Component consumers (Next.js App Router)
    // of what is a hooks/DOM/WebGPU client library. Re-assert it once, as the
    // bundle's first statement.
    //
    // Declaration files go through the same output pipeline, and a directive
    // prologue is a *statement* — illegal in an ambient context. Emitting it
    // there makes `tsc` fail with TS1036 for every consumer who has not set
    // `skipLibCheck`. Banner the JS chunks only. Both halves of this are
    // asserted by ./scripts/verify-artifact.mjs.
    outputOptions: {
      banner: (chunk: { fileName: string }) =>
        /\.d\.[cm]?ts$/.test(chunk.fileName) ? "" : '"use client";',
    },
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
