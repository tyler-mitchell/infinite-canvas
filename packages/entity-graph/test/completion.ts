import { type } from "arktype";
import type { World } from "../src/index";

const components = type.module({
  Transform: { width: "number", height: "number", x: "number", y: "number" },
});
declare const world: World<typeof components, {}>;

// @ts-expect-error Incomplete definitions expose native ArkType completion candidates.
type({ width: "num" });
// @ts-expect-error The query must expose the same completion candidates.
world.query({ Transform: { width: "num" } });

world.query({ Transform: { width: "number > 400" } });
