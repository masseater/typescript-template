import { Schema } from "effect";

class LastEditorRequired extends Schema.TaggedError<LastEditorRequired>()(
  "LastEditorRequired",
  {},
) {}

export { LastEditorRequired };
