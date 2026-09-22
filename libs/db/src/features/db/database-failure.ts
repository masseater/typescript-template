import { Schema } from "effect";

class DatabaseFailure extends Schema.TaggedError<DatabaseFailure>()("DatabaseFailure", {
  cause: Schema.Defect(),
}) {}

export { DatabaseFailure };
