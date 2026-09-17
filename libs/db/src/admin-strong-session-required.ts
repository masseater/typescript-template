import { Schema } from "effect";

class AdminStrongSessionRequired extends Schema.TaggedError<AdminStrongSessionRequired>()(
  "AdminStrongSessionRequired",
  {},
) {}

export { AdminStrongSessionRequired };
