import { Schema } from "effect";

const MemberFlags = Schema.Struct({
  memberBoard: Schema.Boolean,
});

export { MemberFlags };
