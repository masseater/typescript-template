import { createResourceServerChallenge } from "@better-auth/oauth-provider";
import { Auth } from "@repo/auth";
import { MEMBER_MCP_SCOPE, memberMcpScopes, memberMcpToolScopes } from "@repo/config";
import { httpStatus } from "@repo/observability/http-status";
import { APIError } from "better-auth/api";
import { createInsufficientScopeError, verifyJwsAccessToken } from "better-auth/oauth2";
import { Effect, Option, Schema } from "effect";

import type { BetterAuthInstance } from "@repo/auth";

type MemberMcpActor = Readonly<{
  scopes: ReadonlySet<string>;
  sessionId: string;
  userId: string;
}>;

type TokenClaims = Awaited<ReturnType<typeof verifyJwsAccessToken>>;

const JSON_RPC_SERVER_ERROR = -32_000;
const Jwk = Schema.StructWithRest(Schema.Struct({ kty: Schema.String }), [
  Schema.Record(Schema.String, Schema.Unknown),
]);
const Jwks = Schema.Struct({ keys: Schema.mutable(Schema.Array(Jwk)) });
const decodeJwks = Schema.decodeUnknownPromise(Jwks);

function jsonRpcError(
  status: number,
  message: string,
  headers: Readonly<Record<string, string>>,
): Response {
  return Response.json(
    // oxlint-disable-next-line unicorn/no-null
    { error: { code: JSON_RPC_SERVER_ERROR, message }, id: null, jsonrpc: "2.0" },
    { headers: { ...headers, "cache-control": "no-store" }, status },
  );
}

function challengeResponse(error: unknown, resource: string): Response {
  const challenge = createResourceServerChallenge(error, resource, {
    challengeScopes: [MEMBER_MCP_SCOPE.profileRead],
  });
  if (
    typeof challenge !== "object" ||
    challenge === null ||
    !("statusCode" in challenge) ||
    !("headers" in challenge) ||
    !("message" in challenge) ||
    typeof challenge.statusCode !== "number" ||
    typeof challenge.message !== "string"
  ) {
    return jsonRpcError(httpStatus.unauthorized, "ACCESS_TOKEN_INVALID", {});
  }
  const headers = Object.fromEntries(new Headers(challenge.headers as HeadersInit));
  return jsonRpcError(challenge.statusCode, challenge.message, headers);
}

function unauthorized(message: string): APIError {
  return new APIError("UNAUTHORIZED", { message });
}

function bearerToken(authorization: string): Option.Option<string> {
  const [scheme, token, ...rest] = authorization.split(" ");
  return scheme?.toLowerCase() === "bearer" &&
    token !== undefined &&
    token !== "" &&
    rest.length === 0
    ? Option.some(token)
    : Option.none();
}

async function fetchJwks(
  instance: Readonly<Pick<BetterAuthInstance, "handler">>,
  origin: string,
): ReturnType<typeof decodeJwks> {
  const response = await instance.handler(new Request(`${origin}/api/auth/jwks`));
  return response.ok
    ? decodeJwks(await response.json())
    : Promise.reject(new Error("MEMBER_JWKS_UNAVAILABLE"));
}

function verifiedClaims(
  instance: Readonly<Pick<BetterAuthInstance, "handler">>,
  origin: string,
  token: string,
): Effect.Effect<TokenClaims, APIError> {
  return Effect.tryPromise({
    catch: () => unauthorized("ACCESS_TOKEN_INVALID"),
    try: async () =>
      verifyJwsAccessToken(token, {
        jwksCacheKey: instance,
        jwksFetch: async () => fetchJwks(instance, origin),
        verifyOptions: { audience: `${origin}/mcp`, issuer: `${origin}/api/auth` },
      }),
  });
}

function grantedScopes(claims: Readonly<Record<string, unknown>>): ReadonlySet<string> {
  const { scope } = claims;
  const granted = new Set(typeof scope === "string" ? scope.split(" ") : []);
  return new Set(memberMcpScopes.filter((registered) => granted.has(registered)));
}

function scopeError(claims: Readonly<Record<string, unknown>>): Option.Option<unknown> {
  const { cnf } = claims;
  if (cnf !== undefined) {
    return Option.some(unauthorized("SENDER_CONSTRAINED_TOKEN_UNSUPPORTED"));
  }
  const granted = grantedScopes(claims);
  const tools = memberMcpToolScopes.filter((scope) => granted.has(scope));
  if (granted.size === 0) {
    return Option.some(unauthorized("ACCESS_TOKEN_INVALID"));
  }
  return tools.length === 0
    ? Option.some(createInsufficientScopeError([...memberMcpToolScopes]))
    : Option.none();
}

const actorFor = Effect.fn("actorFor")(function* actorFor(
  instance: Readonly<Pick<BetterAuthInstance, "handler">>,
  origin: string,
  token: string,
) {
  const resource = `${origin}/mcp`;
  const claims = yield* Effect.result(verifiedClaims(instance, origin, token));
  if (claims._tag === "Failure") {
    return challengeResponse(claims.failure, resource);
  }
  const rejected = scopeError(claims.success);
  if (Option.isSome(rejected)) {
    return challengeResponse(rejected.value, resource);
  }
  const { sid, sub } = claims.success;
  if (typeof sub !== "string" || typeof sid !== "string") {
    return jsonRpcError(httpStatus.forbidden, "MEMBER_SESSION_REQUIRED", {});
  }
  return {
    scopes: grantedScopes(claims.success),
    sessionId: sid,
    userId: sub,
  } satisfies MemberMcpActor;
});

const authorizeMcpRequest = Effect.fn("authorizeMcpRequest")(function* authorizeMcpRequest(
  request: Readonly<{ headers: Readonly<Pick<Headers, "get">> }>,
  origin: string,
) {
  const { instance } = yield* Auth;
  const token = bearerToken(request.headers.get("authorization") ?? "");
  if (Option.isNone(token)) {
    return challengeResponse(unauthorized("BEARER_TOKEN_REQUIRED"), `${origin}/mcp`);
  }
  return yield* actorFor(instance, origin, token.value);
});

export { authorizeMcpRequest };
export type { MemberMcpActor };
