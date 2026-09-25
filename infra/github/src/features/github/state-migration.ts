import { Effect, Schema } from "effect";

import type { StateService } from "alchemy/State";
import type { StackTarget } from "./apply-target.ts";

class StateMigrationFailure extends Schema.TaggedError<StateMigrationFailure>()(
  "StateMigrationFailure",
  {
    code: Schema.Literals(["legacy_state_present", "state_target_occupied"]),
    keys: Schema.Array(Schema.String),
  },
) {}

const stackKey = (stack: StackTarget): string => `${stack.stack}/${stack.stage}`;

type StackMove = Readonly<{ from: StackTarget; to: StackTarget }>;

const copyResource = (
  store: StateService,
  move: StackMove & Readonly<{ fqn: string }>,
): Effect.Effect<void, Effect.Error<ReturnType<StateService["get"]>>> =>
  Effect.gen(function* copyResource() {
    const resource = yield* store.get({ ...move.from, fqn: move.fqn });
    if (resource !== undefined) {
      yield* store.set({ ...move.to, fqn: move.fqn, value: resource });
    }
  });

const copyStackOutput = Effect.fn("copyStackOutput")(function* copyStackOutput(
  store: StateService,
  move: StackMove,
) {
  const stackOutput: unknown = yield* store.getOutput(move.from);
  if (stackOutput !== undefined) {
    yield* store.setOutput({ ...move.to, value: stackOutput });
  }
});

const moveStackState = Effect.fn("moveStackState")(function* moveStackState(
  store: StateService,
  move: StackMove,
) {
  const moved = yield* store.list(move.from);
  if (moved.length === 0) {
    return moved;
  }
  const occupied = yield* store.list(move.to);
  if (occupied.length > 0) {
    return yield* new StateMigrationFailure({
      code: "state_target_occupied",
      keys: [stackKey(move.to)],
    });
  }
  yield* Effect.forEach(moved, (fqn) => copyResource(store, { ...move, fqn }));
  yield* copyStackOutput(store, move);
  yield* store.deleteStack(move.from);
  return moved;
});

const refuseLegacyState = Effect.fn("refuseLegacyState")(function* refuseLegacyState(
  store: StateService,
  legacy: StackTarget,
) {
  const left = yield* store.list(legacy);
  if (left.length > 0) {
    return yield* new StateMigrationFailure({
      code: "legacy_state_present",
      keys: [stackKey(legacy)],
    });
  }
});

export { StateMigrationFailure, moveStackState, refuseLegacyState };
