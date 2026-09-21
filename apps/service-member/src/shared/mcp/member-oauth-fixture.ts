import { Auth } from "@repo/auth";
import {
  AuthApps,
  clientOf,
  registerVerified,
  signInAs,
  UnexpectedStatus,
  type BrowserClient,
} from "@repo/auth/testing";
import { APPLICATION, memberMcpScopes } from "@repo/config";
import { httpStatus } from "@repo/observability";
import { Data, Effect, Schema } from "effect";

import { authorizeMcpRequest } from "./authorize-mcp.ts";

type AuthorizationFlow = {
  readonly clientId: string;
  readonly oauthQuery: string;
  readonly verifier: string;
};

type FetchMcp = (request: Request) => Effect.Effect<Response, never, never>;

class McpResponseMissingData extends Data.TaggedError("McpResponseMissingData")<{}> {}

const memberOrigin = "http://127.0.0.1:3001";
const redirectUri = "http://127.0.0.1:43124/callback";
const VERIFIER_BYTES = 32;
const decodeRedirect = Schema.decodeUnknownEffect(Schema.Struct({ url: Schema.String }));
const Registration = Schema.Struct({ client_id: Schema.String });
const Tokens = Schema.Struct({ access_token: Schema.String });

function responseStatus(value: unknown): number | undefined {
  return value instanceof Response ? value.status : undefined;
}

const pkceChallenge = Effect.fn("pkceChallenge")(function* pkceChallenge(verifier: string) {
  const digest = yield* Effect.promise(async () =>
    crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)),
  );
  return Buffer.from(digest).toString("base64url");
});

const authorizeUrl = (clientId: string, challenge: string): URL => {
  const authorizeQuery = new URLSearchParams({
    client_id: clientId,
    code_challenge: challenge,
    code_challenge_method: "S256",
    redirect_uri: redirectUri,
    resource: `${memberOrigin}/mcp`,
    response_type: "code",
    scope: memberMcpScopes.join(" "),
    state: "state-value",
  });
  return new URL(`/api/auth/oauth2/authorize?${authorizeQuery.toString()}`, memberOrigin);
};

const registerClient = Effect.fn("registerClient")(function* registerClient(
  anonymous: BrowserClient,
) {
  const registration = yield* anonymous.json("/oauth2/register", {
    client_name: "Test member MCP client",
    grant_types: ["authorization_code", "refresh_token"],
    redirect_uris: [redirectUri],
    response_types: ["code"],
    token_endpoint_auth_method: "none",
  });
  if (registration.status !== httpStatus.created) {
    return yield* new UnexpectedStatus({
      endpoint: "/oauth2/register",
      status: registration.status,
    });
  }
  return (yield* Schema.decodeUnknownEffect(Registration)(registration.body)).client_id;
});

const startMemberAuthorization = Effect.fn("startMemberAuthorization")(
  function* startMemberAuthorization() {
    const anonymous = yield* clientOf(APPLICATION.user);
    const clientId = yield* registerClient(anonymous);
    const verifier = Buffer.from(crypto.getRandomValues(new Uint8Array(VERIFIER_BYTES))).toString(
      "base64url",
    );
    const redirect = yield* anonymous.navigate(
      authorizeUrl(clientId, yield* pkceChallenge(verifier)).href,
    );
    const login = new URL(redirect.headers.get("location") ?? "", memberOrigin);
    return { clientId, oauthQuery: login.search.slice(1), verifier } satisfies AuthorizationFlow;
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
  const issued = yield* Effect.promise(async () => member.instance.handler(exchange));
  const tokens = yield* Effect.promise(async (): Promise<unknown> => issued.json());
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
  const incoming = new Request(`${memberOrigin}/mcp`, {
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: {
      accept: "application/json, text/event-stream",
      ...(body === undefined ? {} : { "content-type": "application/json" }),
      authorization: `Bearer ${token}`,
    },
    method: "POST",
  });
  return yield* fetchMcp(incoming);
});

const parseMcpBody = Effect.fn("parseMcpBody")(function* parseMcpBody(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return yield* Effect.promise(async (): Promise<unknown> => response.json());
  }
  const text = yield* Effect.promise(async () => response.text());
  const dataLine = text.split("\n").find((line) => line.startsWith("data: "));
  if (dataLine === undefined) {
    return yield* new McpResponseMissingData();
  }
  return JSON.parse(dataLine.slice("data: ".length)) as unknown;
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
