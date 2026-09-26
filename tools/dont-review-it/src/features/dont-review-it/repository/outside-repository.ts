import { Schema } from "effect";

export class OutsideRepository extends Schema.TaggedError<OutsideRepository>()(
  "OutsideRepository",
  {
    cwd: Schema.String,
  },
) {
  public override get message(): string {
    return `workspace check:imports must run inside the repository (cwd=${this.cwd})`;
  }
}
