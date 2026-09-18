import type { BlockedByChange, TrackedIssue } from "./task-graph.ts";
import { Console, Effect, Schema } from "effect";
import { blockedByChanges, issueViolations, taskGraphViolations } from "./task-graph.ts";
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

const Blocker = Schema.Struct({ number: Schema.Int });
const Blockers = Schema.Struct({ nodes: Schema.Array(Blocker), totalCount: Schema.Int });
const Issue = Schema.Struct({
  blockedBy: Blockers,
  number: Schema.Int,
  state: Schema.Literals(["OPEN", "CLOSED"]),
});
const Issues = Schema.fromJsonString(Schema.Array(Issue));

function gh(args: readonly string[]): Effect.Effect<string, unknown> {
  return Effect.tryPromise(async () => run("gh", [...args], { maxBuffer: MAX_OUTPUT_BYTES })).pipe(
    Effect.map(({ stdout }) => stdout),
  );
}

function blockedBy({
  blockedBy: listed,
  number,
}: typeof Issue.Type): Effect.Effect<readonly number[], unknown> {
  if (listed.nodes.length === listed.totalCount) {
    return Effect.succeed(listed.nodes.map((node) => node.number));
  }
  return gh([
    "api",
    "--paginate",
    `repos/{owner}/{repo}/issues/${number}/dependencies/blocked_by`,
    "--jq",
    ".[].number",
  ]).pipe(Effect.map((numbers) => numbers.split("\n").filter(Boolean).map(Number)));
}

function tracked(
  issue: typeof Issue.Type,
): Effect.Effect<readonly [number, TrackedIssue], unknown> {
  return blockedBy(issue).pipe(
    Effect.map((blockers) => [
      issue.number,
      { blockedBy: blockers, closed: issue.state === "CLOSED" },
    ]),
  );
}

const registeredIssues = Effect.fn("registeredIssues")(function* registeredIssues() {
  const registered = new Set(Object.values(tasks).map((task) => task.issue));
  const listed = yield* gh([
    "issue",
    "list",
    "--state",
    "all",
    "--limit",
    MAX_ISSUES,
    "--json",
    "number,state,blockedBy",
  ]);
  const decoded = yield* Schema.decodeUnknownEffect(Issues)(listed);
  const entries = yield* Effect.forEach(
    decoded.filter((issue) => registered.has(issue.number)),
    tracked,
  );
  return new Map(entries);
});

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
  const issues = yield* registeredIssues();
  const violations = [...taskGraphViolations(tasks), ...issueViolations(tasks, issues)];
  if (violations.length > 0) {
    return { changes: [], violations };
  }
  const changes = blockedByChanges(tasks, issues);
  yield* Effect.forEach(changes, apply);
  return { changes, violations };
});

function fail(): Effect.Effect<void> {
  return Effect.sync(() => {
    process.exitCode = FAILED_EXIT_CODE;
  });
}

NodeRuntime.runMain(
  sync().pipe(
    Effect.flatMap(({ changes, violations }) =>
      Console.log(
        JSON.stringify({
          changes,
          event: "quality.tasks_sync",
          ok: violations.length === 0,
          violations,
        }),
      ).pipe(Effect.andThen(violations.length > 0 ? fail() : Effect.void)),
    ),
    Effect.catchCause(() =>
      Console.error(JSON.stringify({ event: "quality.tasks_sync_failed", ok: false })).pipe(
        Effect.andThen(fail()),
      ),
    ),
  ),
  { disableErrorReporting: true },
);
