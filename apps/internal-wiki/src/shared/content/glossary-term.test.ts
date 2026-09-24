import { describe, expect, it } from "vite-plus/test";

import { findGlossaryTerm } from "./glossary-term.ts";

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
