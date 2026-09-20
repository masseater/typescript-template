import { makeSignature } from "better-auth/crypto";
import { Effect } from "effect";

import { Auth } from "./auth.ts";
import { SessionRequired } from "./session-required.ts";

const signedSessionCookie = Effect.fn("signedSessionCookie")(function* signedSessionCookie(
  token: string,
) {
  const { instance } = yield* Auth;
  const cookiePrefix = instance.options.advanced?.cookiePrefix;
  const secret = instance.options.secret;
  if (typeof cookiePrefix !== "string" || typeof secret !== "string") {
    return yield* new SessionRequired();
  }
  const signature = yield* Effect.promise(async () => makeSignature(token, secret));
  return `${cookiePrefix}.session_token=${encodeURIComponent(`${token}.${signature}`)}`;
});

export { signedSessionCookie };
