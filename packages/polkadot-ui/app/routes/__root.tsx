import { createRootRoute, Link, Outlet } from "@tanstack/react-router";
import { Kind, Meta, ScrollArea, Title, tv } from "polkadot-ui";

const shell = tv({
  slots: {
    page: "flex min-h-dvh flex-col bg-pk-ground font-pk-sans text-pk-ink sm:flex-row",
    rail: "flex flex-none flex-col gap-4 border-b border-pk-line bg-pk-surface-deep px-5 py-5 sm:sticky sm:top-0 sm:h-dvh sm:w-[210px] sm:gap-5 sm:border-r sm:border-b-0 sm:py-7",
    brand: "flex flex-none flex-col gap-1",
    nav: "-mx-2 min-h-0 sm:flex-1",
    group: "flex flex-row flex-wrap gap-1 px-2 sm:mb-5 sm:flex-col sm:gap-px",
    groupLabel: "hidden sm:mb-2 sm:block sm:px-2",
    link: "rounded-pk-chip px-2 py-[7px] font-pk-sans text-[12.5px] leading-none text-pk-ink-dim no-underline outline-none transition-colors duration-(--pk-duration-hover) ease-pk-swift hover:bg-pk-surface hover:text-pk-ink-muted focus-visible:inset-ring-2 focus-visible:inset-ring-pk-accent/50 data-active:bg-pk-surface-inner data-active:text-pk-ink-bright sm:data-active:shadow-[inset_2px_0_0_var(--pk-accent)]",
    /* Every page caps its own measure, so the shell centres whatever it is given: left-aligned in
     * a wide main, the column sat against the rail with six hundred pixels of nothing beside it. */
    main: "min-w-0 flex-1 px-5 py-6 sm:px-9 sm:py-8 [&>*]:mx-auto",
  },
});

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
      { to: "/forms", label: "forms" },
      { to: "/disclosure", label: "disclosure" },
      { to: "/overlays", label: "overlays" },
    ],
  },
  {
    label: "composed",
    links: [
      { to: "/widgets", label: "widgets" },
      { to: "/readouts", label: "readouts" },
    ],
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
