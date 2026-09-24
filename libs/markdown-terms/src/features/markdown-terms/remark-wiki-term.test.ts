import { Effect } from "effect";
import { remark } from "remark";
import remarkMdx from "remark-mdx";
import { describe, expect, test } from "vite-plus/test";

import { remarkWikiTerm, wikiTermSyntax } from "./remark-wiki-term.ts";

describe("reading wiki term links", () => {
  const it = test.extend("rendered", () =>
    Effect.runPromise(
      Effect.promise(() =>
        remark()
          .use(remarkMdx)
          .use(remarkWikiTerm)
          .process(
            "[[利用者]] と [[利用者|ユーザー]] と [[利用者|利用者]]、`[[コード]]` と [[[リンク]]](https://example.com) と [[ ]]\n",
          ),
      ).pipe(Effect.map(String)),
    ));

  it("turns terms into term link elements and leaves code, links and blank terms as text", ({
    rendered,
  }) => {
    expect(rendered).toBe(
      '<TermLink term="利用者" /> と <TermLink term="利用者" label="ユーザー" /> と <TermLink term="利用者" />、`[[コード]]` と [\\[\\[リンク\\]\\]](https://example.com) と \\[\\[ ]]\n',
    );
  });
});

describe("writing wiki term links", () => {
  const it = test.extend("written", () =>
    ["利用者", "ユーザー", undefined].map((shownLabel) => wikiTermSyntax("利用者", shownLabel)));

  it("writes the label only when it differs from the term", ({ written }) => {
    expect(written).toStrictEqual(["[[利用者]]", "[[利用者|ユーザー]]", "[[利用者]]"]);
  });
});
