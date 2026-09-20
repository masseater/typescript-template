import { Schema } from "effect";

class TurnRejected extends Schema.TaggedError<TurnRejected>()("TurnRejected", {}) {}

export { TurnRejected };
