import { Schema } from "effect";

export class DanglingSymlink extends Schema.TaggedError<DanglingSymlink>()("DanglingSymlink", {
  path: Schema.String,
}) {
  override get message(): string {
    return `${this.path} is a symbolic link to nothing, so what it was meant to hold cannot be read.`;
  }
}
