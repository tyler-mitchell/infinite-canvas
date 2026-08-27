import { useValue } from "@legendapp/state/react";
import { ExternalLink } from "lucide-react";
import { useEffect } from "react";
import { Button } from "ui";
import { tv } from "ui/tv";

import { createContentCache } from "../database/content-cache";
import { linkGateway, type LinkRecord } from "./link-gateway";

/**
 * A window body bound to a link record: the page itself, in the canvas.
 *
 * Many sites refuse to be embedded (`X-Frame-Options`, CSP `frame-ancestors`) and the failure is
 * silent — a blank frame, no error anyone can read. There is no reliable way to detect it, so the
 * bar above the page is always there: host, title, and a way out. A refused page leaves a window
 * that still says what it is and still opens.
 *
 * No favicon: that is a network read of a third-party address. The host mark replaces it, a stable
 * colour per domain so cards from one site read as a group.
 */

const links = createContentCache<LinkRecord>({
  failedMessage: "Could not open this link.",
  missingMessage: "This link no longer exists.",
  read: (linkId) => linkGateway.read(linkId),
});

/** A stable hue per host, so one site is one colour in every window and every session. */
function getHostHue(host: string): number {
  let hash = 0;

  for (const character of host) {
    hash = (hash * 31 + character.codePointAt(0)!) % 360_000;
  }

  return hash % 360;
}

/** The letter that stands for a host: the first of its name, past any `www.`. */
function getHostInitial(host: string): string {
  return (host.replace(/^www\./, "")[0] ?? "?").toUpperCase();
}

const linkWindow = tv({
  slots: {
    address: "truncate text-[11px] leading-[1.3] text-[var(--ink-faint)]",
    bar: "flex shrink-0 items-center gap-2.5 px-2.5 pt-2 pb-1.5",
    /*
     * Inset and rounded, so the page sits *in* the window rather than being it.
     *
     * Edge to edge, a light page is a white slab bleeding into the window's own corners — and half
     * the web is a light page, so this is the normal case and not the failure one. It reads worst
     * when the page refuses to embed and Chrome paints its own white error document, which cannot
     * be styled from here and cannot be detected either: a refused frame and a loaded cross-origin
     * frame both fire `load` and both throw `SecurityError` on every property worth reading.
     * Measured, not assumed.
     */
    frame: "mx-2 mb-2 min-h-0 flex-1 rounded-[var(--radius-sm)] border-0 bg-[var(--ground-sunken)]",
    identity: "flex min-w-0 flex-1 flex-col gap-0.5",
    // Lit tile of the host's hue, glyph in a brighter tint. No ring: light, not wireframe.
    mark: "grid size-7 shrink-0 place-items-center rounded-[8px] text-[12px] leading-none font-semibold",
    name: "truncate text-[12.5px] leading-[1.35] font-medium text-[var(--ink)]",
    notice: "grid h-full place-items-center px-6 text-center text-[12.5px] text-[var(--ink-faint)]",
    root: "flex h-full flex-col",
  },
});

export function LinkWindowBody({ linkId }: Readonly<{ linkId: string }>) {
  const entry = useValue(links.entries$[linkId]);
  const styles = linkWindow();

  useEffect(() => {
    links.ensureLoaded(linkId);
  }, [linkId]);

  if (entry === undefined || entry.status === "loading") {
    return <div className={styles.notice()}>Loading…</div>;
  }

  if (entry.status === "error" || entry.record === null) {
    return <div className={styles.notice()}>{entry.error ?? "Could not open this link."}</div>;
  }

  const { host, url } = entry.record.content;
  const hue = getHostHue(host);
  // No host means the string never parsed, so there is nothing to load and nowhere to open.
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
          <span className={styles.name()}>{entry.record.title}</span>
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
          /*
           * Eager, deliberately, and `loading="lazy"` must not come back without solving what broke
           * it. Tried on 2026-08-26 to avoid fetching a page per link window on canvas open; the
           * page then did not appear at all.
           *
           * The reason is the thing that made it look safe. Laziness is resolved against the
           * frame's position relative to the viewport, and these frames do not sit in the page the
           * way that calculation assumes: a window lives under the canvas's world→screen transform,
           * inside a subtree the framework may mark `content-visibility: auto`. A frame the user is
           * looking at is not necessarily a frame the intersection logic calls near, so the deferral
           * never resolves and the document is never requested.
           *
           * The cost this was trying to avoid is real — a canvas is built to hold many of these,
           * and eager means a cross-origin document and its scripts per window. Whatever replaces
           * it has to key on the canvas's own idea of what is on screen rather than the browser's.
           */
          referrerPolicy="no-referrer"
          // `allow-same-origin` keeps the embedded page on its own origin, which most sites need to
          // run at all. It is not this document's origin, so it grants nothing here.
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
          src={url}
          // A page that refuses to embed, or fails to resolve, paints the browser's own blank
          // document. Dark keeps that from flashing white on a dark canvas.
          style={{ colorScheme: "dark" }}
          title={entry.record.title}
        />
      ) : null}
    </div>
  );
}

export { getHostHue, getHostInitial };
