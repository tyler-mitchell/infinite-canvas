import type { ComponentType } from "react";

/**
 * Contract for playground showcases. Each demo lives in
 * `src/showcases/<slug>.showcase.tsx` and exports `meta` plus a default
 * component; the shell discovers it automatically — nothing to register.
 */
export type ShowcaseMeta = Readonly<{
  title: string;
  description: string;
  /** Lower sorts first in the sidebar; defaults to 100. */
  order?: number;
}>;

export type ShowcaseModule = Readonly<{
  meta: ShowcaseMeta;
  default: ComponentType;
}>;

export type ShowcaseEntry = Readonly<{
  slug: string;
  meta: ShowcaseMeta;
  Component: ComponentType;
}>;
