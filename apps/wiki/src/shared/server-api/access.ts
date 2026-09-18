import { Effect, Option } from "effect";
import { httpStatus } from "@template/observability";
import { jsonResponse } from "@template/runtime/http";
import { verifySession } from "@template/auth";

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
]);

function isPublic(path: string): boolean {
  return (
    publicPaths.has(path) || path.startsWith("/api/auth/") || path.startsWith("/.well-known/oauth-")
  );
}

function currentSession(
  request: Request,
): Effect.Effect<Option.Option<{ readonly strong: boolean }>, SessionUnavailable, SessionServices> {
  return verifySession(request.headers, true).pipe(
    Effect.map((session) => Option.some(session)),
    Effect.catchTags({
      AdminMfaRequired: () => Effect.succeed(Option.none()),
      AdminRequired: () => Effect.succeed(Option.none()),
      SessionInvalid: () => Effect.succeed(Option.none()),
      SessionRequired: () => Effect.succeed(Option.none()),
    }),
  );
}

function denied(path: string, signedIn: boolean): Response {
  if (path.startsWith("/api/") || path.startsWith("/_serverFn/")) {
    return jsonResponse({ error: "ログインしてください。" }, httpStatus.unauthorized);
  }
  return new Response(undefined, {
    headers: { "cache-control": "no-store", location: signedIn ? "/security" : "/login" },
    status: httpStatus.found,
  });
}

const guardAccess = Effect.fn("guardAccess")(function* guardAccess(request: Request, path: string) {
  if (isPublic(path)) {
    return Option.none<Response>();
  }
  const current = yield* currentSession(request);
  const allowed = Option.isSome(current) && (current.value.strong || path === "/security");
  return allowed ? Option.none<Response>() : Option.some(denied(path, Option.isSome(current)));
});

export { guardAccess };
