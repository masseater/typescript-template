import { describe, expect, it } from "vite-plus/test";

import { wikiPageHref } from "./wiki-page-href.ts";

describe("wikiPageHref", () => {
  it.each([
    { href: "/wiki", path: "index.md" },
    { href: "/wiki/glossary", path: "glossary/index.md" },
    { href: "/wiki/pages/member-users", path: "pages/member-users.md" },
  ])("opens $path at $href", ({ href, path }) => {
    expect(wikiPageHref(path)).toBe(href);
  });
});
