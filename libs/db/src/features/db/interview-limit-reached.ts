import { Schema } from "effect";

class InterviewLimitReached extends Schema.TaggedError<InterviewLimitReached>()(
  "InterviewLimitReached",
  {},
) {}

export { InterviewLimitReached };
