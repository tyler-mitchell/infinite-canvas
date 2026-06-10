/**
 * Showcase metadata attached to routes via TanStack Router's staticData.
 * The root shell builds its sidebar from these entries, so adding a
 * showcase is just adding a route file that declares `staticData.showcase`.
 */
export type ShowcaseMeta = Readonly<{
  title: string;
  description: string;
  /** Lower sorts first in the sidebar; defaults to 100. */
  order?: number;
}>;

declare module "@tanstack/react-router" {
  interface StaticDataRouteOption {
    showcase?: ShowcaseMeta;
  }
}
