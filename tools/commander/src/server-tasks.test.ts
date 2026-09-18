import { NodeServices } from "@effect/platform-node";
import { assert, it } from "@effect/vitest";
import { Effect, FileSystem, Option, Schema, Stream } from "effect";
import type { Scope } from "effect";

import { bd } from "./bd.ts";
import { AppState } from "./contract.ts";
import { makeApp } from "./server.ts";
import { createLedger } from "./tasks.ts";

const origin = "http://127.0.0.1:3090";
const timeout = 120_000;
const ok = 200;
const badRequest = 400;
const notFound = 404;
const dataPrefix = "data: ";

const Comments = Schema.Array(Schema.Struct({ author: Schema.String, text: Schema.String }));
const Created = Schema.Struct({ id: Schema.String });
const decodeState = Schema.decodeUnknownEffect(Schema.fromJsonString(AppState));

interface Served {
  readonly directory: string;
  readonly fetch: (request: Request) => Promise<Response>;
}

function serve(): Effect.Effect<Served, unknown, NodeServices.NodeServices | Scope.Scope> {
  return Effect.gen(function* served() {
    const files = yield* FileSystem.FileSystem;
    const temporary = yield* files.makeTempDirectoryScoped({ prefix: "commander-tasks-" });
    const directory = yield* files.realPath(temporary);
    const app = yield* makeApp({
      directory,
      executable: `${directory}/no-claude`,
      model: undefined,
      origin,
      stateDirectory: `${directory}/.state`,
    });
    return { directory, fetch: async (request: Request) => app.fetch(request) };
  });
}

function post(served: Served, path: string, body: unknown): Effect.Effect<number> {
  const request = new Request(`${origin}${path}`, {
    body: JSON.stringify(body),
    headers: { "content-type": "application/json", origin },
    method: "POST",
  });
  return Effect.promise(async () => served.fetch(request)).pipe(
    Effect.map((response) => response.status),
  );
}

function state(served: Served): Effect.Effect<typeof AppState.Type, unknown> {
  const opened = Effect.promise(async () => served.fetch(new Request(`${origin}/api/events`)));
  const body = opened.pipe(
    Effect.map((response) =>
      Stream.fromReadableStream({
        evaluate: () => response.body ?? new ReadableStream<Uint8Array>(),
        onError: (cause) => cause,
      }),
    ),
  );
  const first = Stream.unwrap(body).pipe(
    Stream.decodeText,
    Stream.splitLines,
    Stream.filter((line) => line.startsWith(dataPrefix)),
    Stream.runHead,
  );
  return first.pipe(
    Effect.map((line) => Option.getOrElse(line, () => "").slice(dataPrefix.length)),
    Effect.flatMap((line) => decodeState(line)),
  );
}

it.effect(
  "a comment posted to a task is stored as the user's and shows up in its thread",
  () =>
    Effect.gen(function* program() {
      const served = yield* serve();
      yield* createLedger(served.directory);
      const ledger = { actor: "commander", directory: served.directory };
      const { id } = yield* bd(ledger, ["create", "A"], Created);
      const statuses = [
        yield* post(served, `/api/tasks/${id}/comments`, { text: "進捗どう？" }),
        yield* post(served, "/api/tasks/nope-1/comments", { text: "進捗どう？" }),
        yield* post(served, `/api/tasks/${id}/comments`, { text: "" }),
      ];
      assert.deepStrictEqual(statuses, [ok, notFound, badRequest]);
      assert.deepStrictEqual(yield* bd(ledger, ["comments", id], Comments), [
        { author: "user", text: "進捗どう？" },
      ]);
      const { tasks } = yield* state(served);
      assert.deepStrictEqual(
        tasks?.ready.map((task) => task.thread.map(({ author, text }) => ({ author, text }))),
        [[{ author: "user", text: "進捗どう？" }]],
      );
    }).pipe(Effect.scoped, Effect.provide(NodeServices.layer)),
  timeout,
);

it.effect(
  "a project without a ledger says so, and creating one turns it into an empty task list",
  () =>
    Effect.gen(function* program() {
      const served = yield* serve();
      assert.deepStrictEqual(yield* state(served), {
        chat: { busy: false, entries: [] },
        ledger: { directory: served.directory, status: "missing" },
      });
      assert.strictEqual(yield* post(served, "/api/ledger", {}), ok);
      assert.deepStrictEqual(yield* state(served), {
        chat: { busy: false, entries: [] },
        ledger: { directory: served.directory, status: "ready" },
        tasks: { done: [], needsHuman: [], ready: [], running: [], waiting: [] },
      });
    }).pipe(Effect.scoped, Effect.provide(NodeServices.layer)),
  timeout,
);
