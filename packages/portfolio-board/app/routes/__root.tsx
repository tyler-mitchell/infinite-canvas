import { createRootRouteWithContext, HeadContent, Link, Outlet, Scripts, useNavigate, useRouterState } from "@tanstack/react-router";
import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { Kind, Meta, ScrollArea, Title, tv } from "portfolio-board";
import "../styles.css";
import { AuthProvider } from "../components/auth/auth-provider";
import { Toaster } from "../components/ui/sonner";
import { authClient } from "../auth";
import { getSignInProviders } from "../auth.functions";

const shell = tv({
  slots: {
    page: "flex min-h-dvh flex-col bg-pk-ground font-pk-sans text-pk-ink sm:flex-row",
    /*
     * The rail repeats on every page and costs ten stops before the first thing a page holds —
     * counted, and `/foundations` holds none, so ten tabs reach nothing at all. Out of the way
     * until it takes the focus, which is the only time it is of use to anybody.
     */
    skip: "sr-only outline-none focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-pk-chip focus:bg-pk-surface-inner focus:px-3 focus:py-2 focus:font-pk-sans focus:text-pk-control focus:text-pk-ink-bright focus:no-underline focus:ring-2 focus:ring-pk-accent/50 focus:ring-offset-2 focus:ring-offset-(color:--pk-ring-seat)",
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
      { to: "/overview", label: "overview" },
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
  {
    label: "portfolio",
    links: [{ to: "/", label: "board" }],
  },
] as const;

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  loader: () => getSignInProviders(),
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Portfolio Board" },
    ],
  }),
  shellComponent: RootDocument,
  component: RootRoute,
});

function RootDocument({ children }: { children: ReactNode }) {
  const { queryClient } = Route.useRouteContext();
  const providers = Route.useLoaderData();
  const navigate = useNavigate();
  return (
    <html lang="en">
      <head><HeadContent /></head>
      <body>
        <QueryClientProvider client={queryClient}>
          <AuthProvider
            authClient={authClient}
            navigate={navigate}
            Link={({ href, ...props }) => <Link to={href} {...props} />}
            redirectTo="/editor"
            socialProviders={providers.map(({ id }) => id)}
            emailAndPassword={{ enabled: false }}
          >
            {children}
            <Toaster />
          </AuthProvider>
        </QueryClientProvider>
        <Scripts />
      </body>
    </html>
  );
}

function RootRoute() {
  const styles = shell();
  const isBoard = useRouterState({
    select: (state) => ["/", "/editor", "/tyler"].includes(state.location.pathname)
      || state.location.pathname.startsWith("/auth/")
      || state.location.pathname.startsWith("/p/"),
  });

  if (isBoard) return <Outlet />;

  return (
    <div className={styles.page()}>
      <a href="#content" className={styles.skip()}>
        Skip to content
      </a>

      <nav className={styles.rail()} aria-label="Components">
        <div className={styles.brand()}>
          <Title>portfolio-board</Title>
          <Meta>base ui · tailwind-variants</Meta>
        </div>

        <ScrollArea label="Sections" className={styles.nav()}>
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

      {/* Takes the focus on its own so the skip link lands somewhere, and leaves the tab order. */}
      <main id="content" tabIndex={-1} className={styles.main()}>
        <Outlet />
      </main>
    </div>
  );
}
