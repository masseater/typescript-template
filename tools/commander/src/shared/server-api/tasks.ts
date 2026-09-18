// oxlint-disable-next-line import/no-nodejs-modules
import path from "node:path";

import { Effect, Schema } from "effect";
import type { ChildProcessSpawner } from "effect/unstable/process";

import type { LedgerState, Snapshot, Task } from "#shared/contract/index.ts";

import type { BdFailure, Ledger } from "./bd.ts";
import { bd, bdQuiet } from "./bd.ts";

type Spawner = ChildProcessSpawner.ChildProcessSpawner;
type TaskView = typeof Task.Type;
type Thread = TaskView["thread"];

interface CachedThread {
  readonly count: number;
  readonly thread: Thread;
}
type Threads = ReadonlyMap<string, CachedThread>;

const Issue = Schema.Struct({
  acceptance_criteria: Schema.optional(Schema.String),
  assignee: Schema.optional(Schema.String),
  blocked_by: Schema.optional(Schema.Array(Schema.String)),
  close_reason: Schema.optional(Schema.String),
  closed_at: Schema.optional(Schema.String),
  comment_count: Schema.optional(Schema.Number),
  description: Schema.optional(Schema.String),
  id: Schema.String,
  labels: Schema.optional(Schema.Array(Schema.String)),
  priority: Schema.Number,
  status: Schema.Literals(["open", "in_progress", "blocked", "deferred", "closed"]),
  title: Schema.String,
});
const Issues = Schema.Array(Issue);
const BdComment = Schema.Struct({
  author: Schema.String,
  created_at: Schema.String,
  id: Schema.String,
  text: Schema.String,
});
const BdComments = Schema.Array(BdComment);
const Located = Schema.Struct({ path: Schema.String });

type BdIssue = typeof Issue.Type;

interface Listing {
  readonly blocked: readonly BdIssue[];
  readonly closed: readonly BdIssue[];
  readonly open: readonly BdIssue[];
  readonly ready: readonly BdIssue[];
  readonly threads: Threads;
}

const needsHuman = "needs-human";
const needsReview = "needs-review";
const recentlyDone = 10;
const prefixLength = 8;
const fallbackPrefix = "task";
const userActor = "user";

function byPriority(left: TaskView, right: TaskView): number {
  return left.priority - right.priority || left.id.localeCompare(right.id);
}

function byClosing(left: BdIssue, right: BdIssue): number {
  return (right.closed_at ?? "").localeCompare(left.closed_at ?? "");
}

function view(issue: BdIssue, listing: Listing): TaskView {
  const blockers = listing.blocked.find((blocked) => blocked.id === issue.id)?.blocked_by;
  return {
    acceptance: issue.acceptance_criteria ?? "",
    ...(issue.assignee === undefined || issue.assignee === "" ? {} : { assignee: issue.assignee }),
    blockedBy: blockers ?? [],
    ...(issue.close_reason === undefined ? {} : { closeReason: issue.close_reason }),
    description: issue.description ?? "",
    id: issue.id,
    labels: issue.labels ?? [],
    priority: issue.priority,
    thread: listing.threads.get(issue.id)?.thread ?? [],
    title: issue.title,
  };
}

function classify(listing: Listing): typeof Snapshot.Type {
  const readyIds = new Set(listing.ready.map((issue) => issue.id));
  const claimed = new Set(
    listing.open.flatMap((issue) => (issue.status === "in_progress" ? [issue.id] : [])),
  );
  const tasks = listing.open.map((issue) => view(issue, listing)).toSorted(byPriority);
  const decided = tasks.filter((task) => !task.labels.includes(needsHuman));
  const rest = decided.filter((task) => !task.labels.includes(needsReview));
  const flowing = rest.filter((task) => task.blockedBy.length === 0);
  return {
    done: listing.closed
      .toSorted(byClosing)
      .slice(0, recentlyDone)
      .map((issue) => view(issue, listing)),
    needsHuman: tasks.filter((task) => task.labels.includes(needsHuman)),
    ready: flowing.filter(
      (task) => readyIds.has(task.id) && !claimed.has(task.id) && task.assignee === undefined,
    ),
    review: decided.filter((task) => task.labels.includes(needsReview)),
    running: flowing.filter((task) => claimed.has(task.id)),
    waiting: rest.filter((task) => task.blockedBy.length > 0),
  };
}

function thread(
  ledger: Ledger,
  issue: BdIssue,
  cached: Threads,
): Effect.Effect<readonly [string, CachedThread], BdFailure, Spawner> {
  const count = issue.comment_count ?? 0;
  const known = cached.get(issue.id);
  if (known?.count === count) {
    return Effect.succeed([issue.id, known]);
  }
  if (count === 0) {
    return Effect.succeed([issue.id, { count, thread: [] }]);
  }
  return bd(ledger, ["comments", issue.id], BdComments).pipe(
    Effect.map((comments) => {
      const entries = comments.map((comment) => ({
        author: comment.author,
        createdAt: comment.created_at,
        id: comment.id,
        text: comment.text,
      }));
      const ordered = entries.toSorted((left, right) =>
        left.createdAt.localeCompare(right.createdAt),
      );
      return [issue.id, { count, thread: ordered }];
    }),
  );
}

const snapshot = Effect.fn("snapshot")(function* snapshot(directory: string, cached: Threads) {
  const ledger = { actor: userActor, directory };
  const unfinished = ["list", "--status", "open,in_progress,blocked,deferred", "--limit", "0"];
  const finished = ["list", "--status", "closed", "--sort", "closed", "--limit", `${recentlyDone}`];
  const open = yield* bd(ledger, unfinished, Issues);
  const blocked = yield* bd(ledger, ["blocked"], Issues);
  const ready = yield* bd(ledger, ["ready", "--limit", "0"], Issues);
  const closed = yield* bd(ledger, finished, Issues);
  const entries = yield* Effect.forEach([...open, ...closed], (issue) =>
    thread(ledger, issue, cached),
  );
  const threads: Threads = new Map(entries);
  return { tasks: classify({ blocked, closed, open, ready, threads }), threads };
});

function addComment(
  directory: string,
  id: string,
  text: string,
): Effect.Effect<void, BdFailure, Spawner> {
  const ledger = { actor: userActor, directory };
  return bd(ledger, ["comments", "add", "--", id, text], BdComment).pipe(Effect.asVoid);
}

function locate(directory: string): Effect.Effect<typeof LedgerState.Type, BdFailure, Spawner> {
  return bd({ actor: userActor, directory }, ["where"], Located).pipe(
    Effect.as({ directory, status: "ready" as const }),
    Effect.catchIf(
      (failure) => failure.reason === "ledger_missing",
      () => Effect.succeed({ directory, status: "missing" as const }),
    ),
  );
}

function createLedger(directory: string): Effect.Effect<void, BdFailure, Spawner> {
  const letters = path
    .basename(directory)
    .toLowerCase()
    .replaceAll(/[^a-z0-9]/gu, "");
  const prefix = letters === "" ? fallbackPrefix : letters.slice(0, prefixLength);
  const flags = ["--stealth", "--skip-agents", "--non-interactive"];
  return bdQuiet({ actor: userActor, directory }, ["init", ...flags, "-p", prefix]);
}

export { addComment, createLedger, locate, snapshot };
export type { Threads };
