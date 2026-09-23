import { Auth } from "@repo/auth";
import {
  AuthApps,
  adminOrigin,
  adminRedirectUri,
  startAdminAuthorization,
  McpJson,
  McpTokens,
  callMcpTool,
  decodeOAuthRedirect,
  responseStatus,
  sendMcp,
  type AuthorizationFlow,
  type BrowserClient,
  type FetchMcp,
} from "@repo/auth/testing";
import { APPLICATION } from "@repo/config";
import { Effect, Schema } from "effect";

import { authorizeMcpRequest } from "./authorize-mcp.ts";

const grantAuthorization = Effect.fn("grantAuthorization")(function* grantAuthorization(
  admin: BrowserClient,
  oauthQuery: string,
) {
  const continued = yield* admin.json("/oauth2/continue", {
    oauth_query: oauthQuery,
    postLogin: true,
  });
  const consentPage = new URL((yield* decodeOAuthRedirect(continued.body)).url, adminOrigin);
  const consented = yield* admin.json("/oauth2/consent", {
    accept: true,
    oauth_query: consentPage.search.slice(1),
  });
  const callbackUrl = new URL((yield* decodeOAuthRedirect(consented.body)).url);
  return callbackUrl.searchParams.get("code") ?? "";
});

const exchangeCode = Effect.fn("exchangeCode")(function* exchangeCode(
  flow: AuthorizationFlow,
  code: string,
) {
  const admin = (yield* AuthApps)[APPLICATION.admin];
  const exchange = new Request(`${adminOrigin}/api/auth/oauth2/token`, {
    body: new URLSearchParams({
      client_id: flow.clientId,
      code,
      code_verifier: flow.verifier,
      grant_type: "authorization_code",
      redirect_uri: adminRedirectUri,
      resource: `${adminOrigin}/mcp`,
    }),
    headers: { "content-type": "application/x-www-form-urlencoded" },
    method: "POST",
  });
  const issued: unknown = yield* Effect.promise(() => {
    const handler = admin.instance.handler;
    if (typeof handler !== "function") {
      return Promise.reject(new Error("ADMIN_HANDLER_UNAVAILABLE"));
    }
    return Promise.resolve(handler(exchange));
  });
  if (!(issued instanceof Response)) {
    return yield* Effect.die("ADMIN_HANDLER_UNAVAILABLE");
  }
  const text = yield* Effect.promise(() => issued.text());
  const tokens = yield* Schema.decodeEffect(McpJson)(text);
  return yield* Schema.decodeUnknownEffect(McpTokens)(tokens);
});

const mcpChallenge = Effect.fn("mcpChallenge")(function* mcpChallenge() {
  const admin = (yield* AuthApps)[APPLICATION.admin];
  const incoming = new Request(`${adminOrigin}/mcp`, {
    headers: { accept: "application/json, text/event-stream" },
    method: "POST",
  });
  return yield* authorizeMcpRequest(incoming, adminOrigin).pipe(Effect.provideService(Auth, admin));
});

const mcpRequest = Effect.fn("mcpRequest")(function* mcpRequest(
  fetchMcp: FetchMcp,
  token: string,
  body?: unknown,
) {
  return yield* sendMcp({ fetchMcp, origin: adminOrigin, token }, body);
});

const callTool = Effect.fn("callTool")(function* callTool(
  fetchMcp: FetchMcp,
  token: string,
  name: string,
  args: Readonly<Record<string, unknown>> = {},
) {
  return yield* callMcpTool({ fetchMcp, origin: adminOrigin, token }, { arguments: args, name });
});

export type { FetchMcp };
export {
  callTool,
  exchangeCode,
  grantAuthorization,
  mcpChallenge,
  mcpRequest,
  responseStatus,
  startAdminAuthorization,
};
