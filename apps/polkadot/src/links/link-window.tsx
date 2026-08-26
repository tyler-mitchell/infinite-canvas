import { useValue } from "@legendapp/state/react";
import { useEffect } from "react";
import { tv } from "ui/tv";

import { createContentCache } from "../database/content-cache";
import { linkGateway, type LinkRecord } from "./link-gateway";

/**
 * A window body bound to a link record.
 *
 * No favicon, because that is a network read of a third-party address and this is local-first. The
 * host mark replaces it: a stable colour per domain, so cards from one site read as a group.
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
    // Whole card is the target; centred because the 200px floor is the LOD threshold's price.
    card: "grid h-full grid-cols-[auto_1fr] content-center gap-x-3.5 gap-y-2.5 p-4 no-underline outline-none transition-[background-color] duration-150 hover:bg-[color-mix(in_oklch,var(--ink)_4%,transparent)] focus-visible:bg-[color-mix(in_oklch,var(--ink)_6%,transparent)]",
    /** Faint, and last. It is the thing you check, not the thing you read. */
    address: "col-span-2 truncate text-[11.5px] leading-[1.4] text-[var(--ink-faint)]",
    host: "truncate self-center text-[12px] leading-[1.3] font-medium text-[var(--ink-muted)]",
    // Lit tile of the host's hue, glyph in a brighter tint. No ring: light, not wireframe.
    mark: "grid size-8 place-items-center rounded-[9px] text-[13px] leading-none font-semibold",
    name: "col-span-2 line-clamp-2 text-[14px] leading-[1.45] font-medium text-balance text-[var(--ink)]",
    notice: "grid h-full place-items-center px-6 text-center text-[12.5px] text-[var(--ink-faint)]",
    /** The summary lane: one word at a readable size, whatever the zoom. */
    summary: "grid h-full place-items-center gap-2 px-4 text-center",
    summaryHost: "max-w-full truncate font-medium text-[var(--ink-muted)]",
  },
});

/** Screen pixels, divided by zoom: the host stays readable when the card is a thumbnail. */
const SUMMARY_HOST_SCREEN_PX = 12;

export function LinkSummary({ linkId, zoom }: Readonly<{ linkId: string; zoom: number }>) {
  const entry = useValue(links.entries$[linkId]);
  const styles = linkWindow();

  useEffect(() => {
    links.ensureLoaded(linkId);
  }, [linkId]);

  const host = entry?.record?.content.host ?? "";

  return (
    <div className={styles.summary()}>
      <span className={styles.summaryHost()} style={{ fontSize: SUMMARY_HOST_SCREEN_PX / zoom }}>
        {host === "" ? "Link" : host.replace(/^www\./, "")}
      </span>
    </div>
  );
}

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

  // No host means the string never parsed, so the card does not pretend to be clickable.
  if (host === "") {
    return (
      <div className={styles.card()}>
        <span className={styles.mark()} style={{ background: "var(--ground-sunken)" }}>
          ?
        </span>
        <span className={styles.host()}>Not a link</span>
        <span className={styles.name()}>{entry.record.title}</span>
        <span className={styles.address()}>{url}</span>
      </div>
    );
  }

  return (
    <a
      className={styles.card()}
      href={url}
      // noopener for security, noreferrer so the sites are not told what board they came from.
      rel="noreferrer noopener"
      target="_blank"
    >
      <span
        className={styles.mark()}
        style={{
          background: `oklch(0.42 0.09 ${hue})`,
          color: `oklch(0.92 0.06 ${hue})`,
        }}
      >
        {getHostInitial(host)}
      </span>
      <span className={styles.host()}>{host.replace(/^www\./, "")}</span>
      <span className={styles.name()}>{entry.record.title}</span>
      <span className={styles.address()}>{url}</span>
    </a>
  );
}

export { getHostHue, getHostInitial };
