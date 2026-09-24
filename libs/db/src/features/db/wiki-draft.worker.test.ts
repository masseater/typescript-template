import { Effect, Layer } from "effect";
import { TestClock } from "effect/testing";
import { describe, expect, test } from "vite-plus/test";

import { TestDatabase, runStatement } from "./database-test-fixture.ts";
import {
  discardWikiDraft,
  findWikiDraft,
  markWikiDraftPublished,
  saveWikiDraft,
} from "./wiki-draft.ts";

const SECOND = 1000;
const SAVED_TWICE = 2;
const insertStaff =
  "INSERT INTO user (id, name, email, email_verified, created_at, updated_at) VALUES ('staff', 'staff', 'staff@example.com', 1, 0, 0)";

describe("saving a wiki draft", () => {
  const it = test.extend("savedTwice", () =>
    Effect.runPromise(
      Effect.gen(function* program() {
        yield* runStatement(insertStaff);
        const first = yield* saveWikiDraft({
          baseRevision: "blob-1",
          markdown: "---\ntitle: t\ndescription: d\n---\n\n本文\n",
          path: "glossary/invite",
          updatedBy: "staff",
          version: 0,
        });
        const afterFirst = yield* findWikiDraft("glossary/invite");
        yield* TestClock.adjust(SECOND);
        const second = yield* saveWikiDraft({
          baseRevision: "blob-2",
          markdown: "二",
          path: "glossary/invite",
          updatedBy: "staff",
          version: 1,
        });
        const afterSecond = yield* findWikiDraft("glossary/invite");
        return {
          afterFirst: { ...afterFirst, updatedAt: afterFirst?.updatedAt.getTime() },
          afterSecond: { ...afterSecond, updatedAt: afterSecond?.updatedAt.getTime() },
          versions: [first, second],
        };
      }).pipe(Effect.provide(Layer.merge(TestDatabase, TestClock.layer()))),
    ));

  it("keeps the revision the first save started from and advances the version", ({
    savedTwice,
  }) => {
    expect(savedTwice).toStrictEqual({
      afterFirst: {
        baseRevision: "blob-1",
        markdown: "---\ntitle: t\ndescription: d\n---\n\n本文\n",
        path: "glossary/invite",
        publishedRevision: null,
        publishedUrl: null,
        updatedAt: 0,
        version: 1,
      },
      afterSecond: {
        baseRevision: "blob-1",
        markdown: "二",
        path: "glossary/invite",
        publishedRevision: null,
        publishedUrl: null,
        updatedAt: SECOND,
        version: SAVED_TWICE,
      },
      versions: [1, SAVED_TWICE],
    });
  });
});

describe("two editors saving the same version", () => {
  const it = test.extend("raced", () =>
    Effect.runPromise(
      Effect.gen(function* program() {
        yield* runStatement(insertStaff);
        const draft = { baseRevision: null, path: "new-page", updatedBy: "staff" };
        yield* saveWikiDraft({ ...draft, markdown: "一", version: 0 });
        const late = yield* saveWikiDraft({ ...draft, markdown: "別の一", version: 0 }).pipe(
          Effect.flip,
        );
        const stale = yield* saveWikiDraft({
          ...draft,
          markdown: "古い版からの二",
          version: SAVED_TWICE,
        }).pipe(Effect.flip);
        return {
          lateTag: late._tag,
          staleTag: stale._tag,
          stored: (yield* findWikiDraft("new-page"))?.markdown,
        };
      }).pipe(Effect.provide(TestDatabase)),
    ));

  it("stores only the first save", ({ raced }) => {
    expect(raced).toStrictEqual({
      lateTag: "WikiDraftConflict",
      staleTag: "WikiDraftConflict",
      stored: "一",
    });
  });
});

describe("discarding a wiki draft", () => {
  const it = test.extend("discarded", () =>
    Effect.runPromise(
      Effect.gen(function* program() {
        yield* runStatement(insertStaff);
        yield* saveWikiDraft({
          baseRevision: null,
          markdown: "a",
          path: "a",
          updatedBy: "staff",
          version: 0,
        });
        const stale = yield* discardWikiDraft("a", SAVED_TWICE).pipe(Effect.flip);
        const keptAfterStale = (yield* findWikiDraft("a")) !== undefined;
        yield* discardWikiDraft("a", 1);
        return { keptAfterStale, left: yield* findWikiDraft("a"), staleTag: stale._tag };
      }).pipe(Effect.provide(TestDatabase)),
    ));

  it("discards only at the version the discarding editor saw", ({ discarded }) => {
    expect(discarded).toStrictEqual({
      keptAfterStale: true,
      left: undefined,
      staleTag: "WikiDraftConflict",
    });
  });
});

describe("a draft whose editor is removed", () => {
  const it = test.extend("orphaned", () =>
    Effect.runPromise(
      Effect.gen(function* program() {
        yield* runStatement(insertStaff);
        yield* saveWikiDraft({
          baseRevision: null,
          markdown: "a",
          path: "a",
          updatedBy: "staff",
          version: 0,
        });
        yield* runStatement("DELETE FROM user WHERE id = 'staff'");
        return (yield* findWikiDraft("a"))?.markdown;
      }).pipe(Effect.provide(TestDatabase)),
    ));

  it("outlives the editor who saved it", ({ orphaned }) => {
    expect(orphaned).toBe("a");
  });
});

describe("publishing a wiki draft", () => {
  const pullRequest = "https://github.example.test/owner/repo/pull/7";
  const it = test.extend("published", () =>
    Effect.runPromise(
      Effect.gen(function* program() {
        yield* runStatement(insertStaff);
        const draft = { baseRevision: "blob-1", path: "index.md", updatedBy: "staff" };
        yield* saveWikiDraft({ ...draft, markdown: "一", version: 0 });
        yield* markWikiDraftPublished({
          path: "index.md",
          revision: "blob-2",
          url: pullRequest,
          version: 1,
        });
        const marked = yield* findWikiDraft("index.md");
        const stale = yield* markWikiDraftPublished({
          path: "index.md",
          revision: "blob-3",
          url: pullRequest,
          version: 0,
        }).pipe(Effect.flip);
        yield* saveWikiDraft({ ...draft, markdown: "一", version: 1 });
        const savedUnchanged = yield* findWikiDraft("index.md");
        yield* saveWikiDraft({ ...draft, markdown: "二", version: 2 });
        const editedAgain = yield* findWikiDraft("index.md");
        return {
          editedAgain: [editedAgain?.publishedRevision, editedAgain?.publishedUrl],
          marked: [marked?.publishedRevision, marked?.publishedUrl],
          savedUnchanged: [savedUnchanged?.publishedRevision, savedUnchanged?.publishedUrl],
          stale: stale._tag,
        };
      }).pipe(Effect.provide(Layer.merge(TestDatabase, TestClock.layer()))),
    ));

  it("remembers the pull request until the draft's text changes", ({ published }) => {
    expect(published).toStrictEqual({
      editedAgain: [null, null],
      marked: ["blob-2", pullRequest],
      savedUnchanged: ["blob-2", pullRequest],
      stale: "WikiDraftConflict",
    });
  });
});
