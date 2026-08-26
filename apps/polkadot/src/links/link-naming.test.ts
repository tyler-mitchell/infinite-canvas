import { expect, test } from "vite-plus/test";

import { getLinkHost } from "./link-gateway";
import { getDraggedLinkName, getLinkName } from "./open-link";

/**
 * Naming a dropped address, which is the whole of what a link kind has to decide.
 *
 * Every other kind arrives named — a note by its first line, a picture by its filename, a
 * collection by the person making it. A link arrives as a string, and every branch below was
 * written from reasoning about what a browser puts on a drag rather than from watching one. That
 * is the honest reason to pin them: the drag itself was driven once, with one shape of uri-list,
 * and these are the shapes it did not carry.
 *
 * The failure they guard against is quiet. A card with a wrong name still renders, still opens the
 * right address, and still looks like a working card — it is only wrong on the canvas, weeks later,
 * when nobody can find the thing they saved.
 */

test("a host is read from an ordinary address", () => {
  expect(getLinkHost("https://tanstack.com/router/latest")).toBe("tanstack.com");
});

test("a bare domain is a link, not a sentence", () => {
  /*
   * `new URL("example.com")` throws — no scheme, so it is a relative reference, and a naive
   * implementation reports it as unparseable and draws a dead card. Trying `https://` in front is
   * what a browser's address bar does, and it is the difference between a dropped `example.com`
   * being a link and being text.
   */
  expect(getLinkHost("example.com")).toBe("example.com");
  expect(getLinkHost("example.com/path?q=1")).toBe("example.com");
});

test("a string that is not an address has no host, and says so with an empty one", () => {
  // Not a thrown error: dragging selected prose that merely looks like a link is a real case, and
  // the card's job then is to show the text and refuse to offer a destination.
  expect(getLinkHost("just some words")).toBe("");
  expect(getLinkHost("")).toBe("");
});

test("a name is the host and the path, without the parts that name nothing", () => {
  /*
   * The host alone would call four links to one documentation site by the same name, and the
   * canvas would be four identical cards. The full URL is an address rather than a name — a card
   * titled with a query string cannot be scanned.
   */
  expect(getLinkName("https://www.tanstack.com/router/latest/docs?tab=react#install")).toBe(
    "tanstack.com/router/latest/docs",
  );
});

test("a bare host keeps its name short rather than trailing a slash", () => {
  expect(getLinkName("https://example.com/")).toBe("example.com");
  expect(getLinkName("https://example.com")).toBe("example.com");
  // A trailing slash on a real path is punctuation, not a segment.
  expect(getLinkName("https://example.com/docs/")).toBe("example.com/docs");
});

test("an unparseable address names itself, truncated", () => {
  expect(getLinkName("just some words")).toBe("just some words");
});

test("a name is cut to a length that is still a name", () => {
  const long = `https://example.com/${"a".repeat(200)}`;

  expect(getLinkName(long).length).toBe(64);
});

test("a dragged tab's title becomes the card's name", () => {
  // The comment line of a `text/uri-list`, which is where a browser has somewhere to put the page
  // title. It is a far better card than anything derivable from the address.
  expect(getDraggedLinkName("# TanStack Router Docs\r\nhttps://tanstack.com/router\r\n")).toBe(
    "TanStack Router Docs",
  );
});

test("a list with no comment brings no name, so the address names itself", () => {
  expect(getDraggedLinkName("https://example.com/a\nhttps://example.com/b\n")).toBeNull();
  expect(getDraggedLinkName("")).toBeNull();
});

test("a bare hash is not a name", () => {
  // A `#` with nothing after it is a comment marker and no title. Returning "" would title the
  // card with an empty string, which renders as a card that has lost its name.
  expect(getDraggedLinkName("#\r\nhttps://example.com/a")).toBeNull();
  expect(getDraggedLinkName("#   \nhttps://example.com/a")).toBeNull();
});
