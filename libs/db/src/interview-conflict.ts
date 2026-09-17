import { Schema } from "effect";

class InterviewConflict extends Schema.TaggedError<InterviewConflict>()("InterviewConflict", {}) {}

export { InterviewConflict };
