import { Effect } from "effect";

const mayCreateGroup = Effect.fn("mayCreateGroup")(function* mayCreateGroup(_memberId: string) {
  return true;
});

export { mayCreateGroup };
