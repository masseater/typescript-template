import { Schema } from "effect";

class ApiKeyWriteForbidden extends Schema.TaggedError<ApiKeyWriteForbidden>()(
  "ApiKeyWriteForbidden",
  {},
) {}

export { ApiKeyWriteForbidden };
