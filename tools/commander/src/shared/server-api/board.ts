import { Effect, Ref, Semaphore } from "effect";

import { addComment, createLedger, locate, snapshot } from "./tasks.ts";

import type { LedgerState, Snapshot } from "#shared/contract/index.ts";
import type { Scope } from "effect";
import type { ChildProcessSpawner } from "effect/unstable/process";
import type { BdFailure } from "./bd.ts";
import type { Threads } from "./tasks.ts";

type Spawner = ChildProcessSpawner.ChildProcessSpawner;
type Ledger = typeof LedgerState.Type;
type Tasks = typeof Snapshot.Type;

type BoardEvent =
  | { readonly data: Ledger; readonly event: "ledger" }
  | { readonly data: Tasks; readonly event: "tasks" };

interface BoardState {
  readonly ledger: Ledger;
  readonly tasks: Tasks | undefined;
  readonly threads: Threads;
}

interface Parts {
  readonly directory: string;
  readonly lifetime: Scope.Scope;
  readonly publish: (event: BoardEvent) => Effect.Effect<void>;
  readonly state: Ref.Ref<BoardState>;
  readonly turn: Semaphore.Semaphore;
  readonly viewers: Ref.Ref<number>;
}

const pollInterval = "5 seconds";
const unwatchedInterval = "30 seconds";

class Board {
  private readonly parts: Parts;

  public constructor(parts: Parts) {
    this.parts = parts;
  }

  public get state(): Effect.Effect<BoardState> {
    return Ref.get(this.parts.state);
  }

  public get refresh(): Effect.Effect<void, never, Spawner> {
    const guarded = this.read().pipe(
      Effect.catchTag("BdFailure", (failure) =>
        this.setLedger(failure.reason === "ledger_missing" ? "missing" : "unreadable"),
      ),
    );
    return Semaphore.withPermit(this.parts.turn)(guarded);
  }

  public get create(): Effect.Effect<void, BdFailure, Spawner> {
    const { directory } = this.parts;
    return locate(directory).pipe(
      Effect.flatMap(({ status }) =>
        status === "missing" ? createLedger(directory) : Effect.void,
      ),
      Effect.andThen(this.refresh),
    );
  }

  public get poll(): Effect.Effect<void, never, Spawner> {
    const watched = Ref.get(this.parts.viewers).pipe(
      Effect.flatMap((count) => Effect.sleep(count > 0 ? pollInterval : unwatchedInterval)),
    );
    return this.refresh.pipe(Effect.andThen(watched));
  }

  public get viewing(): Effect.Effect<void, never, Scope.Scope | Spawner> {
    const { lifetime, viewers } = this.parts;
    const arrive = Ref.update(viewers, (count) => count + 1).pipe(
      Effect.andThen(Effect.forkIn(this.refresh, lifetime)),
    );
    return Effect.acquireRelease(arrive, () => Ref.update(viewers, (count) => count - 1));
  }

  public comment(id: string, text: string): Effect.Effect<void, BdFailure, Spawner> {
    return addComment(this.parts.directory, id, text).pipe(Effect.andThen(this.refresh));
  }

  private setLedger(status: Ledger["status"]): Effect.Effect<void> {
    const { directory, publish, state } = this.parts;
    return Effect.gen(function* changed() {
      const before = yield* Ref.get(state);
      if (before.ledger.status !== status) {
        const ledger = { directory, status };
        yield* Ref.set(state, { ...before, ledger });
        yield* publish({ data: ledger, event: "ledger" });
      }
    });
  }

  private read(): Effect.Effect<void, BdFailure, Spawner> {
    const { directory, publish, state } = this.parts;
    const ready = this.setLedger("ready");
    return Effect.gen(function* readLedger() {
      const before = yield* Ref.get(state);
      const located = before.ledger.status === "missing" ? yield* locate(directory) : undefined;
      if (located?.status === "missing") {
        return;
      }
      const { tasks, threads } = yield* snapshot(directory, before.threads);
      yield* Ref.update(state, (current) => ({ ...current, tasks, threads }));
      yield* ready;
      if (JSON.stringify(tasks) !== JSON.stringify(before.tasks)) {
        yield* publish({ data: tasks, event: "tasks" });
      }
    });
  }
}

const makeBoard = Effect.fn("makeBoard")(function* makeBoard(
  directory: string,
  publish: Parts["publish"],
) {
  const initial: BoardState = {
    ledger: yield* locate(directory),
    tasks: undefined,
    threads: new Map(),
  };
  const board = new Board({
    directory,
    lifetime: yield* Effect.scope,
    publish,
    state: yield* Ref.make(initial),
    turn: yield* Semaphore.make(1),
    viewers: yield* Ref.make(0),
  });
  yield* Effect.forkScoped(Effect.forever(board.poll));
  return board;
});

export { makeBoard };
