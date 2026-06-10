import { defineConfig } from "vite-plus";

export default defineConfig({
  staged: {
    "*": "vp check --fix",
  },
  fmt: {
    ignorePatterns: ["reference/**"],
  },
  lint: {
    ignorePatterns: ["reference/**"],
    options: { typeAware: true, typeCheck: true },
    overrides: [
      {
        files: ["apps/playground/**"],
        plugins: ["typescript", "react"],
      },
    ],
  },
  run: {
    cache: true,
  },
});
