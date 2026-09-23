import { Auth } from "@repo/auth";
import {
  AuthApps,
  registerVerified,
  signInAs,
  startClientAuthorization,
  type AuthorizationFlow,
  type BrowserClient,
} from "@repo/auth/testing";
import { APPLICATION, memberMcpScopes } from "@repo/config";
import { Data, Effect, Schema } from "effect";

import { authorizeMcpRequest } from "./authorize-mcp.ts";

type FetchMcp = (request: Request) => Effect.Effect<Response, never, never>;

class McpResponseMissingData extends Data.TaggedError("McpResponseMissingData")<{}> {}

const memberOrigin = "http://127.0.0.1:3001";
const redirectUri = "http://127.0.0.1:43124/callback";
const decodeRedirect = Schema.decodeUnknownEffect(Schema.Struct({ url: Schema.String }));
const Tokens = Schema.Struct({ access_token: Schema.String });
const JsonUnknown = Schema.fromJsonString(Schema.Unknown);

function responseStatus(value: unknown): number | undefined {
  return value instanceof Response ? value.status : undefined;
}

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
  const consentPage = new URL((yield* decodeRedirect(continued.body)).url, memberOrigin);
  const consented = yield* member.json("/oauth2/consent", {
    accept: true,
    oauth_query: consentPage.search.slice(1),
    scope,
  });
  const callbackUrl = new URL((yield* decodeRedirect(consented.body)).url);
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
  const tokens = yield* Schema.decodeEffect(JsonUnknown)(text);
  return yield* Schema.decodeUnknownEffect(Tokens)(tokens);
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

const mcpRequest = Effect.fn("mcpRequest")(function* mcpRequest(
  fetchMcp: FetchMcp,
  token: string,
  body?: unknown,
) {
  const encoded = body === undefined ? undefined : yield* Schema.encodeEffect(JsonUnknown)(body);
  const incoming = new Request(`${memberOrigin}/mcp`, {
    ...(encoded === undefined ? {} : { body: encoded }),
    headers: {
      accept: "application/json, text/event-stream",
      ...(encoded === undefined ? {} : { "content-type": "application/json" }),
      authorization: `Bearer ${token}`,
    },
    method: "POST",
  });
  return yield* fetchMcp(incoming);
});

const parseMcpBody = Effect.fn("parseMcpBody")(function* parseMcpBody(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";
  const text = yield* Effect.promise(() => response.text());
  if (contentType.includes("application/json")) {
    return yield* Schema.decodeEffect(JsonUnknown)(text);
  }
  const dataLine = text.split("\n").find((line) => line.startsWith("data: "));
  if (dataLine === undefined) {
    return yield* new McpResponseMissingData();
  }
  return yield* Schema.decodeEffect(JsonUnknown)(dataLine.slice("data: ".length));
});

const callTool = Effect.fn("callTool")(function* callTool(
  fetchMcp: FetchMcp,
  token: string,
  name: string,
  args: Readonly<Record<string, unknown>> = {},
) {
  const response = yield* mcpRequest(fetchMcp, token, {
    id: 1,
    jsonrpc: "2.0",
    method: "tools/call",
    params: { arguments: args, name },
  });
  return yield* parseMcpBody(response);
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
