/** The root shell uses this route metadata to build the sidebar. */
export type ShowcaseMeta = Readonly<{
  title: string;
  description: string;
  /** Lower values appear first. The default is 100. */
  order?: number;
}>;

declare module "@tanstack/react-router" {
  interface StaticDataRouteOption {
    showcase?: ShowcaseMeta;
  }
}
