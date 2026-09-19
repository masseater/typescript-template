import { describe, expect, it } from "vite-plus/test";

import { resolveWikiDocHref } from "./resolve-wiki-doc-href.ts";

describe("resolveWikiDocHref", () => {
  it("prefixes the wiki base for root-absolute doc paths", () => {
    expect(resolveWikiDocHref("/getting-started/what-is-this")).toBe(
      "/wiki/getting-started/what-is-this",
    );
    expect(resolveWikiDocHref("/pages/wiki-layout#会員の枠")).toBe(
      "/wiki/pages/wiki-layout#会員の枠",
    );
  });

  it("leaves wiki-scoped, external, and hash hrefs unchanged", () => {
    expect(resolveWikiDocHref("/wiki/getting-started/applications")).toBe(
      "/wiki/getting-started/applications",
    );
    expect(resolveWikiDocHref("/wiki")).toBe("/wiki");
    expect(resolveWikiDocHref("#section")).toBe("#section");
    expect(resolveWikiDocHref("https://example.com/x")).toBe("https://example.com/x");
    expect(resolveWikiDocHref("mailto:a@b.c")).toBe("mailto:a@b.c");
    expect(resolveWikiDocHref("./sibling.md")).toBe("./sibling.md");
  });
});
