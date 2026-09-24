import { verifySession } from "@repo/auth";
import { Effect, Option } from "effect";

import { decideAccess, sessionPresence } from "./access-decision.ts";

type SessionEffect = ReturnType<typeof verifySession>;
type SessionServices = Effect.Services<SessionEffect>;
type SessionUnavailable = Exclude<
  Effect.Error<SessionEffect>,
  { readonly _tag: "AdminMfaRequired" | "AdminRequired" | "SessionInvalid" | "SessionRequired" }
>;

const publicPaths: ReadonlySet<string> = new Set([
  "/login",
  "/consent",
  "/mcp",
  "/api/telemetry",
  "/api/health",
  "/api/session",
  "/api/invite",
]);

function isPublic(path: string): boolean {
  return (
    publicPaths.has(path) ||
    path.startsWith("/api/auth/") ||
    path.startsWith("/invite/") ||
    path.startsWith("/.well-known/oauth-")
  );
}

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
  if (isPublic(path)) {
    return Option.none<Response>();
  }
  return decideAccess(path, yield* currentSession(request));
});

export { guardAccess };
