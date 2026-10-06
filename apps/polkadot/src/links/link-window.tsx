import { useValue } from "@legendapp/state/react";
import { proxy, syncState } from "@legendapp/state";
import { synced } from "@legendapp/state/sync";
import { ExternalLink } from "lucide-react";
import { useEffect } from "react";
import { Button } from "ui";
import { tv } from "ui/tv";

import { useLoaderData } from "@tanstack/react-router";

import { getProjectContent, projectContent$ } from "../content/project-content";
import { linkGateway, type LinkRecord } from "./link-gateway";

// The address bar stays visible when a site refuses iframe embedding.
const links$ = proxy<LinkRecord | null>((linkId) =>
  synced({
    initial: null,
    get: () => linkGateway.read(linkId),
    onError: (error) => console.warn("Could not read link", { linkId, error }),
  }),
);

// The same host always gets the same hue.
function getHostHue(host: string): number {
  let hash = 0;

  for (const character of host) {
    hash = (hash * 31 + character.codePointAt(0)!) % 360_000;
  }

  return hash % 360;
}

function getHostInitial(host: string): string {
  return (host.replace(/^www\./, "")[0] ?? "?").toUpperCase();
}

const linkWindow = tv({
  slots: {
    address: "truncate text-[11px] leading-[1.3] text-[var(--ink-faint)]",
    bar: "flex shrink-0 items-center gap-2.5 px-2.5 pt-2 pb-1.5",
    frame: "mx-2 mb-2 min-h-0 flex-1 rounded-[var(--radius-sm)] border-0 bg-[var(--ground-sunken)]",
    identity: "flex min-w-0 flex-1 flex-col gap-0.5",
    mark: "grid size-7 shrink-0 place-items-center rounded-[8px] text-[12px] leading-none font-semibold",
    name: "truncate text-[12.5px] leading-[1.35] font-medium text-[var(--ink)]",
    notice: "grid h-full place-items-center px-6 text-center text-[12.5px] text-[var(--ink-faint)]",
    root: "flex h-full flex-col",
  },
});

export function LinkWindowBody({ linkId }: Readonly<{ linkId: string }>) {
  const link$ = links$[linkId];
  const link = useValue(link$);
  const status$ = syncState(link$);
  const isLoaded = useValue(status$.isLoaded);
  const isGetting = useValue(status$.isGetting);
  const error = useValue(status$.error);
  const { projectId } = useLoaderData({ from: "/canvas/$canvasId" });
  const listing = useValue(projectContent$[projectId]);
  const styles = linkWindow();

  useEffect(() => {
    if (!status$.isLoaded.peek() && !status$.isGetting.peek() && status$.error.peek() !== undefined)
      void status$.sync();
  }, [status$]);

  const items = getProjectContent(listing, projectId);

  if (error !== undefined) {
    return (
      <div className={styles.notice()}>
        <div>
          <p role="alert">{error?.message ?? "Could not open this link."}</p>
          <Button
            disabled={isGetting}
            onClick={() => {
              if (!status$.isGetting.peek()) void status$.sync();
            }}
            size="sm"
            variant="ghost"
          >
            Retry
          </Button>
        </div>
      </div>
    );
  }
  if (!isLoaded || items === null) {
    return <div className={styles.notice()}>Loading…</div>;
  }

  const listed = items.find((item) => item.id === linkId);

  if (link == null || listed === undefined) {
    return <div className={styles.notice()}>This link no longer exists.</div>;
  }

  const { host, url } = link.content;
  // The project listing owns mutable titles. The cache owns the fixed address.
  const title = listed.title;
  const hue = getHostHue(host);
  const isAddress = host !== "";

  return (
    <div className={styles.root()}>
      <div className={styles.bar()}>
        <span
          className={styles.mark()}
          style={
            isAddress
              ? { background: `oklch(0.42 0.09 ${hue})`, color: `oklch(0.92 0.06 ${hue})` }
              : { background: "var(--ground-sunken)" }
          }
        >
          {isAddress ? getHostInitial(host) : "?"}
        </span>
        <span className={styles.identity()}>
          <span className={styles.name()}>{title}</span>
          <span className={styles.address()}>{isAddress ? url : "Not a link"}</span>
        </span>
        {isAddress ? (
          <Button
            aria-label="Open in browser"
            onClick={() => {
              globalThis.open(url, "_blank", "noreferrer,noopener");
            }}
            onPointerDown={(event) => {
              event.stopPropagation();
            }}
            size="icon-sm"
            title="Open in browser"
            variant="ghost"
          >
            <ExternalLink />
          </Button>
        ) : null}
      </div>
      {isAddress ? (
        <iframe
          className={styles.frame()}
          /* Browser lazy loading does not track visibility inside the canvas transform. */
          referrerPolicy="no-referrer"
          // The embedded page keeps its own origin.
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
          src={url}
          style={{ colorScheme: "dark" }}
          title={title}
        />
      ) : null}
    </div>
  );
}

export { getHostHue, getHostInitial };
