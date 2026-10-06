import { setup } from "@ark/attest";

export default () =>
  setup({
    tsconfig: "./tsconfig.json",
    skipTypes: false,
    failOnMissingSnapshots: true,
    shouldFormat: false,
  });
