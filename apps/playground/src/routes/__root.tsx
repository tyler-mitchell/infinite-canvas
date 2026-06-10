import { createRootRoute, Link, Outlet, useRouter } from "@tanstack/react-router";

export const Route = createRootRoute({
  component: RootShell,
});

function RootShell() {
  const router = useRouter();
  const showcases = Object.values(router.routesByPath)
    .flatMap((route) => {
      const meta = route.options.staticData?.showcase;
      return meta ? [{ meta, path: route.fullPath }] : [];
    })
    .sort(
      (a, b) =>
        (a.meta.order ?? 100) - (b.meta.order ?? 100) || a.meta.title.localeCompare(b.meta.title),
    );

  return (
    <div className="flex h-full">
      <nav
        aria-label="Showcases"
        className="flex w-65 shrink-0 flex-col overflow-y-auto border-r border-sidebar-border bg-sidebar"
      >
        <header className="border-b border-sidebar-border px-5 pt-5 pb-3.5">
          <h1 className="text-[15px] font-semibold tracking-wide text-sidebar-foreground">
            infinite-canvas
          </h1>
          <p className="mt-0.5 text-xs text-muted-foreground">playground</p>
        </header>
        <ul className="space-y-0.5 p-2">
          {showcases.map(({ meta, path }) => (
            <li key={path}>
              <Link
                activeProps={{
                  className:
                    "bg-sidebar-accent text-sidebar-foreground shadow-[inset_2px_0_0_var(--sidebar-ring)]",
                }}
                className="block rounded-md px-3 py-2 text-sidebar-foreground/70 hover:bg-sidebar-accent"
                to={path}
              >
                <span className="block text-[13px] font-medium">{meta.title}</span>
                <span className="mt-0.5 block text-[11.5px] text-muted-foreground">
                  {meta.description}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <main className="relative min-w-0 flex-1 overflow-hidden" data-testid="showcase-stage">
        <Outlet />
      </main>
    </div>
  );
}
