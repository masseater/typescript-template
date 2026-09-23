import { Schema } from "effect";

class ErDiagramUnreadable extends Schema.TaggedError<ErDiagramUnreadable>()("ErDiagramUnreadable", {
  reason: Schema.String,
}) {}

export { ErDiagramUnreadable };
