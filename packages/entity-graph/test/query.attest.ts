import { attest } from "@ark/attest";
import { type } from "arktype";
import { expectTypeOf, test } from "vite-plus/test";
import type { World } from "../src/index";

const components = type.module({
  Transform: { width: "number", height: "number", x: "number", y: "number" },
});
const relations = type.module({ Contains: { index: "number.integer >= 0" } });
declare const world: World<typeof components, typeof relations>;

test("matches native ArkType keyword completion", () => {
  // @ts-expect-error An incomplete keyword requests completion.
  attest(() => type({ width: "num" })).completions({ num: ["number"] });
  // @ts-expect-error The inline query must offer the same completion.
  attest(() => world.query({ Transform: { width: "num" } })).completions({ num: ["number"] });
});

test("completes definitions inside graph relationships", () => {
  // @ts-expect-error An incomplete nested keyword requests completion.
  attest(() => world.query({ Contains: { target: { Transform: { width: "num" } } } })).completions({
    num: ["number"],
  });
});

test("retains all component fields after an inline constraint", () => {
  const query = () => world.query({ Transform: { width: "500" } });
  expectTypeOf<Awaited<ReturnType<typeof query>>>().toEqualTypeOf<
    readonly {
      readonly id: string;
      readonly Transform: { x: number; y: number; width: 500; height: number };
    }[]
  >();
});

test("completes registered component names", () => {
  // @ts-expect-error An incomplete component name requests completion.
  attest(() => world.query({ Trans: true })).completions({ Trans: ["Transform"] });
});

test("completes component names inside relation targets", () => {
  // @ts-expect-error An incomplete nested component name requests completion.
  attest(() => world.query({ Contains: { target: { Trans: true } } })).completions({
    Trans: ["Transform"],
  });
});

test("completes component selections in direct reads", () => {
  // @ts-expect-error An incomplete selected component requests completion.
  attest(() => world.get({ id: "entity", components: ["Trans"] })).completions({
    Trans: ["Transform"],
  });
});

test("reports native ArkType definition errors", () => {
  // @ts-expect-error Invalid definitions must retain ArkType's diagnostic.
  attest(() => world.query({ Transform: { width: "numbre" } })).type.errors("unresolvable");
});

test("completes constraints on relation data", () => {
  // @ts-expect-error An incomplete edge constraint requests completion.
  attest(() => world.query({ Contains: { edge: { index: "num" }, target: {} } })).completions({
    num: ["number"],
  });
});

test("completes relation traversal directions", () => {
  // @ts-expect-error An incomplete direction requests completion.
  attest(() => world.query({ Contains: { direction: "inc", target: {} } })).completions({
    inc: ["incoming"],
  });
});
