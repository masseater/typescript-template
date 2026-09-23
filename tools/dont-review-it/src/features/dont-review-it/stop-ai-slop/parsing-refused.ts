import { Schema } from "effect";

export class ParsingRefused extends Schema.TaggedError<ParsingRefused>()("ParsingRefused", {
  message: Schema.String,
  cause: Schema.Defect(),
}) {}

export const parsingRefused = (cause: unknown): ParsingRefused =>
  new ParsingRefused({ message: cause instanceof Error ? cause.message : String(cause), cause });
