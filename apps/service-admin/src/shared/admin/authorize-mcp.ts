import {
  adminScopes,
  insufficientScopeError,
  mcpAuthorizer,
  mcpJsonRpcError,
  mcpUnauthorized,
} from "@repo/auth";
import { httpStatus } from "@repo/config";
import { Effect, Option } from "effect";

type AdminMcpActor = Readonly<{ sessionId: string; userId: string }>;

const requiredScopes = ["admin:read"];

const authorizeMcpRequest = mcpAuthorizer({
  actorOf: (subject) => {
    const { sid, sub } = subject;
    return Effect.succeed(
      typeof sub === "string" && typeof sid === "string"
        ? ({ sessionId: sid, userId: sub } satisfies AdminMcpActor)
        : mcpJsonRpcError({ message: "ADMIN_SESSION_REQUIRED", status: httpStatus.forbidden }),
    );
  },
  challengeScopes: requiredScopes,
  scopeError: (granted) => {
    if (!adminScopes.some((registered) => granted.has(registered))) {
      return Option.some(mcpUnauthorized("ACCESS_TOKEN_INVALID"));
    }
    return insufficientScopeError(requiredScopes, granted);
  },
});

export { authorizeMcpRequest };
export type { AdminMcpActor };
