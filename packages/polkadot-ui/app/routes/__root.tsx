import { createRootRoute, Link, Outlet } from "@tanstack/react-router";
import { tv } from "tailwind-variants";

import { ScrollArea } from "#/components/scroll-area.tsx";
import { Kind, Meta, Title } from "#/components/text.tsx";

/*
 * The rail is a `<nav>` of router links, not a Base UI NavigationMenu: that primitive is a
 * trigger-and-popup menubar, and a persistent index of pages has no disclosure to own. The router
 * owns which link is current — `activeProps` writes the attribute the `data-active:` variants read,
 * so nothing here compares pathnames.
 */
const shell = tv({
  slots: {
    page: "flex min-h-dvh bg-pk-ground font-pk-sans text-pk-ink",
    rail: "sticky top-0 flex h-dvh w-[210px] flex-none flex-col gap-5 border-r border-pk-line bg-pk-surface-deep px-5 py-7",
    brand: "flex flex-none flex-col gap-1",
    nav: "-mx-2 min-h-0 flex-1",
    group: "mb-5 flex flex-col gap-px px-2",
    groupLabel: "mb-2 px-2",
    link: "rounded-pk-chip px-2 py-[7px] font-pk-sans text-[12.5px] leading-none text-pk-ink-dim no-underline outline-none transition-colors duration-(--pk-duration-hover) ease-pk-swift hover:bg-pk-surface hover:text-pk-ink-muted focus-visible:ring-2 focus-visible:ring-pk-accent/50 data-active:bg-pk-surface-inner data-active:text-pk-ink-bright data-active:shadow-[inset_2px_0_0_var(--pk-accent)]",
    main: "min-w-0 flex-1 px-9 py-8",
  },
});

/* One list, so the rail and the route set cannot drift apart without a type error. */
const SECTIONS = [
  {
    label: "start",
    links: [
      { to: "/", label: "overview" },
      { to: "/foundations", label: "foundations" },
    ],
  },
  {
    label: "primitives",
    links: [
      { to: "/layout", label: "layout" },
      { to: "/controls", label: "controls" },
      { to: "/disclosure", label: "disclosure" },
      { to: "/overlays", label: "overlays" },
    ],
  },
  {
    label: "instruments",
    links: [{ to: "/data", label: "readouts" }],
  },
] as const;

export const Route = createRootRoute({
  component: RootRoute,
});

function RootRoute() {
  const styles = shell();

  return (
    <div className={styles.page()}>
      <nav className={styles.rail()} aria-label="Components">
        <div className={styles.brand()}>
          <Title>polkadot-ui</Title>
          <Meta>base ui · tailwind-variants</Meta>
        </div>

        <ScrollArea className={styles.nav()}>
          {SECTIONS.map((section) => (
            <div key={section.label} className={styles.group()}>
              <Kind className={styles.groupLabel()}>{section.label}</Kind>
              {section.links.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className={styles.link()}
                  /* Exact, or "/" would stay active on every child route. */
                  activeOptions={{ exact: true }}
                  activeProps={{ "data-active": "" }}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          ))}
        </ScrollArea>
      </nav>

      <main className={styles.main()}>
        <Outlet />
      </main>
    </div>
  );
}
