import { describe, expect, it } from "vite-plus/test";

import { findGlossaryTerm, glossaryTermsOf } from "./glossary-term.ts";
import { WIKI_DOCS_BASE_URL } from "./resolve-wiki-doc-href.ts";

const terms = [
  {
    description: "会員のアカウント",
    href: "/wiki/glossary/member-account",
    name: "会員アカウント",
    slug: "member-account",
  },
] as const;

describe("findGlossaryTerm", () => {
  it("matches by name", () => {
    expect.hasAssertions();
    expect(findGlossaryTerm(terms, "会員アカウント")?.slug).toBe("member-account");
  });

  it("matches by slug", () => {
    expect.hasAssertions();
    expect(findGlossaryTerm(terms, "member-account")?.name).toBe("会員アカウント");
  });

  it("returns undefined for unknown terms", () => {
    expect.hasAssertions();
    expect(findGlossaryTerm(terms, "未知")).toBeUndefined();
  });
});

describe("glossaryTermsOf", () => {
  it("keeps only direct glossary pages and links each to its wiki page", () => {
    expect.hasAssertions();
    const terms = glossaryTermsOf([
      { data: { title: "用語集" }, slugs: ["glossary"] },
      {
        data: { description: "会員のアカウント", title: "会員アカウント" },
        slugs: ["glossary", "member-account"],
      },
      { data: { title: "入れ子" }, slugs: ["glossary", "nested", "deep"] },
      { data: { title: "技術" }, slugs: ["tech-stack", "effect"] },
    ]);
    expect(terms).toStrictEqual([
      {
        description: "会員のアカウント",
        href: `${WIKI_DOCS_BASE_URL}/glossary/member-account`,
        name: "会員アカウント",
        slug: "member-account",
      },
    ]);
  });

  it("fills a missing description with an empty string and sorts by name", () => {
    expect.hasAssertions();
    const terms = glossaryTermsOf([
      { data: { title: "フォロー" }, slugs: ["glossary", "follow"] },
      {
        data: { description: "監査の記録", title: "監査イベント" },
        slugs: ["glossary", "audit-event"],
      },
      { data: { title: "グループ" }, slugs: ["glossary", "group"] },
    ]);
    expect(terms.map((term) => term.slug)).toStrictEqual(["group", "follow", "audit-event"]);
    expect(terms.find((term) => term.slug === "follow")?.description).toBe("");
  });
});
