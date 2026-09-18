import { NodeServices } from "@effect/platform-node";
import { assert, it } from "@effect/vitest";
import { Effect, FileSystem, Schema } from "effect";

import { bd } from "./bd.ts";
import type { Task } from "./contract.ts";
import { addComment, createLedger, locate, snapshot } from "./tasks.ts";

const Created = Schema.Struct({ id: Schema.String });
const Comments = Schema.Array(Schema.Struct({ created_at: Schema.String, id: Schema.String }));
const timeout = 120_000;
const defaultPriority = 2;
const noThreads = new Map();

const project = Effect.gen(function* project() {
  const files = yield* FileSystem.FileSystem;
  const directory = yield* files.makeTempDirectoryScoped({ prefix: "commander-ledger-" });
  yield* createLedger(directory);
  return directory;
});

function create(
  directory: string,
  title: string,
): Effect.Effect<string, unknown, NodeServices.NodeServices> {
  return bd({ actor: "commander", directory }, ["create", title], Created).pipe(
    Effect.map(({ id }) => id),
  );
}

function task(id: string, title: string): typeof Task.Type {
  return {
    acceptance: "",
    blockedBy: [],
    description: "",
    id,
    labels: [],
    priority: defaultPriority,
    thread: [],
    title,
  };
}

it.effect(
  "inserting a dependency pauses the claimed task, runs the new one first, and resumes on close",
  () =>
    Effect.gen(function* program() {
      const directory = yield* project;
      const first = yield* create(directory, "A");
      yield* bd({ actor: "w-1", directory }, ["update", first, "--claim"], Schema.Unknown);
      const inserted = yield* create(directory, "B");
      yield* bd({ actor: "commander", directory }, ["dep", "add", first, inserted], Schema.Unknown);

      const paused = yield* snapshot(directory, noThreads);
      assert.deepStrictEqual(paused.tasks, {
        done: [],
        needsHuman: [],
        ready: [task(inserted, "B")],
        running: [],
        waiting: [{ ...task(first, "A"), assignee: "w-1", blockedBy: [inserted] }],
      });

      yield* bd(
        { actor: "commander", directory },
        ["close", inserted, "--reason", "終わった"],
        Schema.Unknown,
      );
      const resumed = yield* snapshot(directory, noThreads);
      assert.deepStrictEqual(resumed.tasks, {
        done: [{ ...task(inserted, "B"), closeReason: "終わった" }],
        needsHuman: [],
        ready: [],
        running: [{ ...task(first, "A"), assignee: "w-1" }],
        waiting: [],
      });
    }).pipe(Effect.provide(NodeServices.layer)),
  timeout,
);

it.effect(
  "a released task returns to ready and a task waiting on the human is listed apart",
  () =>
    Effect.gen(function* program() {
      const directory = yield* project;
      const worker = { actor: "w-1", directory };
      const released = yield* create(directory, "A");
      yield* bd(worker, ["update", released, "--claim"], Schema.Unknown);
      yield* bd(worker, ["unclaim", released, "--reason", "中断"], Schema.Unknown);
      const undecided = yield* create(directory, "B");
      yield* bd(worker, ["update", undecided, "--add-label", "needs-human"], Schema.Unknown);

      const { tasks } = yield* snapshot(directory, noThreads);
      assert.deepStrictEqual(
        {
          needsHuman: tasks.needsHuman.map(({ id }) => id),
          ready: tasks.ready.map(({ id }) => id),
        },
        { needsHuman: [undecided], ready: [released] },
      );
      assert.deepStrictEqual(tasks.needsHuman, [
        { ...task(undecided, "B"), labels: ["needs-human"] },
      ]);
    }).pipe(Effect.provide(NodeServices.layer)),
  timeout,
);

it.effect(
  "a comment from the user and the worker's reply both appear in the task thread in order",
  () =>
    Effect.gen(function* program() {
      const directory = yield* project;
      const id = yield* create(directory, "A");
      yield* addComment(directory, id, "進捗どう？");
      const asked = yield* snapshot(directory, noThreads);
      yield* bd(
        { actor: "w-1", directory },
        ["comments", "add", id, "半分終わった"],
        Schema.Unknown,
      );
      const answered = yield* snapshot(directory, asked.threads);
      const stored = yield* bd({ actor: "user", directory }, ["comments", id], Comments);
      const [question, answer] = stored.toSorted((left, right) =>
        left.created_at.localeCompare(right.created_at),
      );

      assert.deepStrictEqual(asked.tasks.ready, [
        {
          ...task(id, "A"),
          thread: [
            {
              author: "user",
              createdAt: question?.created_at ?? "",
              id: question?.id ?? "",
              text: "進捗どう？",
            },
          ],
        },
      ]);
      assert.deepStrictEqual(answered.tasks.ready[0]?.thread, [
        {
          author: "user",
          createdAt: question?.created_at ?? "",
          id: question?.id ?? "",
          text: "進捗どう？",
        },
        {
          author: "w-1",
          createdAt: answer?.created_at ?? "",
          id: answer?.id ?? "",
          text: "半分終わった",
        },
      ]);
    }).pipe(Effect.provide(NodeServices.layer)),
  timeout,
);

it.effect(
  "commenting on a task that does not exist is rejected",
  () =>
    Effect.gen(function* program() {
      const directory = yield* project;
      const failure = yield* addComment(directory, "nope-1", "x").pipe(Effect.flip);
      assert.strictEqual(failure.reason, "rejected");
    }).pipe(Effect.provide(NodeServices.layer)),
  timeout,
);

it.effect(
  "a directory without a ledger is reported as missing until one is created",
  () =>
    Effect.gen(function* program() {
      const files = yield* FileSystem.FileSystem;
      const directory = yield* files.makeTempDirectoryScoped({ prefix: "commander-empty-" });
      assert.deepStrictEqual(yield* locate(directory), { directory, status: "missing" });
      yield* createLedger(directory);
      assert.deepStrictEqual(yield* locate(directory), { directory, status: "ready" });
      assert.deepStrictEqual((yield* snapshot(directory, noThreads)).tasks, {
        done: [],
        needsHuman: [],
        ready: [],
        running: [],
        waiting: [],
      });
    }).pipe(Effect.provide(NodeServices.layer)),
  timeout,
);
