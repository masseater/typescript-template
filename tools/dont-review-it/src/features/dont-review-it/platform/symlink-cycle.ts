import { Schema } from "effect";

export class SymlinkCycle extends Schema.TaggedError<SymlinkCycle>()("SymlinkCycle", {
  path: Schema.String,
  target: Schema.String,
}) {
  override get message(): string {
    return `${this.path} leads back into ${this.target}, which already encloses it, so following it would never end.`;
  }
}
