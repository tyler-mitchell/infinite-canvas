import { expect, test } from "vite-plus/test";
import { thinFilmReflectance } from "./thin-film";

test("an air film with zero thickness has no reflection", () => {
  const result = thinFilmReflectance({ cosine: 0.7, thickness: 0, ior: 1.33 });
  expect([result.x, result.y, result.z]).toEqual([0, 0, 0]);
});

test("film reflectance stays bounded across angles and thicknesses", () => {
  for (const cosine of [0, 0.01, 0.25, 0.5, 1]) {
    for (const thickness of [0, 180, 400, 900]) {
      const result = thinFilmReflectance({ cosine, thickness, ior: 1.33 });
      for (const channel of [result.x, result.y, result.z]) {
        expect(channel).toBeGreaterThanOrEqual(0);
        expect(channel).toBeLessThanOrEqual(1);
      }
    }
  }
});

test("a nonzero film reflects at grazing incidence", () => {
  const result = thinFilmReflectance({ cosine: 0, thickness: 400, ior: 1.33 });
  expect(result.x).toBeCloseTo(1);
  expect(result.y).toBeCloseTo(1);
  expect(result.z).toBeCloseTo(1);
});
