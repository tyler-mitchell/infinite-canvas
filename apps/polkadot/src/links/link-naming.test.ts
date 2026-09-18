import { expect, test } from "vite-plus/test";

import { parseLinkUrl } from "./link-gateway";
import { getDraggedLinkName, getLinkName } from "./open-link";

test("a host is read from an ordinary address", () => {
  expect(parseLinkUrl("https://tanstack.com/router/latest")?.host).toBe("tanstack.com");
});

test("a bare domain is a link, not a sentence", () => {
  expect(parseLinkUrl("example.com")?.host).toBe("example.com");
  expect(parseLinkUrl("example.com/path?q=1")?.host).toBe("example.com");
});

test.each(["https://", "https:", "http://["])(
  "an invalid explicit address remains invalid: %s",
  (url) => {
    expect(parseLinkUrl(url)).toBeNull();
  },
);

test("bare addresses trim surrounding whitespace and retain URL-valued queries", () => {
  expect(parseLinkUrl("  example.com/path?q=1  ")?.href).toBe("https://example.com/path?q=1");
  expect(parseLinkUrl("example.com/?next=https://example.org/")?.href).toBe(
    "https://example.com/?next=https://example.org/",
  );
  expect(getLinkName("example.com/?next=https://example.org/")).toBe("example.com");
  expect(getLinkName("  example.com/path?q=1  ")).toBe("example.com/path");
});

test("a string that is not an address has no host, and says so with an empty one", () => {
  expect(parseLinkUrl("just some words")).toBeNull();
  expect(parseLinkUrl("")).toBeNull();
});

test("a name is the host and the path, without the parts that name nothing", () => {
  expect(getLinkName("https://www.tanstack.com/router/latest/docs?tab=react#install")).toBe(
    "tanstack.com/router/latest/docs",
  );
});

test("a bare host keeps its name short rather than trailing a slash", () => {
  expect(getLinkName("https://example.com/")).toBe("example.com");
  expect(getLinkName("https://example.com")).toBe("example.com");
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
  expect(getDraggedLinkName("# TanStack Router Docs\r\nhttps://tanstack.com/router\r\n")).toBe(
    "TanStack Router Docs",
  );
});

test("a list with no comment brings no name, so the address names itself", () => {
  expect(getDraggedLinkName("https://example.com/a\nhttps://example.com/b\n")).toBeNull();
  expect(getDraggedLinkName("")).toBeNull();
});

test("a bare hash is not a name", () => {
  expect(getDraggedLinkName("#\r\nhttps://example.com/a")).toBeNull();
  expect(getDraggedLinkName("#   \nhttps://example.com/a")).toBeNull();
});

test("empty comments do not hide a later dragged title", () => {
  expect(getDraggedLinkName("#\r\n#   \n# Example title\rhttps://example.com/\r\n")).toBe(
    "Example title",
  );
});

test("title limits preserve complete emoji and combining characters", () => {
  const prefix = "a".repeat(63);
  expect(getDraggedLinkName(`# ${prefix}👩‍💻extra\nhttps://example.com/`)).toBe(`${prefix}👩‍💻`);
  expect(getDraggedLinkName(`# ${prefix}e\u0301extra\nhttps://example.com/`)).toBe(
    `${prefix}e\u0301`,
  );
});
