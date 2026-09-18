import { defineConfig } from "vite-plus";

export default defineConfig({
  staged: {
    "*": "vp check --fix",
  },
  fmt: {
    ignorePatterns: [
      "reference/**",
      "packages/*/research/sources/**",
      "**/routeTree.gen.ts",
      "**/CHANGELOG.md",
    ],
  },
  lint: {
    ignorePatterns: ["reference/**", "packages/*/research/sources/**", "**/routeTree.gen.ts"],
    options: { typeAware: true, typeCheck: true },
    overrides: [
      {
        files: ["apps/playground/**", "apps/polkadot/**"],
        plugins: ["typescript", "react"],
      },
    ],
  },
  run: {
    cache: true,
  },
});
