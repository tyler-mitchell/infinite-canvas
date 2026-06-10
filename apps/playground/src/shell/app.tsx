import { useCallback, useEffect, useState, type MouseEvent } from "react";
import { findShowcase, showcases } from "./registry.ts";

function usePathname(): [string, (path: string) => void] {
  const [pathname, setPathname] = useState(window.location.pathname);

  useEffect(() => {
    const onPopState = () => {
      setPathname(window.location.pathname);
    };
    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("popstate", onPopState);
    };
  }, []);

  const navigate = useCallback((path: string) => {
    window.history.pushState(null, "", path);
    setPathname(path);
  }, []);

  return [pathname, navigate];
}

export function App() {
  const [pathname, navigate] = usePathname();
  const slug = pathname.replace(/^\/+/, "");
  const active = findShowcase(slug) ?? showcases[0];

  const onNavClick = (event: MouseEvent<HTMLAnchorElement>, path: string) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }
    event.preventDefault();
    navigate(path);
  };

  if (!active) {
    return (
      <main className="shell-empty">
        No showcases found. Add one at <code>src/showcases/&lt;slug&gt;.showcase.tsx</code>.
      </main>
    );
  }

  return (
    <div className="shell">
      <nav aria-label="Showcases" className="shell-nav">
        <header className="shell-nav-header">
          <h1>infinite-canvas</h1>
          <p>playground</p>
        </header>
        <ul>
          {showcases.map((entry) => (
            <li key={entry.slug}>
              <a
                aria-current={entry.slug === active.slug ? "page" : undefined}
                href={`/${entry.slug}`}
                onClick={(event) => {
                  onNavClick(event, `/${entry.slug}`);
                }}
              >
                <span className="shell-nav-title">{entry.meta.title}</span>
                <span className="shell-nav-description">{entry.meta.description}</span>
              </a>
            </li>
          ))}
        </ul>
      </nav>
      <main className="shell-stage" data-testid="showcase-stage">
        <active.Component key={active.slug} />
      </main>
    </div>
  );
}
