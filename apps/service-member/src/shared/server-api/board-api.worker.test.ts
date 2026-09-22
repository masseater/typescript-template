import { assert, describe, it } from "@effect/vitest";
import { APPLICATION, httpStatus } from "@repo/config";
import { TestDatabase, runStatement } from "@repo/db/testing";
import { recordingSink } from "@repo/observability/testing";
import { accountApi } from "@repo/runtime/account";
import { appLayer } from "@repo/runtime/bindings";
import { apiRoot, apiRoutes, createApi } from "@repo/runtime/http";
import { appEnvironment, fixtureOrigin } from "@repo/runtime/testing";
import { workerRuntime } from "@repo/runtime/worker";
import { env } from "cloudflare:workers";
import { Effect, Layer, Schema } from "effect";

import { BoardThreadCreated, BoardThreadList, BoardThreadView } from "#shared/contracts/index.ts";
import { boardApi } from "./board-api.ts";

declare global {
  // oxlint-disable-next-line typescript/no-namespace
  namespace Cloudflare {
    interface Env {
      readonly EMAIL: {
        taken(): Promise<
          ReadonlyArray<{
            readonly from: string;
            readonly subject: string;
            readonly text: string;
            readonly to: readonly string[];
          }>
        >;
      };
    }
  }
}

const routes = { "/api/board": "board-api" };
const reporting = { log: recordingSink().sink, service: APPLICATION.user } as const;
const migrated = Effect.orDie(Effect.provide(runStatement("select 1"), TestDatabase));
const password = "test-password-safe-123";
const draft = { body: "はじめまして。", title: "自己紹介" };
const decodeCreated = Schema.decodeUnknownEffect(BoardThreadCreated);
const decodeList = Schema.decodeUnknownEffect(BoardThreadList);
const decodeThread = Schema.decodeUnknownEffect(BoardThreadView);

type App = ReturnType<typeof boardApp>;

function boardApp() {
  const runtime = workerRuntime(() =>
    Layer.orDie(appLayer({ env: appEnvironment(), audience: APPLICATION.user, routes })),
  );
  const api = apiRoutes(runtime, reporting);
  return createApi(apiRoot).use(accountApi(api)).use(boardApi(api));
}

function send(
  app: App,
  path: string,
  init: { readonly body?: unknown; readonly cookie?: string; readonly method?: "GET" | "POST" },
): Effect.Effect<Response> {
  return Effect.gen(function* sendBoardRequest() {
    const method = init.method ?? (init.body === undefined ? "GET" : "POST");
    const body =
      init.body === undefined
        ? undefined
        : yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))(init.body);
    return yield* Effect.promise(() =>
      Promise.resolve(
        app.fetch(
          new Request(`${fixtureOrigin}${apiRoot}${path}`, {
            headers: {
              "content-type": "application/json",
              cookie: init.cookie ?? "",
              origin: fixtureOrigin,
            },
            method,
            ...(body === undefined ? {} : { body }),
          }),
        ),
      ),
    );
  }).pipe(Effect.orDie);
}

const jsonOf = (response: Response): Effect.Effect<unknown> =>
  Effect.promise(() => response.json() as Promise<unknown>);

const verificationToken = Effect.fn("verificationToken")(function* verificationToken(
  email: string,
) {
  const delivered = yield* Effect.promise(() => env.EMAIL.taken());
  const mail = delivered.findLast((sent) => sent.to.includes(email));
  const link = mail?.text.split("\n").find((line) => line.startsWith("http://")) ?? "";
  return new URLSearchParams(new URL(link).hash.slice(1)).get("token") ?? "";
});

const signedInMember = Effect.fn("signedInMember")(function* signedInMember(
  app: App,
  email: string,
) {
  const signedUp = yield* send(app, "/auth/sign-up/email", {
    body: { email, name: email.split("@")[0], password },
  });
  assert.strictEqual(signedUp.status, httpStatus.ok);
  const token = yield* verificationToken(email);
  const verified = yield* send(app, "/verify-email", { body: { token } });
  assert.strictEqual(verified.status, httpStatus.ok);
  const signedIn = yield* send(app, "/auth/sign-in/email", { body: { email, password } });
  assert.strictEqual(signedIn.status, httpStatus.ok);
  return signedIn.headers
    .getSetCookie()
    .map((header) => header.split(";")[0] ?? "")
    .join("; ");
});

const openThread = Effect.fn("openThread")(function* openThread(
  app: App,
  cookie: string,
  title: string,
) {
  const response = yield* send(app, "/board/threads", { body: { ...draft, title }, cookie });
  assert.strictEqual(response.status, httpStatus.ok);
  return (yield* decodeCreated(yield* jsonOf(response))).id;
});

describe("board api", () => {
  it.effect("refuses anonymous readers and writers", () =>
    Effect.gen(function* program() {
      yield* migrated;
      const app = boardApp();
      const statuses = yield* Effect.all([
        send(app, "/board/threads", {}),
        send(app, "/board/thread?id=any", {}),
        send(app, "/board/threads", { body: draft }),
        send(app, "/board/posts", { body: { body: draft.body, threadId: "any" } }),
      ]).pipe(Effect.map((responses) => responses.map((response) => response.status)));
      assert.deepStrictEqual(statuses, [
        httpStatus.unauthorized,
        httpStatus.unauthorized,
        httpStatus.unauthorized,
        httpStatus.unauthorized,
      ]);
    }),
  );

  it.effect("lets a member open a thread, reply to it and see the counts", () =>
    Effect.gen(function* program() {
      yield* migrated;
      const app = boardApp();
      const author = yield* signedInMember(app, "author@example.test");
      const replier = yield* signedInMember(app, "replier@example.test");
      const threadId = yield* openThread(app, author, draft.title);
      const replied = yield* send(app, "/board/posts", {
        body: { body: "よろしくお願いします。", threadId },
        cookie: replier,
      });
      assert.strictEqual(replied.status, httpStatus.ok);
      const list = yield* decodeList(
        yield* jsonOf(yield* send(app, "/board/threads", { cookie: replier })),
      );
      assert.strictEqual(list.total, 1);
      assert.deepStrictEqual(
        list.threads.map((thread) => [
          thread.id,
          thread.title,
          thread.postCount,
          thread.author?.name,
        ]),
        [[threadId, draft.title, 2, "author"]],
      );
      const thread = yield* decodeThread(
        yield* jsonOf(yield* send(app, `/board/thread?id=${threadId}`, { cookie: author })),
      );
      assert.deepStrictEqual(
        thread.posts.map((post) => [post.author?.name, post.body]),
        [
          ["author", draft.body],
          ["replier", "よろしくお願いします。"],
        ],
      );
    }),
  );

  it.effect("rejects empty and oversized input and unknown threads", () =>
    Effect.gen(function* program() {
      yield* migrated;
      const app = boardApp();
      const cookie = yield* signedInMember(app, "author@example.test");
      const threadId = yield* openThread(app, cookie, draft.title);
      const emptyPost = yield* send(app, "/board/posts", {
        body: { body: "   ", threadId },
        cookie,
      });
      const emptyTitle = yield* send(app, "/board/threads", {
        body: { body: draft.body, title: "" },
        cookie,
      });
      const longTitle = yield* send(app, "/board/threads", {
        body: { body: draft.body, title: "あ".repeat(101) },
        cookie,
      });
      const missing = yield* send(app, "/board/posts", {
        body: { body: draft.body, threadId: "missing" },
        cookie,
      });
      const missingRead = yield* send(app, "/board/thread?id=missing", { cookie });
      assert.deepStrictEqual(
        [emptyPost.status, emptyTitle.status, longTitle.status, missing.status, missingRead.status],
        [
          httpStatus.badRequest,
          httpStatus.badRequest,
          httpStatus.badRequest,
          httpStatus.notFound,
          httpStatus.notFound,
        ],
      );
      const thread = yield* decodeThread(
        yield* jsonOf(yield* send(app, `/board/thread?id=${threadId}`, { cookie })),
      );
      assert.strictEqual(thread.total, 1);
    }),
  );

  it.effect("pages threads and refuses pages it does not serve", () =>
    Effect.gen(function* program() {
      yield* migrated;
      const app = boardApp();
      const cookie = yield* signedInMember(app, "author@example.test");
      yield* Effect.forEach(["1", "2", "3"], (title) => openThread(app, cookie, title));
      const firstPage = yield* decodeList(
        yield* jsonOf(yield* send(app, "/board/threads?page=1", { cookie })),
      );
      assert.strictEqual(firstPage.total, 3);
      assert.strictEqual(firstPage.threads.length, 3);
      const beyond = yield* decodeList(
        yield* jsonOf(yield* send(app, "/board/threads?page=2", { cookie })),
      );
      assert.deepStrictEqual(beyond.threads, []);
      const statuses = yield* Effect.all([
        send(app, "/board/threads?page=0", { cookie }),
        send(app, "/board/threads?page=1000001", { cookie }),
        send(app, "/board/threads?page=abc", { cookie }),
      ]).pipe(Effect.map((responses) => responses.map((response) => response.status)));
      assert.deepStrictEqual(statuses, [
        httpStatus.badRequest,
        httpStatus.badRequest,
        httpStatus.badRequest,
      ]);
    }),
  );
});
