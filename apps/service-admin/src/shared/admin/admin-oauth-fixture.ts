import { Auth } from "@repo/auth";
import { AuthApps, adminOrigin, startAdminAuthorization } from "@repo/auth/testing";
import { APPLICATION } from "@repo/config";
import { Effect, Schema } from "effect";

import { authorizeMcpRequest } from "./authorize-mcp.ts";

type AuthorizationFlow = {
  readonly clientId: string;
  readonly oauthQuery: string;
  readonly verifier: string;
};

const redirectUri = "http://127.0.0.1:43124/callback";
const decodeRedirect = Schema.decodeUnknownEffect(Schema.Struct({ url: Schema.String }));
const Tokens = Schema.Struct({ access_token: Schema.String });

function responseStatus(value: unknown): number | undefined {
  return value instanceof Response ? value.status : undefined;
}

const grantAuthorization = Effect.fn("grantAuthorization")(function* grantAuthorization(
  admin: Awaited<ReturnType<typeof import("@repo/auth/testing").clientOf>>,
  oauthQuery: string,
) {
  const continued = yield* admin.json("/oauth2/continue", {
    oauth_query: oauthQuery,
    postLogin: true,
  });
  const consentPage = new URL((yield* decodeRedirect(continued.body)).url, adminOrigin);
  const consented = yield* admin.json("/oauth2/consent", {
    accept: true,
    oauth_query: consentPage.search.slice(1),
  });
  const callbackUrl = new URL((yield* decodeRedirect(consented.body)).url);
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
      redirect_uri: redirectUri,
      resource: `${adminOrigin}/mcp`,
    }),
    headers: { "content-type": "application/x-www-form-urlencoded" },
    method: "POST",
  });
  const issued = yield* Effect.promise(async () => admin.instance.handler(exchange));
  const tokens = yield* Effect.promise(async (): Promise<unknown> => issued.json());
  return yield* Schema.decodeUnknownEffect(Tokens)(tokens);
});

const mcpRequest = Effect.fn("mcpRequest")(function* mcpRequest(
  fetchMcp: (request: Request) => Effect.Effect<Response>,
  token?: string,
  body?: unknown,
) {
  const incoming = new Request(`${adminOrigin}/mcp`, {
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: {
      accept: "application/json, text/event-stream",
      ...(body === undefined ? {} : { "content-type": "application/json" }),
      ...(token === undefined ? {} : { authorization: `Bearer ${token}` }),
    },
    method: "POST",
  });
  if (token === undefined) {
    const admin = (yield* AuthApps)[APPLICATION.admin];
    return yield* authorizeMcpRequest(incoming, adminOrigin).pipe(
      Effect.provideService(Auth, admin),
    );
  }
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
    return yield* Effect.fail(new Error("MCP response missing data"));
  }
  return JSON.parse(dataLine.slice("data: ".length)) as unknown;
});

const callTool = Effect.fn("callTool")(function* callTool(
  fetchMcp: (request: Request) => Effect.Effect<Response>,
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
  if (!(response instanceof Response)) {
    return response;
  }
  return yield* parseMcpBody(response);
});

export {
  callTool,
  exchangeCode,
  grantAuthorization,
  mcpRequest,
  responseStatus,
  startAdminAuthorization,
};
