import { Effect, Option, Schema } from "effect";
import { HttpBody, HttpClient } from "effect/unstable/http";

import { browserHttp } from "./browser-http.ts";

const verificationEndpoint = "/api/verify-email";

const postVerification = (token: string): Effect.Effect<boolean> =>
  Effect.gen(function* postVerificationToken() {
    const requestPayload = yield* HttpBody.json({ token }).pipe(Effect.orDie);
    const served = yield* HttpClient.post(verificationEndpoint, { body: requestPayload }).pipe(
      Effect.provide(browserHttp),
      Effect.option,
    );
    return Option.isSome(served) && served.value.status >= 200 && served.value.status < 300;
  }).pipe(Effect.orDie);

class VerificationRejected extends Schema.TaggedError<VerificationRejected>()(
  "VerificationRejected",
  { message: Schema.String },
) {}

const clearToken = Effect.sync(() => {
  globalThis.history.replaceState(undefined, "", globalThis.location.pathname);
});

const verifyEmailToken = (invalidLink: string): Effect.Effect<void, VerificationRejected> =>
  Effect.gen(function* confirmVerification() {
    const token = new URLSearchParams(globalThis.location.hash.slice(1)).get("token");
    const accepted = token === null || token === "" ? false : yield* postVerification(token);
    yield* clearToken;
    if (!accepted) {
      return yield* new VerificationRejected({ message: invalidLink });
    }
  });

export { verifyEmailToken };
