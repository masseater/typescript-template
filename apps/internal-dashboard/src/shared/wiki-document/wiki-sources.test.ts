import { Effect } from "effect";
import { describe, expect, it } from "vite-plus/test";

import { gitBlobRevision, readWikiSource } from "./wiki-sources.ts";

describe("wiki sources", () => {
  it.each([
    { markdown: "hello\n", revision: "ce013625030ba8dba906f756967f9e9ca394464a" },
    { markdown: "日本語\n", revision: "c77dbef7f35c29e8829d98bf7fd8de21299e793b" },
  ])("names $markdown the way git hash-object names its blob", ({ markdown, revision }) =>
    Effect.runPromise(
      Effect.gen(function* blobRevision() {
        expect.hasAssertions();
        expect(yield* gitBlobRevision(markdown)).toBe(revision);
      }),
    ),
  );

  it("reads a page by its path under the wiki", () =>
    Effect.runPromise(
      Effect.gen(function* readPage() {
        expect.hasAssertions();
        expect(yield* readWikiSource("index.md")).toMatch(/^---\ntitle: /u);
      }),
    ));

  it("has nothing for a path outside the wiki", () =>
    Effect.runPromise(
      Effect.gen(function* outside() {
        expect.hasAssertions();
        expect(yield* readWikiSource("../package.json")).toBeUndefined();
      }),
    ));
});
