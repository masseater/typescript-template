import { Schema } from "effect";
class InputInvalid extends Schema.TaggedError<InputInvalid>()("InputInvalid", {}) {}
export { InputInvalid };
