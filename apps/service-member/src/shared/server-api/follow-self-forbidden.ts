import { Schema } from "effect";

class FollowSelfForbidden extends Schema.TaggedError<FollowSelfForbidden>()(
  "FollowSelfForbidden",
  {},
) {}

export { FollowSelfForbidden };
