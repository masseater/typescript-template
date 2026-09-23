import { mcpAuthorization, mcpSession } from "@repo/auth";
import { MEMBER_MCP_SCOPE, memberMcpScopes, memberMcpToolScopes } from "@repo/config";
import { Effect } from "effect";

import type { McpSession, McpTokenClaims } from "@repo/auth";

type MemberMcpActor = McpSession & Readonly<{ scopes: ReadonlySet<string> }>;

function actorFor(
  claims: McpTokenClaims,
  scopes: ReadonlySet<string>,
): Effect.Effect<MemberMcpActor | Response> {
  const session = mcpSession(claims, "MEMBER_SESSION_REQUIRED");
  return Effect.succeed(session instanceof Response ? session : { ...session, scopes });
}

const authorizeMcpRequest = mcpAuthorization({
  actor: actorFor,
  challengeScopes: [MEMBER_MCP_SCOPE.profileRead],
  recognizedScopes: memberMcpScopes,
  toolScopes: memberMcpToolScopes,
});

export { authorizeMcpRequest };
export type { MemberMcpActor };
