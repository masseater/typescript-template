import { mcpAuthorizer, mcpJsonRpcError, mcpUnauthorized } from "@repo/auth";
import { MEMBER_MCP_SCOPE, httpStatus, memberMcpScopes, memberMcpToolScopes } from "@repo/config";
import { createInsufficientScopeError } from "better-auth/oauth2";
import { Effect, Option } from "effect";

type MemberMcpActor = Readonly<{
  scopes: ReadonlySet<string>;
  sessionId: string;
  userId: string;
}>;

function memberScopesIn(granted: ReadonlySet<string>): ReadonlySet<string> {
  return new Set(memberMcpScopes.filter((registered) => granted.has(registered)));
}

const authorizeMcpRequest = mcpAuthorizer({
  actorOf: (subject, granted) => {
    const { sid, sub } = subject;
    if (typeof sub !== "string" || typeof sid !== "string") {
      return Effect.succeed(
        mcpJsonRpcError({ message: "MEMBER_SESSION_REQUIRED", status: httpStatus.forbidden }),
      );
    }
    return Effect.succeed({
      scopes: memberScopesIn(granted),
      sessionId: sid,
      userId: sub,
    } satisfies MemberMcpActor);
  },
  challengeScopes: [MEMBER_MCP_SCOPE.profileRead],
  scopeError: (granted) => {
    const member = memberScopesIn(granted);
    if (member.size === 0) {
      return Option.some(mcpUnauthorized("ACCESS_TOKEN_INVALID"));
    }
    return memberMcpToolScopes.some((scope) => member.has(scope))
      ? Option.none()
      : Option.some(createInsufficientScopeError([...memberMcpToolScopes]));
  },
});

export { authorizeMcpRequest };
export type { MemberMcpActor };
