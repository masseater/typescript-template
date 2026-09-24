import { Effect } from "effect";

const mayCreateGroup = Effect.fn("mayCreateGroup")(function* mayCreateGroup(_memberId: string) {
  return yield* Effect.succeed(true);
});

export { mayCreateGroup };
