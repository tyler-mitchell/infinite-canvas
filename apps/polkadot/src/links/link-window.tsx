import { useValue } from "@legendapp/state/react";
import { useEffect } from "react";
import { tv } from "ui/tv";

import { createContentCache } from "../database/content-cache";
import { linkGateway, type LinkRecord } from "./link-gateway";

/**
 * A window body bound to a link record.
 *
 * Read-once through the shared content cache, for the same reason a picture is: the window carries
 * only `{ itemId }`, a link's content never changes after creation, and the same address open in
 * two windows must not be two reads.
 *
 * **There is no preview and that is the design, not a gap.** Every link app fetches a title, a
 * description and an image from the page, and every one of those is a network read of a third-party
 * address. This workbench is local-first — a canvas that needs a connection to draw its own
 * contents is blank on a plane — and it is also somebody's private board of what they are reading,
 * which is not a thing to be quietly announcing to the sites on it. So the card draws what the drop
 * carried and nothing else.
 *
 * What replaces the favicon is a mark derived from the host. It is not decoration: a wall of link
 * cards is a wall of near-identical rectangles, and a stable colour per domain is what makes the
 * three cards from one site read as a group before a single word is read.
 */

const links = createContentCache<LinkRecord>({
  failedMessage: "Could not open this link.",
  missingMessage: "This link no longer exists.",
  read: (linkId) => linkGateway.read(linkId),
});

/**
 * A stable hue for a host, so one site is one colour everywhere on the canvas.
 *
 * Any cheap string hash does; this is the FNV-style multiply-xor loop, taken mod 360. What matters
 * is that it is deterministic and spread — the same host is the same colour in every window and in
 * every session, and two different hosts are usually far enough apart to tell apart.
 */
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
    /*
     * The whole card is the target, because a link's one verb is "go there".
     *
     * `grid` with the mark in its own column keeps the name and the address aligned to each other
     * rather than to the mark's height, so a two-line name does not push the address out of
     * alignment with the cards beside it.
     */
    /*
     * Centred rather than top-aligned, because the card's height is not its own choice.
     *
     * 200px is what the semantic-LOD return threshold costs a kind that wants a summary, and a
     * host, a name and an address need about 130 of it. Packing them to the top left the remainder
     * as a void under the text that read as a card that had failed to load something. Centring
     * spends the surplus as air on both sides, which is what the extra height actually is.
     */
    card: "grid h-full grid-cols-[auto_1fr] content-center gap-x-3.5 gap-y-2.5 p-4 no-underline outline-none transition-[background-color] duration-150 hover:bg-[color-mix(in_oklch,var(--ink)_4%,transparent)] focus-visible:bg-[color-mix(in_oklch,var(--ink)_6%,transparent)]",
    /** Faint, and last. It is the thing you check, not the thing you read. */
    address: "col-span-2 truncate text-[11.5px] leading-[1.4] text-[var(--ink-faint)]",
    host: "truncate self-center text-[12px] leading-[1.3] font-medium text-[var(--ink-muted)]",
    /*
     * Depth from light: the mark is a lit tile of the host's own hue over the window surface, with
     * the glyph in a brighter tint of the same. No border — a 1px ring would read as a wireframe
     * where a material is wanted.
     */
    mark: "grid size-8 place-items-center rounded-[9px] text-[13px] leading-none font-semibold",
    name: "col-span-2 line-clamp-2 text-[14px] leading-[1.45] font-medium text-balance text-[var(--ink)]",
    notice: "grid h-full place-items-center px-6 text-center text-[12.5px] text-[var(--ink-faint)]",
    /** The summary lane: one word at a readable size, whatever the zoom. */
    summary: "grid h-full place-items-center gap-2 px-4 text-center",
    summaryHost: "max-w-full truncate font-medium text-[var(--ink-muted)]",
  },
});

/**
 * Held in screen pixels and divided by zoom, which is the whole point of a summary.
 *
 * A link card shrunk is an address nobody can read. The host at a constant size is the *different*
 * thing the lane asks for — it is the part of a link a person actually recognises, and at a zoom
 * where the card is a thumbnail it is the only part worth the space.
 */
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

  /*
   * An address that would not parse has no host, and the card says so by not offering to go
   * anywhere: dragging selected text that merely looks like a link produces a string no browser
   * will take, and a dead link that still looks clickable is worse than one that plainly is not.
   */
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
      /*
       * `noreferrer` as well as `noopener`. The second is the security one — a new tab must not get
       * a handle on this one — and the first is the privacy one: a canvas of someone's reading is
       * not a thing to announce to every site on it as they open each card.
       */
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
