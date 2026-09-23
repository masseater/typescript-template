import { adminScopes, mcpAuthorization, mcpSession } from "@repo/auth";
import { Effect } from "effect";

import type { McpSession, McpTokenClaims } from "@repo/auth";

type AdminMcpActor = McpSession;

const adminReadScope = "admin:read";

function actorFor(claims: McpTokenClaims): Effect.Effect<AdminMcpActor | Response> {
  return Effect.succeed(mcpSession(claims, "ADMIN_SESSION_REQUIRED"));
}

const authorizeMcpRequest = mcpAuthorization({
  actor: actorFor,
  challengeScopes: [adminReadScope],
  recognizedScopes: adminScopes,
  toolScopes: [adminReadScope],
});

export { authorizeMcpRequest };
export type { AdminMcpActor };
