import {
  authorizeMcpAs,
  exchangeOAuthCode,
  grantOAuthAuthorization,
  origins,
  registerVerified,
  signInAs,
  startOAuthAuthorization,
} from "@repo/auth/testing";
import { APPLICATION, memberMcpScopes } from "@repo/config";
import { Effect } from "effect";

import { authorizeMcpRequest } from "./authorize-mcp.ts";

const memberOrigin = origins[APPLICATION.user];

const startMemberAuthorization = () =>
  startOAuthAuthorization({
    application: APPLICATION.user,
    clientName: "Test member MCP client",
    redirectUri: "http://127.0.0.1:43124/callback",
    scope: memberMcpScopes.join(" "),
  });

const tokenFor = Effect.fn("tokenFor")(function* tokenFor(email: string, scope: string) {
  const flow = yield* startMemberAuthorization();
  yield* registerVerified(email);
  const member = yield* signInAs(APPLICATION.user, email);
  const code = yield* grantOAuthAuthorization(member, flow.oauthQuery, scope);
  const tokens = yield* exchangeOAuthCode(flow, code);
  const session = yield* member.verify();
  return { accessToken: tokens.access_token, userId: session.user.id };
});

const mcpChallenge = () => authorizeMcpAs(APPLICATION.user, authorizeMcpRequest);

export { mcpChallenge, memberOrigin, tokenFor };
