import { createResourceServerChallenge } from "@better-auth/oauth-provider";
import { adminScopes, Auth } from "@repo/auth";
import { httpStatus } from "@repo/config";
import { APIError } from "better-auth/api";
import { createInsufficientScopeError, verifyJwsAccessToken } from "better-auth/oauth2";
import { APIError as ChallengeError } from "better-call";
import { Effect, Option, Schema } from "effect";

import type { BetterAuthInstance } from "@repo/auth";

type AdminMcpActor = Readonly<{ sessionId: string; userId: string }>;

type TokenClaims = Awaited<ReturnType<typeof verifyJwsAccessToken>>;

const requiredScopes = ["admin:read"];
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
    { error: { code: JSON_RPC_SERVER_ERROR, message }, id: null, jsonrpc: "2.0" },
    { headers: { ...headers, "cache-control": "no-store" }, status },
  );
}

function challengeResponse(error: unknown, resource: string): Response {
  const challenge = createResourceServerChallenge(error, resource, {
    challengeScopes: requiredScopes,
  });
  if (!(challenge instanceof ChallengeError)) {
    return jsonRpcError(httpStatus.unauthorized, "ACCESS_TOKEN_INVALID", {});
  }
  const headers = Object.fromEntries(new Headers(challenge.headers));
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

function fetchJwks(
  instance: Readonly<Pick<BetterAuthInstance, "handler">>,
  origin: string,
): ReturnType<typeof decodeJwks> {
  const handler = instance.handler;
  if (typeof handler !== "function") {
    return Promise.reject(new Error("ADMIN_JWKS_UNAVAILABLE"));
  }
  return Promise.resolve(handler(new Request(`${origin}/api/auth/jwks`))).then((response) => {
    if (!(response instanceof Response)) {
      return Promise.reject(new Error("ADMIN_JWKS_UNAVAILABLE"));
    }
    return response.ok
      ? response.json().then((body) => decodeJwks(body))
      : Promise.reject(new Error("ADMIN_JWKS_UNAVAILABLE"));
  });
}

function verifiedClaims(
  instance: Readonly<Pick<BetterAuthInstance, "handler">>,
  origin: string,
  token: string,
): Effect.Effect<TokenClaims, APIError> {
  return Effect.tryPromise({
    catch: () => unauthorized("ACCESS_TOKEN_INVALID"),
    try: () =>
      verifyJwsAccessToken(token, {
        jwksCacheKey: instance,
        jwksFetch: () => fetchJwks(instance, origin),
        verifyOptions: { audience: `${origin}/mcp`, issuer: `${origin}/api/auth` },
      }),
  });
}

function scopeError(claims: Readonly<Record<string, unknown>>): Option.Option<unknown> {
  const { cnf, scope } = claims;
  if (cnf !== undefined) {
    return Option.some(unauthorized("SENDER_CONSTRAINED_TOKEN_UNSUPPORTED"));
  }
  const granted = new Set(typeof scope === "string" ? scope.split(" ") : []);
  const missing = requiredScopes.filter((required) => !granted.has(required));
  const allowed = adminScopes.filter((registered) => granted.has(registered));
  if (allowed.length === 0) {
    return Option.some(unauthorized("ACCESS_TOKEN_INVALID"));
  }
  return missing.length > 0 ? Option.some(createInsufficientScopeError(missing)) : Option.none();
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
    return jsonRpcError(httpStatus.forbidden, "ADMIN_SESSION_REQUIRED", {});
  }
  return { sessionId: sid, userId: sub } satisfies AdminMcpActor;
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
export type { AdminMcpActor };
