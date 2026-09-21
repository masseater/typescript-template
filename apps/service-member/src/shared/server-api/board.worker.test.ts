import { assert, describe, it } from "@effect/vitest";
import { ROLE, type Role } from "@repo/config";
import { query, schema } from "@repo/db";
import { TestDatabase, runStatement } from "@repo/db/testing";
import { Effect } from "effect";
import { TestClock } from "effect/testing";

import { withdrawnAuthorName } from "#shared/contracts/board.ts";
import { createBoardPost, createBoardThread, findBoardThread, listBoardThreads } from "./board.ts";

import type { Database, DatabaseFailure } from "@repo/db";

const { user, withdrawnMember } = schema;
const recordedAt = new Date("2026-01-01T00:00:00.000Z");

const addUser = (added: {
  readonly userId: string;
  readonly role?: Role;
  readonly emailVerified?: boolean;
}): Effect.Effect<void, DatabaseFailure, Database> =>
  query(async (database): Promise<void> => {
    await database.insert(user).values({
      createdAt: recordedAt,
      email: `${added.userId}@example.com`,
      emailVerified: added.emailVerified ?? true,
      id: added.userId,
      name: added.userId,
      role: added.role ?? ROLE.member,
      updatedAt: recordedAt,
    });
  });

const firstPage = { limit: 2, offset: 0 };
const secondPage = { limit: 2, offset: 2 };
const wholePage = { limit: 50, offset: 0 };
const draft = { body: "はじめまして。", title: "自己紹介" };

function failureTag<Value, Failure extends { readonly _tag: string }, Requirements>(
  effect: Effect.Effect<Value, Failure, Requirements>,
): Effect.Effect<string, Value, Requirements> {
  return effect.pipe(
    Effect.flip,
    Effect.map((failure) => failure._tag),
  );
}

const openThread = Effect.fn("openThread")(function* openThread(authorId: string, title: string) {
  yield* TestClock.adjust("1 minute");
  return yield* createBoardThread(authorId, { ...draft, title });
});

describe("who may use the board", () => {
  it.effect.each([
    { emailVerified: false, role: ROLE.member, userId: "unverified" },
    { emailVerified: true, role: ROLE.administrator, userId: "operator" },
  ])("refuses $userId for reading and writing", ({ emailVerified, role, userId }) =>
    Effect.gen(function* program() {
      yield* addUser({ emailVerified, role, userId });
      assert.strictEqual(
        yield* failureTag(listBoardThreads(userId, firstPage)),
        "BoardMemberRequired",
      );
      assert.strictEqual(
        yield* failureTag(createBoardThread(userId, draft)),
        "BoardMemberRequired",
      );
    }).pipe(Effect.provide(TestDatabase)),
  );

  it.effect("refuses an id without a user row", () =>
    Effect.gen(function* program() {
      assert.strictEqual(
        yield* failureTag(listBoardThreads("nobody", firstPage)),
        "BoardMemberRequired",
      );
    }).pipe(Effect.provide(TestDatabase)),
  );
});

describe("threads and posts", () => {
  it.effect("opens a thread with its first post and counts replies", () =>
    Effect.gen(function* program() {
      yield* addUser({ userId: "author" });
      yield* addUser({ userId: "replier" });
      const threadId = yield* openThread("author", draft.title);
      yield* TestClock.adjust("1 minute");
      yield* createBoardPost("replier", threadId, "よろしくお願いします。");
      const listed = yield* listBoardThreads("replier", firstPage);
      assert.strictEqual(listed.total, 1);
      assert.deepStrictEqual(
        listed.threads.map((thread) => [thread.id, thread.title, thread.postCount, thread.author]),
        [[threadId, draft.title, 2, { id: "author", name: "author" }]],
      );
      const [thread] = listed.threads;
      assert.isDefined(thread);
      assert.isAbove(thread.lastPostedAt, thread.createdAt);
      const found = yield* findBoardThread("author", threadId, wholePage);
      assert.strictEqual(found.total, 2);
      assert.deepStrictEqual(
        found.posts.map((post) => [post.author?.id, post.body]),
        [
          ["author", draft.body],
          ["replier", "よろしくお願いします。"],
        ],
      );
    }).pipe(Effect.provide(TestDatabase)),
  );

  it.effect("lists threads by latest activity and pages them", () =>
    Effect.gen(function* program() {
      yield* addUser({ userId: "author" });
      const first = yield* openThread("author", "1");
      const second = yield* openThread("author", "2");
      const third = yield* openThread("author", "3");
      yield* TestClock.adjust("1 minute");
      yield* createBoardPost("author", first, "返信");
      const page1 = yield* listBoardThreads("author", firstPage);
      const page2 = yield* listBoardThreads("author", secondPage);
      assert.strictEqual(page1.total, 3);
      assert.deepStrictEqual(
        page1.threads.map((thread) => thread.id),
        [first, third],
      );
      assert.deepStrictEqual(
        page2.threads.map((thread) => thread.id),
        [second],
      );
      assert.deepStrictEqual(
        (yield* listBoardThreads("author", { limit: 2, offset: 4 })).threads,
        [],
      );
    }).pipe(Effect.provide(TestDatabase)),
  );

  it.effect("pages posts oldest first", () =>
    Effect.gen(function* program() {
      yield* addUser({ userId: "author" });
      const threadId = yield* openThread("author", draft.title);
      for (const body of ["2", "3"]) {
        yield* TestClock.adjust("1 minute");
        yield* createBoardPost("author", threadId, body);
      }
      const page1 = yield* findBoardThread("author", threadId, firstPage);
      const page2 = yield* findBoardThread("author", threadId, secondPage);
      assert.strictEqual(page1.total, 3);
      assert.deepStrictEqual(
        page1.posts.map((post) => post.body),
        [draft.body, "2"],
      );
      assert.deepStrictEqual(
        page2.posts.map((post) => post.body),
        ["3"],
      );
    }).pipe(Effect.provide(TestDatabase)),
  );

  it.effect("keeps posts of a removed author without naming them", () =>
    Effect.gen(function* program() {
      yield* addUser({ userId: "author" });
      yield* addUser({ userId: "reader" });
      const threadId = yield* openThread("author", draft.title);
      yield* runStatement("DELETE FROM user WHERE id = ?", "author");
      const found = yield* findBoardThread("reader", threadId, wholePage);
      // oxlint-disable-next-line unicorn/no-null
      assert.strictEqual(found.thread.author, null);
      assert.deepStrictEqual(
        found.posts.map((post) => [post.author, post.body]),
        // oxlint-disable-next-line unicorn/no-null
        [[null, draft.body]],
      );
    }).pipe(Effect.provide(TestDatabase)),
  );

  it.effect("labels posts by a withdrawn member and not by a deleted one", () =>
    Effect.gen(function* program() {
      yield* addUser({ userId: "withdrawn" });
      yield* addUser({ userId: "deleted" });
      yield* addUser({ userId: "reader" });
      const withdrawnThread = yield* openThread("withdrawn", "退会前");
      const deletedThread = yield* openThread("deleted", "削除前");
      yield* query((database) =>
        database.insert(withdrawnMember).values({
          createdAt: recordedAt,
          email: "withdrawn@example.com",
          emailVerified: true,
          memberId: "withdrawn",
          name: "withdrawn",
          profile: "",
          securityVersion: 0,
          snapshot: {},
          socialLinks: [],
          twoFactorEnabled: false,
          withdrawnAt: recordedAt,
        }),
      );
      yield* runStatement("DELETE FROM user WHERE id = ?", "withdrawn");
      yield* runStatement("DELETE FROM user WHERE id = ?", "deleted");
      const withdrawn = yield* findBoardThread("reader", withdrawnThread, wholePage);
      const deleted = yield* findBoardThread("reader", deletedThread, wholePage);
      const listed = yield* listBoardThreads("reader", { limit: 10, offset: 0 });
      assert.deepStrictEqual(withdrawn.thread.author, {
        name: withdrawnAuthorName,
        withdrawn: true,
      });
      assert.deepStrictEqual(
        withdrawn.posts.map((post) => post.author),
        [{ name: withdrawnAuthorName, withdrawn: true }],
      );
      // oxlint-disable-next-line unicorn/no-null
      assert.strictEqual(deleted.thread.author, null);
      assert.deepStrictEqual(
        listed.threads.map((thread) => [thread.id, thread.author]),
        [
          [deletedThread, null],
          [withdrawnThread, { name: withdrawnAuthorName, withdrawn: true }],
        ],
      );
    }).pipe(Effect.provide(TestDatabase)),
  );

  it.effect("refuses posts and reads on a thread that does not exist", () =>
    Effect.gen(function* program() {
      yield* addUser({ userId: "author" });
      assert.strictEqual(
        yield* failureTag(createBoardPost("author", "missing", "本文")),
        "BoardThreadNotFound",
      );
      assert.strictEqual(
        yield* failureTag(findBoardThread("author", "missing", wholePage)),
        "BoardThreadNotFound",
      );
    }).pipe(Effect.provide(TestDatabase)),
  );
});
