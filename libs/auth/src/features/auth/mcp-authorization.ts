import { createResourceServerChallenge } from "@better-auth/oauth-provider";
import { httpStatus } from "@repo/config";
import { APIError } from "better-auth/api";
import { createInsufficientScopeError, verifyJwsAccessToken } from "better-auth/oauth2";
import { APIError as ChallengeError } from "better-call";
import { Effect, Option, Schema } from "effect";

import { Auth } from "./auth.ts";

import type { BetterAuthInstance } from "./create-auth.ts";

type McpTokenClaims = Awaited<ReturnType<typeof verifyJwsAccessToken>>;

type McpRequest = Readonly<{ headers: Readonly<Pick<Headers, "get">> }>;

type McpSession = Readonly<{ sessionId: string; userId: string }>;

type McpResource<Actor, Failure, Requirements> = Readonly<{
  actor: (
    claims: McpTokenClaims,
    scopes: ReadonlySet<string>,
  ) => Effect.Effect<Actor | Response, Failure, Requirements>;
  challengeScopes: ReadonlyArray<string>;
  recognizedScopes?: ReadonlyArray<string>;
  toolScopes: ReadonlyArray<string>;
}>;

type AuthInstance = Readonly<Pick<BetterAuthInstance, "handler">>;

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

function mcpForbidden(message: string): Response {
  return jsonRpcError(httpStatus.forbidden, message, {});
}

function challengeResponse(
  error: unknown,
  resource: string,
  challengeScopes: ReadonlyArray<string>,
): Response {
  const challenge = createResourceServerChallenge(error, resource, {
    challengeScopes: [...challengeScopes],
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

function fetchJwks(instance: AuthInstance, origin: string): ReturnType<typeof decodeJwks> {
  return instance
    .handler(new Request(`${origin}/api/auth/jwks`))
    .then((response) =>
      response.ok
        ? response.json().then((body) => decodeJwks(body))
        : Promise.reject(new Error("MCP_JWKS_UNAVAILABLE")),
    );
}

function verifiedClaims(
  instance: AuthInstance,
  origin: string,
  token: string,
): Effect.Effect<McpTokenClaims, APIError> {
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

function grantedScopes(
  claims: Readonly<Record<string, unknown>>,
  recognizedScopes: ReadonlyArray<string> | undefined,
): ReadonlySet<string> {
  const { scope } = claims;
  const granted = new Set(typeof scope === "string" ? scope.split(" ") : []);
  return recognizedScopes === undefined
    ? granted
    : new Set(recognizedScopes.filter((recognized) => granted.has(recognized)));
}

function scopeError(
  claims: Readonly<Record<string, unknown>>,
  granted: ReadonlySet<string>,
  resource: Pick<McpResource<unknown, unknown, unknown>, "recognizedScopes" | "toolScopes">,
): Option.Option<unknown> {
  const { cnf } = claims;
  if (cnf !== undefined) {
    return Option.some(unauthorized("SENDER_CONSTRAINED_TOKEN_UNSUPPORTED"));
  }
  if (resource.recognizedScopes !== undefined && granted.size === 0) {
    return Option.some(unauthorized("ACCESS_TOKEN_INVALID"));
  }
  return resource.toolScopes.some((scope) => granted.has(scope))
    ? Option.none()
    : Option.some(createInsufficientScopeError([...resource.toolScopes]));
}

function mcpSession(claims: McpTokenClaims, requiredMessage: string): McpSession | Response {
  const { sid, sub } = claims;
  return typeof sub === "string" && typeof sid === "string"
    ? { sessionId: sid, userId: sub }
    : mcpForbidden(requiredMessage);
}

function mcpAuthorization<Actor, Failure, Requirements>(
  resource: McpResource<Actor, Failure, Requirements>,
) {
  const actorFor = Effect.fn("actorFor")(function* actorFor(
    instance: AuthInstance,
    origin: string,
    token: string,
  ) {
    const resourceUri = `${origin}/mcp`;
    const claims = yield* Effect.result(verifiedClaims(instance, origin, token));
    if (claims._tag === "Failure") {
      return challengeResponse(claims.failure, resourceUri, resource.challengeScopes);
    }
    const granted = grantedScopes(claims.success, resource.recognizedScopes);
    const rejected = scopeError(claims.success, granted, resource);
    if (Option.isSome(rejected)) {
      return challengeResponse(rejected.value, resourceUri, resource.challengeScopes);
    }
    return yield* resource.actor(claims.success, granted);
  });
  return Effect.fn("authorizeMcpRequest")(function* authorizeMcpRequest(
    request: McpRequest,
    origin: string,
  ) {
    const { instance } = yield* Auth;
    const token = bearerToken(request.headers.get("authorization") ?? "");
    if (Option.isNone(token)) {
      return challengeResponse(
        unauthorized("BEARER_TOKEN_REQUIRED"),
        `${origin}/mcp`,
        resource.challengeScopes,
      );
    }
    return yield* actorFor(instance, origin, token.value);
  });
}

export { mcpAuthorization, mcpForbidden, mcpSession };
export type { McpResource, McpSession, McpTokenClaims };
