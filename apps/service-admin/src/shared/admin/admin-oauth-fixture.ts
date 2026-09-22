import { Auth } from "@repo/auth";
import {
  AuthApps,
  adminOrigin,
  startAdminAuthorization,
  type BrowserClient,
} from "@repo/auth/testing";
import { APPLICATION } from "@repo/config";
import { Data, Effect, Schema } from "effect";

import { authorizeMcpRequest } from "./authorize-mcp.ts";

type AuthorizationFlow = {
  readonly clientId: string;
  readonly oauthQuery: string;
  readonly verifier: string;
};

type FetchMcp = (request: Request) => Effect.Effect<Response, never, never>;

class McpResponseMissingData extends Data.TaggedError("McpResponseMissingData")<{}> {}

const redirectUri = "http://127.0.0.1:43124/callback";
const decodeRedirect = Schema.decodeUnknownEffect(Schema.Struct({ url: Schema.String }));
const Tokens = Schema.Struct({ access_token: Schema.String });
const JsonUnknown = Schema.fromJsonString(Schema.Unknown);

function responseStatus(value: unknown): number | undefined {
  return value instanceof Response ? value.status : undefined;
}

const grantAuthorization = Effect.fn("grantAuthorization")(function* grantAuthorization(
  admin: BrowserClient,
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
  const tokens = yield* Schema.decodeEffect(JsonUnknown)(text);
  return yield* Schema.decodeUnknownEffect(Tokens)(tokens);
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
  const encoded = body === undefined ? undefined : yield* Schema.encodeEffect(JsonUnknown)(body);
  const incoming = new Request(`${adminOrigin}/mcp`, {
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
  exchangeCode,
  grantAuthorization,
  mcpChallenge,
  mcpRequest,
  responseStatus,
  startAdminAuthorization,
};
