import type { ShowcaseEntry, ShowcaseModule } from "./showcase.ts";

const modules = import.meta.glob<ShowcaseModule>("../showcases/*.showcase.tsx", { eager: true });

export const showcases: readonly ShowcaseEntry[] = Object.entries(modules)
  .map(([path, module]) => ({
    Component: module.default,
    meta: module.meta,
    slug: path.replace(/^.*\//, "").replace(/\.showcase\.tsx$/, ""),
  }))
  .sort(
    (a, b) =>
      (a.meta.order ?? 100) - (b.meta.order ?? 100) || a.meta.title.localeCompare(b.meta.title),
  );

export function findShowcase(slug: string): ShowcaseEntry | undefined {
  return showcases.find((entry) => entry.slug === slug);
}
