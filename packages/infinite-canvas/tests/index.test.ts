import { expect, test } from "vite-plus/test";
import { frameworkStatus } from "../src/index.ts";

test("framework entry point exports its status seed", () => {
  expect(frameworkStatus.name).toBe("infinite-canvas");
});
