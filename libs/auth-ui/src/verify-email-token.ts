import { Effect, Option, Ref } from "effect";
import { HttpBody, HttpClient } from "effect/unstable/http";

import { browserHttp } from "./browser-http.ts";

const verificationEndpoint = "/api/verify-email";

const pendingVerification = Ref.makeUnsafe<
  { readonly result: Promise<boolean>; readonly token: string } | undefined
>(undefined);

const postVerification = (token: string): Effect.Effect<boolean> =>
  Effect.gen(function* postVerificationToken() {
    const requestPayload = yield* HttpBody.json({ token }).pipe(Effect.orDie);
    const served = yield* HttpClient.post(verificationEndpoint, { body: requestPayload }).pipe(
      Effect.provide(browserHttp),
      Effect.option,
    );
    return Option.isSome(served) && served.value.status >= 200 && served.value.status < 300;
  }).pipe(Effect.orDie);

const verifyEmailToken = (): Promise<boolean> => {
  const token = new URLSearchParams(globalThis.location.hash.slice(1)).get("token");
  if (token === null || token === "") {
    Effect.runSync(Ref.set(pendingVerification, undefined));
    return Promise.resolve(false);
  }
  const cached = Effect.runSync(Ref.get(pendingVerification));
  if (cached?.token === token) {
    return cached.result;
  }
  const accepted = Effect.runPromise(postVerification(token));
  Effect.runSync(Ref.set(pendingVerification, { result: accepted, token }));
  return accepted;
};

export { verifyEmailToken };
