import { Schema } from "effect";

export class EscapingSymlink extends Schema.TaggedError<EscapingSymlink>()("EscapingSymlink", {
  path: Schema.String,
  target: Schema.String,
  root: Schema.String,
}) {
  override get message(): string {
    return `${this.path} is a symbolic link to ${this.target}, outside ${this.root}, so what it holds is not part of the tree being read.`;
  }
}
