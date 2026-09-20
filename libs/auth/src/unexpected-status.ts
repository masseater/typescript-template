import { Schema } from "effect";

export class UnexpectedStatus extends Schema.TaggedError<UnexpectedStatus>()("UnexpectedStatus", {
  endpoint: Schema.String,
  status: Schema.Number,
}) {}
