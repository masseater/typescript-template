import { Schema } from "effect";

class AuthFailure extends Schema.TaggedError<AuthFailure>()("AuthFailure", {
  cause: Schema.Defect(),
}) {}

export { AuthFailure };
