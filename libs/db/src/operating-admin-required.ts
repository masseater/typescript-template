import { Schema } from "effect";

class OperatingAdminRequired extends Schema.TaggedError<OperatingAdminRequired>()(
  "OperatingAdminRequired",
  {},
) {}

export { OperatingAdminRequired };
