import { Schema } from "effect";

export class FlagEditorRequired extends Schema.TaggedError<FlagEditorRequired>()(
  "FlagEditorRequired",
  {},
) {}
