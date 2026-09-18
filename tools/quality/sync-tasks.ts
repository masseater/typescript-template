import { Console, Effect, Schema } from "effect";
import { blockedByChanges, taskGraphViolations } from "./task-graph.ts";
import type { BlockedByChange } from "./task-graph.ts";
import { NodeRuntime } from "@effect/platform-node";
// oxlint-disable-next-line import/no-nodejs-modules
import { execFile } from "node:child_process";
// oxlint-disable-next-line import/no-nodejs-modules
import { promisify } from "node:util";
import { tasks } from "./tasks.ts";

const MAX_OUTPUT_BYTES = 33_554_432;
const MAX_ISSUES = "1000";
const FAILED_EXIT_CODE = 1;

// oxlint-disable-next-line typescript/strict-void-return
const run = promisify(execFile);

class TaskGraphInvalid extends Schema.TaggedError<TaskGraphInvalid>()("TaskGraphInvalid", {
  violations: Schema.Array(Schema.String),
}) {}

const Blocker = Schema.Struct({ number: Schema.Int });
const Blockers = Schema.Struct({ nodes: Schema.Array(Blocker), totalCount: Schema.Int });
const Issue = Schema.Struct({ blockedBy: Blockers, number: Schema.Int });
const Issues = Schema.fromJsonString(Schema.Array(Issue));

function gh(args: readonly string[]): Effect.Effect<string, unknown> {
  return Effect.tryPromise(async () => run("gh", [...args], { maxBuffer: MAX_OUTPUT_BYTES })).pipe(
    Effect.map(({ stdout }) => stdout),
  );
}

function blockers({
  blockedBy,
  number,
}: typeof Issue.Type): Effect.Effect<readonly [number, readonly number[]], unknown> {
  if (blockedBy.nodes.length === blockedBy.totalCount) {
    return Effect.succeed([number, blockedBy.nodes.map((node) => node.number)]);
  }
  return gh([
    "api",
    "--paginate",
    `repos/{owner}/{repo}/issues/${number}/dependencies/blocked_by`,
    "--jq",
    ".[].number",
  ]).pipe(Effect.map((listed) => [number, listed.split("\n").filter(Boolean).map(Number)]));
}

function apply({ add, issue, remove }: BlockedByChange): Effect.Effect<string, unknown> {
  return gh([
    "issue",
    "edit",
    String(issue),
    ...add.flatMap((blocker) => ["--add-blocked-by", String(blocker)]),
    ...remove.flatMap((blocker) => ["--remove-blocked-by", String(blocker)]),
  ]);
}

const sync = Effect.fn("syncTasks")(function* syncTasks() {
  const violations = taskGraphViolations(tasks);
  if (violations.length > 0) {
    return yield* new TaskGraphInvalid({ violations });
  }
  const listed = yield* gh([
    "issue",
    "list",
    "--state",
    "all",
    "--limit",
    MAX_ISSUES,
    "--json",
    "number,blockedBy",
  ]);
  const issues = yield* Schema.decodeUnknownEffect(Issues)(listed);
  const current = yield* Effect.forEach(issues, blockers);
  const changes = blockedByChanges(tasks, new Map(current));
  yield* Effect.forEach(changes, apply);
  return changes;
});

NodeRuntime.runMain(
  sync().pipe(
    Effect.flatMap((changes) =>
      Console.log(JSON.stringify({ changes, event: "quality.tasks_sync", ok: true })),
    ),
    Effect.catchCause((cause) =>
      Console.error(
        JSON.stringify({ cause: String(cause), event: "quality.tasks_sync_failed", ok: false }),
      ).pipe(
        Effect.andThen(
          Effect.sync(() => {
            process.exitCode = FAILED_EXIT_CODE;
          }),
        ),
      ),
    ),
  ),
  { disableErrorReporting: true },
);
