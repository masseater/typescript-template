import {
  authorizeMcpAs,
  callMcpTool,
  exchangeOAuthCode,
  grantOAuthAuthorization,
  origins,
  registerVerified,
  responseStatus,
  signInAs,
  startClientAuthorization,
  type FetchMcp,
} from "@repo/auth/testing";
import { APPLICATION, memberMcpScopes } from "@repo/config";
import { Effect } from "effect";

import { authorizeMcpRequest } from "./authorize-mcp.ts";

const memberOrigin = origins[APPLICATION.user];

const memberClient = {
  application: APPLICATION.user,
  clientName: "Test member MCP client",
  redirectUri: "http://127.0.0.1:43124/callback",
  scope: memberMcpScopes.join(" "),
} as const;

const tokenFor = Effect.fn("tokenFor")(function* tokenFor(email: string, scope: string) {
  const flow = yield* startClientAuthorization(memberClient);
  yield* registerVerified(email);
  const member = yield* signInAs(APPLICATION.user, email);
  const code = yield* grantOAuthAuthorization(member, { oauthQuery: flow.oauthQuery, scope });
  const tokens = yield* exchangeOAuthCode(flow, code);
  const session = yield* member.verify();
  return { accessToken: tokens.access_token, userId: session.user.id };
});

const mcpChallenge = () => authorizeMcpAs({ application: APPLICATION.user }, authorizeMcpRequest);

const callTool = Effect.fn("callTool")(function* callTool(
  fetchMcp: FetchMcp,
  token: string,
  name: string,
  args: Readonly<Record<string, unknown>> = {},
) {
  return yield* callMcpTool({ fetchMcp, origin: memberOrigin, token }, { arguments: args, name });
});

export type { FetchMcp };
export { callTool, mcpChallenge, memberOrigin, responseStatus, tokenFor };
