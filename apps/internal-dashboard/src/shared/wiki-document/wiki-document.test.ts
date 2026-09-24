import { Effect, Exit } from "effect";
import { describe, expect, it } from "vite-plus/test";

import { TERM_LINK, readWikiDocument, writeWikiDocument } from "./wiki-document.ts";

const wikiPages: Readonly<Record<string, string>> = import.meta.glob(
  "../../../content/docs/**/*.md",
  {
    eager: true,
    import: "default",
    query: "?raw",
  },
);

const pages = Object.entries(wikiPages).map(([path, markdown]) => ({
  markdown,
  name: path.replace("../../../content/docs/", ""),
}));

describe("opening and saving a wiki page in the editor", () => {
  it("is checked against the wiki pages", () => {
    expect(pages.length).toBeGreaterThan(0);
  });

  it.each(pages)("$name is saved byte for byte as it was", ({ markdown }) =>
    Effect.runPromise(
      Effect.gen(function* roundTrip() {
        expect.hasAssertions();
        expect(yield* writeWikiDocument(yield* readWikiDocument(markdown))).toBe(markdown);
      }),
    ),
  );
});

describe("wiki documents", () => {
  it("reads the frontmatter into the title and description", () =>
    Effect.runPromise(
      Effect.gen(function* readFrontmatter() {
        expect.hasAssertions();
        expect(
          yield* readWikiDocument(
            "---\ntitle: 招待\ndescription: 管理者を増やす手順\n---\n\n本文である。\n",
          ),
        ).toStrictEqual({
          description: "管理者を増やす手順",
          title: "招待",
          value: [{ children: [{ text: "本文である。" }], type: "p" }],
        });
      }),
    ));

  it("reads [[term|label]] as a glossary link element", () =>
    Effect.runPromise(
      Effect.gen(function* readTerm() {
        expect.hasAssertions();
        const { value } = yield* readWikiDocument(
          "---\ntitle: t\ndescription: d\n---\n\n[[会員アカウント|会員]]を作る。\n",
        );
        expect(value).toStrictEqual([
          {
            children: [
              { children: [{ text: "" }], label: "会員", term: "会員アカウント", type: TERM_LINK },
              { text: "を作る。" },
            ],
            type: "p",
          },
        ]);
      }),
    ));

  it("writes a glossary link element back as [[term]]", () =>
    Effect.runPromise(
      Effect.gen(function* writeTerm() {
        expect.hasAssertions();
        expect(
          yield* writeWikiDocument({
            description: "d",
            title: "t",
            value: [
              {
                children: [
                  { children: [{ text: "" }], term: "招待", type: TERM_LINK },
                  { text: "を送る。" },
                ],
                type: "p",
              },
            ],
          }),
        ).toBe("---\ntitle: t\ndescription: d\n---\n\n[[招待]]を送る。\n");
      }),
    ));

  it("keeps a link whose text is its own path as a link", () =>
    Effect.runPromise(
      Effect.gen(function* keepLink() {
        expect.hasAssertions();
        const source =
          "---\ntitle: t\ndescription: d\n---\n\n設定は [/security](/security) にある。\n";
        expect(yield* writeWikiDocument(yield* readWikiDocument(source))).toBe(source);
      }),
    ));

  it("quotes a title that YAML would otherwise read differently", () =>
    Effect.runPromise(
      Effect.gen(function* quoteTitle() {
        expect.hasAssertions();
        const written = yield* writeWikiDocument({
          description: "d",
          title: "手順: 招待",
          value: [{ children: [{ text: "本文" }], type: "p" }],
        });
        expect(written).toBe('---\ntitle: "手順: 招待"\ndescription: d\n---\n\n本文\n');
        expect((yield* readWikiDocument(written)).title).toBe("手順: 招待");
      }),
    ));

  it("refuses a page without a title", () =>
    Effect.runPromise(
      Effect.gen(function* refuseUntitled() {
        expect.hasAssertions();
        const read = yield* Effect.exit(readWikiDocument("---\ndescription: d\n---\n\n本文\n"));
        expect(Exit.isFailure(read)).toBe(true);
      }),
    ));
});
