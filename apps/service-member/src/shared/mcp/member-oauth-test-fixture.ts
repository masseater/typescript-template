import { Auth } from "@repo/auth";
import {
  AuthApps,
  registerVerified,
  signInAs,
  startClientAuthorization,
  McpJson,
  McpTokens,
  callMcpTool,
  decodeOAuthRedirect,
  responseStatus,
  type AuthorizationFlow,
  type BrowserClient,
  type FetchMcp,
} from "@repo/auth/testing";
import { APPLICATION, memberMcpScopes } from "@repo/config";
import { Effect, Schema } from "effect";

import { authorizeMcpRequest } from "./authorize-mcp.ts";

const memberOrigin = "http://127.0.0.1:3001";
const redirectUri = "http://127.0.0.1:43124/callback";

const startMemberAuthorization = Effect.fn("startMemberAuthorization")(
  function* startMemberAuthorization() {
    return yield* startClientAuthorization({
      application: APPLICATION.user,
      clientName: "Test member MCP client",
      redirectUri,
      scope: memberMcpScopes.join(" "),
    });
  },
);

const grantAuthorization = Effect.fn("grantAuthorization")(function* grantAuthorization(
  member: BrowserClient,
  oauthQuery: string,
  scope: string,
) {
  const continued = yield* member.json("/oauth2/continue", {
    oauth_query: oauthQuery,
    postLogin: true,
  });
  const consentPage = new URL((yield* decodeOAuthRedirect(continued.body)).url, memberOrigin);
  const consented = yield* member.json("/oauth2/consent", {
    accept: true,
    oauth_query: consentPage.search.slice(1),
    scope,
  });
  const callbackUrl = new URL((yield* decodeOAuthRedirect(consented.body)).url);
  return callbackUrl.searchParams.get("code") ?? "";
});

const exchangeCode = Effect.fn("exchangeCode")(function* exchangeCode(
  flow: AuthorizationFlow,
  code: string,
) {
  const member = (yield* AuthApps)[APPLICATION.user];
  const exchange = new Request(`${memberOrigin}/api/auth/oauth2/token`, {
    body: new URLSearchParams({
      client_id: flow.clientId,
      code,
      code_verifier: flow.verifier,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
      resource: `${memberOrigin}/mcp`,
    }),
    headers: { "content-type": "application/x-www-form-urlencoded" },
    method: "POST",
  });
  const issued: unknown = yield* Effect.promise(() => {
    const handler = member.instance.handler;
    if (typeof handler !== "function") {
      return Promise.reject(new Error("MEMBER_HANDLER_UNAVAILABLE"));
    }
    return Promise.resolve(handler(exchange));
  });
  if (!(issued instanceof Response)) {
    return yield* Effect.die("MEMBER_HANDLER_UNAVAILABLE");
  }
  const text = yield* Effect.promise(() => issued.text());
  const tokens = yield* Schema.decodeEffect(McpJson)(text);
  return yield* Schema.decodeUnknownEffect(McpTokens)(tokens);
});

const memberTokens = Effect.fn("memberTokens")(function* memberTokens(email: string) {
  yield* registerVerified(email);
  const member = yield* signInAs(APPLICATION.user, email);
  const flow = yield* startMemberAuthorization();
  const code = yield* grantAuthorization(member, flow.oauthQuery, memberMcpScopes.join(" "));
  return { email, tokens: yield* exchangeCode(flow, code) };
});

const tokenFor = Effect.fn("tokenFor")(function* tokenFor(email: string, scope: string) {
  const flow = yield* startMemberAuthorization();
  yield* registerVerified(email);
  const member = yield* signInAs(APPLICATION.user, email);
  const code = yield* grantAuthorization(member, flow.oauthQuery, scope);
  const tokens = yield* exchangeCode(flow, code);
  const session = yield* member.verify();
  return { accessToken: tokens.access_token, userId: session.user.id };
});

const mcpChallenge = Effect.fn("mcpChallenge")(function* mcpChallenge() {
  const member = (yield* AuthApps)[APPLICATION.user];
  const incoming = new Request(`${memberOrigin}/mcp`, {
    headers: { accept: "application/json, text/event-stream" },
    method: "POST",
  });
  return yield* authorizeMcpRequest(incoming, memberOrigin).pipe(
    Effect.provideService(Auth, member),
  );
});

const callTool = Effect.fn("callTool")(function* callTool(
  fetchMcp: FetchMcp,
  token: string,
  name: string,
  args: Readonly<Record<string, unknown>> = {},
) {
  return yield* callMcpTool({ fetchMcp, origin: memberOrigin, token }, { arguments: args, name });
});

export type { FetchMcp };
export {
  callTool,
  grantAuthorization,
  mcpChallenge,
  memberOrigin,
  memberTokens,
  responseStatus,
  startMemberAuthorization,
  tokenFor,
};
