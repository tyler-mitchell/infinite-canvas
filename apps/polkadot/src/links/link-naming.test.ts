import { expect, test } from "vite-plus/test";

import { getLinkHost } from "./link-gateway";
import { getDraggedLinkName, getLinkName } from "./open-link";

test("a host is read from an ordinary address", () => {
  expect(getLinkHost("https://tanstack.com/router/latest")).toBe("tanstack.com");
});

test("a bare domain is a link, not a sentence", () => {
  expect(getLinkHost("example.com")).toBe("example.com");
  expect(getLinkHost("example.com/path?q=1")).toBe("example.com");
});

test("a string that is not an address has no host, and says so with an empty one", () => {
  expect(getLinkHost("just some words")).toBe("");
  expect(getLinkHost("")).toBe("");
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
