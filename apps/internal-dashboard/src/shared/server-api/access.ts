import { verifySession } from "@repo/auth";
import { Effect, Option } from "effect";

import { denied, sessionPresence } from "./access-decision.ts";
import { isPublic } from "./access-public.ts";

type SessionEffect = ReturnType<typeof verifySession>;
type SessionServices = Effect.Services<SessionEffect>;
type SessionUnavailable = Exclude<
  Effect.Error<SessionEffect>,
  { readonly _tag: "AdminMfaRequired" | "AdminRequired" | "SessionInvalid" | "SessionRequired" }
>;

function currentSession(
  request: Request,
): Effect.Effect<Option.Option<{ readonly strong: boolean }>, SessionUnavailable, SessionServices> {
  return verifySession(request.headers, true).pipe(
    Effect.map((session) => sessionPresence(session)),
    Effect.catchTags({
      AdminMfaRequired: (error) => Effect.succeed(sessionPresence(error)),
      AdminRequired: (error) => Effect.succeed(sessionPresence(error)),
      SessionInvalid: (error) => Effect.succeed(sessionPresence(error)),
      SessionRequired: (error) => Effect.succeed(sessionPresence(error)),
    }),
  );
}

const guardAccess = Effect.fn("guardAccess")(function* guardAccess(request: Request, path: string) {
  if (isPublic(path) || (path.startsWith("/_serverFn/") && request.method === "GET")) {
    return Option.none<Response>();
  }
  const current = yield* currentSession(request);
  const allowed = Option.isSome(current) && (current.value.strong || path === "/security");
  return allowed ? Option.none<Response>() : Option.some(denied(path, Option.isSome(current)));
});

export { guardAccess };
export { isPublic } from "./access-public.ts";
