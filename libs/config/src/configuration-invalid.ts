import { Schema } from "effect";

class ConfigurationInvalid extends Schema.TaggedError<ConfigurationInvalid>()(
  "ConfigurationInvalid",
  { reason: Schema.String },
) {}

export { ConfigurationInvalid };
