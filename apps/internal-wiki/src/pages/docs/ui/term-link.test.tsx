import { RegistryProvider } from "@effect/atom-react";
import { wikiBasePath } from "@repo/config";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";

import { GlossaryTermsProvider } from "./glossary-terms-provider.tsx";
import { TermLink } from "./term-link.tsx";

const terms = [
  {
    description: "運用者が機能の有効と無効を切り替える設定",
    href: `${wikiBasePath}/glossary/feature-flag`,
    name: "機能フラグ",
    slug: "feature-flag",
  },
] as const;

function rendered(term: string, label?: string): string {
  return renderToStaticMarkup(
    <RegistryProvider>
      <GlossaryTermsProvider terms={terms}>
        {label === undefined ? <TermLink term={term} /> : <TermLink label={label} term={term} />}
      </GlossaryTermsProvider>
    </RegistryProvider>,
  );
}

describe("glossary term link", () => {
  it("links a known term to its glossary page with its label and a closed tooltip", () => {
    expect.hasAssertions();
    const html = rendered("feature-flag", "フラグ");
    expect(html).toContain(`href="${wikiBasePath}/glossary/feature-flag"`);
    expect(html).toContain(">フラグ</a>");
    expect(html).not.toContain('role="tooltip"');
    expect(html).not.toContain("aria-describedby");
  });

  it("marks an unknown term as missing from the glossary and shows the term itself", () => {
    expect.hasAssertions();
    const html = rendered("未登録の用語");
    expect(html).toContain('title="用語集にまだ無い用語"');
    expect(html).toContain(">未登録の用語</span>");
    expect(html).not.toContain("<a");
  });
});
